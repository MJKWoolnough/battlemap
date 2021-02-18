package battlemap

import (
	"compress/gzip"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"path/filepath"
	"strconv"
	"sync"
	"time"

	"vimagination.zapto.org/byteio"
	"vimagination.zapto.org/keystore"
)

type musicTrack struct {
	ID     uint64 `json:"id"`
	Volume uint8  `json:"volume"`
	Repeat int32  `json:"repeat"`
}

type musicPack struct {
	Tracks   []musicTrack `json:"tracks"`
	Volume   uint8        `json:"volume"`
	PlayTime uint64       `json:"playTime"`
}

func (m *musicPack) ReadFrom(r io.Reader) (int64, error) {
	g, err := gzip.NewReader(r)
	if err != nil {
		return 0, err
	}
	br := byteio.StickyLittleEndianReader{Reader: g}
	m.Tracks = make([]musicTrack, br.ReadUint64())
	for n := range m.Tracks {
		m.Tracks[n] = musicTrack{
			ID:     br.ReadUint64(),
			Volume: br.ReadUint8(),
			Repeat: br.ReadInt32(),
		}
	}
	m.Volume = br.ReadUint8()
	m.PlayTime = br.ReadUint64()
	return br.Count, br.Err
}

func (m *musicPack) WriteTo(w io.Writer) (int64, error) {
	g, err := gzip.NewWriterLevel(w, gzip.BestCompression)
	if err != nil {
		return 0, err
	}
	bw := byteio.StickyLittleEndianWriter{Writer: g}
	bw.WriteUint64(uint64(len(m.Tracks)))
	for _, t := range m.Tracks {
		bw.WriteUint64(t.ID)
		bw.WriteUint8(t.Volume)
		bw.WriteInt32(t.Repeat)
	}
	bw.WriteUint8(m.Volume)
	bw.WriteUint64(m.PlayTime)
	g.Close()
	return bw.Count, bw.Err
}

type musicPacksDir struct {
	*Battlemap
	fileStore *keystore.FileStore

	mu    sync.RWMutex
	packs map[string]*musicPack
}

func (m *musicPacksDir) Init(b *Battlemap, links links) error {
	m.Battlemap = b
	var location keystore.String
	err := b.config.Get("MusicPacksDir", &location)
	if err != nil {
		return fmt.Errorf("error retrieving music packs location: %w", err)
	}
	mp := filepath.Join(b.config.BaseDir, string(location))
	m.fileStore, err = keystore.NewFileStore(mp, mp, keystore.NoMangle)
	if err != nil {
		return fmt.Errorf("error creating music packs keystore: %w", err)
	}
	m.packs = make(map[string]*musicPack)
	for _, packName := range m.fileStore.Keys() {
		pack := new(musicPack)
		if err := m.fileStore.Get(packName, pack); err != nil {
			return fmt.Errorf("error reading music pack %q: %w", packName, err)
		}
		m.packs[packName] = pack
		for _, track := range pack.Tracks {
			links.audio.setLink(track.ID)
		}
	}
	return nil
}

func (m *musicPacksDir) getPack(name string, fn func(*musicPack) bool) error {
	var err error
	m.mu.Lock()
	if p, ok := m.packs[name]; ok {
		if fn(p) {
			err = m.fileStore.Set(name, p)
		}
	} else {
		err = ErrUnknownMusicPack
	}
	m.mu.Unlock()
	return err
}

func (m *musicPacksDir) getTrack(name string, track uint, fn func(*musicPack, *musicTrack) bool) error {
	var errr error
	if err := m.getPack(name, func(mp *musicPack) bool {
		if track >= uint(len(mp.Tracks)) {
			errr = ErrUnknownMusicTrack
			return false
		}
		return fn(mp, &mp.Tracks[track])
	}); err != nil {
		return err
	}
	return errr
}

func (m *musicPacksDir) RPCData(cd ConnData, method string, data json.RawMessage) (interface{}, error) {
	cd.CurrentMap = 0
	switch method {
	case "list":
		m.mu.RLock()
		r, _ := json.Marshal(m.packs)
		m.mu.RUnlock()
		return json.RawMessage(r), nil
	case "new":
		var name string
		if err := json.Unmarshal(data, &name); err != nil {
			return nil, err
		}
		m.mu.Lock()
		oName := name
		name = uniqueName(oName, func(name string) bool {
			_, ok := m.packs[name]
			return !ok
		})
		if oName != name {
			data = appendString(data[:0], name)
		}
		p := &musicPack{
			Tracks: make([]musicTrack, 0),
		}
		p.Volume = 255
		m.packs[name] = p
		err := m.fileStore.Set(name, p)
		m.mu.Unlock()
		if err != nil {
			return nil, err
		}
		m.socket.broadcastMapChange(cd, broadcastMusicPackAdd, data, userAny)
		return data, nil
	case "rename":
		var names struct {
			OldName string `json:"from"`
			NewName string `json:"to"`
		}
		if err := json.Unmarshal(data, &names); err != nil {
			return nil, err
		}
		m.mu.Lock()
		mp, ok := m.packs[names.OldName]
		if !ok {
			m.mu.Unlock()
			return nil, ErrUnknownMusicPack
		}
		delete(m.packs, names.OldName)
		nName := names.NewName
		names.NewName = uniqueName(nName, func(name string) bool {
			_, ok := m.packs[name]
			return !ok
		})
		if nName != names.NewName {
			data = json.RawMessage(append(appendString(append(appendString(append(data[:0], "{\"from\":"...), names.OldName), ",\"to\":"...), names.NewName), '}'))
		}
		m.packs[names.NewName] = mp
		m.fileStore.Rename(names.OldName, names.NewName)
		m.mu.Unlock()
		m.socket.broadcastMapChange(cd, broadcastMusicPackRename, data, userAny)
		return names.NewName, nil
	case "remove":
		var name string
		if err := json.Unmarshal(data, &name); err != nil {
			return nil, err
		}
		m.mu.Lock()
		_, ok := m.packs[name]
		if !ok {
			m.mu.Unlock()
			return nil, ErrUnknownMusicPack
		}
		delete(m.packs, name)
		m.fileStore.Remove(name)
		m.mu.Unlock()
		m.socket.broadcastMapChange(cd, broadcastMusicPackRemove, data, userAny)
		return nil, nil
	case "copy":
		var names struct {
			OldName string `json:"from"`
			NewName string `json:"to"`
		}
		if err := json.Unmarshal(data, &names); err != nil {
			return nil, err
		}
		m.mu.Lock()
		mp, ok := m.packs[names.OldName]
		if !ok {
			m.mu.Unlock()
			return nil, ErrUnknownMusicPack
		}
		nName := names.NewName
		names.NewName = uniqueName(nName, func(name string) bool {
			_, ok := m.packs[name]
			return !ok
		})
		if nName != names.NewName {
			data = json.RawMessage(append(appendString(append(appendString(append(data[:0], "{\"from\":"...), names.OldName), ",\"to\":"...), names.NewName), '}'))
		}
		np := &musicPack{
			Tracks:   make([]musicTrack, len(mp.Tracks)),
			Volume:   mp.Volume,
			PlayTime: 0,
		}
		for n, t := range mp.Tracks {
			np.Tracks[n] = t
		}
		m.packs[names.NewName] = np
		m.fileStore.Set(names.NewName, np)
		m.mu.Unlock()
		m.socket.broadcastMapChange(cd, broadcastMusicPackCopy, data, userAny)
		return names.NewName, nil
	case "setVolume":
		var packData struct {
			MusicPack string `json:"musicPack"`
			Volume    uint8  `json:"volume"`
		}
		if err := json.Unmarshal(data, &packData); err != nil {
			return nil, err
		}
		if err := m.getPack(packData.MusicPack, func(mp *musicPack) bool {
			if mp.Volume == packData.Volume {
				return false
			}
			mp.Volume = packData.Volume
			return true
		}); err != nil {
			return nil, err
		}
		m.socket.broadcastMapChange(cd, broadcastMusicPackVolume, data, userAny)
		return nil, nil
	case "playPack":
		var packData struct {
			MusicPack string `json:"musicPack"`
			PlayTime  uint64 `jons:"playTime"`
		}
		if err := json.Unmarshal(data, &packData); err != nil {
			return nil, err
		}
		if packData.PlayTime == 0 {
			packData.PlayTime = uint64(time.Now().Unix())
			data = json.RawMessage(append(strconv.AppendUint(append(appendString(append(data[:0], "{\"musicPack\":"...), packData.MusicPack), ",\"playTime\":"...), packData.PlayTime, 10), '}'))
		}
		if err := m.getPack(packData.MusicPack, func(mp *musicPack) bool {
			if mp.PlayTime == packData.PlayTime {
				return false
			}
			mp.PlayTime = packData.PlayTime
			return true
		}); err != nil {
			return nil, err
		}
		m.socket.broadcastMapChange(cd, broadcastMusicPackPlay, data, userAny)
		return packData.PlayTime, nil
	case "stopPack":
		var packData string
		if err := json.Unmarshal(data, &packData); err != nil {
			return nil, err
		}
		if err := m.getPack(packData, func(mp *musicPack) bool {
			if mp.PlayTime == 0 {
				return false
			}
			mp.PlayTime = 0
			return true
		}); err != nil {
			return nil, err
		}
		m.socket.broadcastMapChange(cd, broadcastMusicPackStop, data, userAny)
		return nil, nil
	case "stopAllPacks":
		m.mu.Lock()
		for k, p := range m.packs {
			if p.PlayTime == 0 {
				continue
			}
			p.PlayTime = 0
			m.fileStore.Set(k, p)
		}
		m.mu.Unlock()
		m.socket.broadcastMapChange(cd, broadcastMusicPackStopAll, data, userAny)
		return nil, nil
	case "addTracks":
		var trackData struct {
			MusicPack string   `json:"musicPack"`
			Tracks    []uint64 `json:"tracks"`
		}
		if err := json.Unmarshal(data, &trackData); err != nil {
			return nil, err
		}
		if err := m.getPack(trackData.MusicPack, func(mp *musicPack) bool {
			for _, t := range trackData.Tracks {
				mp.Tracks = append(mp.Tracks, musicTrack{ID: t, Volume: 255, Repeat: -1})
			}
			return true
		}); err != nil {
			return nil, err
		}
		m.socket.broadcastMapChange(cd, broadcastMusicPackTrackAdd, data, userAny)
		return nil, nil
	case "removeTrack":
		var trackData struct {
			MusicPack string `json:"musicPack"`
			Track     uint   `json:"track"`
		}
		if err := json.Unmarshal(data, &trackData); err != nil {
			return nil, err
		}
		if err := m.getTrack(trackData.MusicPack, trackData.Track, func(mp *musicPack, mt *musicTrack) bool {
			mp.Tracks = append(mp.Tracks[:trackData.Track], mp.Tracks[trackData.Track+1:]...)
			return true
		}); err != nil {
			return nil, err
		}
		m.socket.broadcastMapChange(cd, broadcastMusicPackTrackRemove, data, userAny)
		return nil, nil
	case "setTrackVolume":
		var trackData struct {
			MusicPack string `json:"musicPack"`
			Track     uint   `json:"track"`
			Volume    uint8  `json:"volume"`
		}
		if err := json.Unmarshal(data, &trackData); err != nil {
			return nil, err
		}
		if err := m.getTrack(trackData.MusicPack, trackData.Track, func(mp *musicPack, mt *musicTrack) bool {
			if mt.Volume == trackData.Volume {
				return false
			}
			mt.Volume = trackData.Volume
			return true
		}); err != nil {
			return nil, err
		}
		m.socket.broadcastMapChange(cd, broadcastMusicPackTrackVolume, data, userAny)
		return nil, nil
	case "setTrackRepeat":
		var trackData struct {
			MusicPack string `json:"musicPack"`
			Track     uint   `json:"track"`
			Repeat    int32  `json:"repeat"`
		}
		if err := json.Unmarshal(data, &trackData); err != nil {
			return nil, err
		}
		if err := m.getTrack(trackData.MusicPack, trackData.Track, func(mp *musicPack, mt *musicTrack) bool {
			if mt.Repeat == trackData.Repeat {
				return false
			}
			mt.Repeat = trackData.Repeat
			return true
		}); err != nil {
			return nil, err
		}
		m.socket.broadcastMapChange(cd, broadcastMusicPackTrackRepeat, data, userAny)
		return nil, nil
	}
	return nil, ErrUnknownMethod
}

// errors
var (
	ErrUnknownMusicPack  = errors.New("unknown music pack")
	ErrUnknownMusicTrack = errors.New("unknown music track")
)
