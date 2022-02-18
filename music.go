package battlemap

import (
	"compress/gzip"
	"encoding/json"
	"fmt"
	"io"
	"path/filepath"
	"strconv"
	"sync"
	"time"

	"vimagination.zapto.org/byteio"
	"vimagination.zapto.org/keystore"
	"vimagination.zapto.org/memio"
)

type musicTrack struct {
	ID     uint64 `json:"id"`
	Volume uint8  `json:"volume"`
	Repeat int32  `json:"repeat"`
}

type musicPack struct {
	Name     string       `json:"name"`
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
	m.Name = br.ReadString32()
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
	bw.WriteString32(m.Name)
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

	mu     sync.RWMutex
	packs  map[uint64]*musicPack
	names  map[string]struct{}
	lastID uint64
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
	m.packs = make(map[uint64]*musicPack)
	m.names = make(map[string]struct{})
	for _, idStr := range m.fileStore.Keys() {
		id, err := strconv.ParseUint(idStr, 10, 64)
		if err != nil {
			m.lastID++
			id = m.lastID
		}
		pack := new(musicPack)
		if err := m.fileStore.Get(idStr, pack); err != nil {
			return fmt.Errorf("error reading music pack %d: %w", id, err)
		}
		m.packs[id] = pack
		on := pack.Name
		pack.Name = uniqueName(pack.Name, func(name string) bool {
			_, ok := m.names[name]
			return !ok
		})
		if pack.Name != on {
			if err := m.fileStore.Set(idStr, pack); err != nil {
				return fmt.Errorf("error correcting pack name %d: %w", id, err)
			}
		}
		m.names[pack.Name] = struct{}{}
		for _, track := range pack.Tracks {
			links.audio.setLink(track.ID)
		}
		if id > m.lastID {
			m.lastID = id
		}
	}
	return nil
}

func (m *musicPacksDir) getPack(id uint64, fn func(*musicPack) bool) error {
	var err error
	m.mu.Lock()
	if p, ok := m.packs[id]; ok {
		if fn(p) {
			err = m.fileStore.Set(strconv.FormatUint(id, 10), p)
		}
	} else {
		err = ErrUnknownMusicPack
	}
	m.mu.Unlock()
	return err
}

func (m *musicPacksDir) getTrack(id uint64, track uint, fn func(*musicPack, *musicTrack) bool) error {
	var errr error
	if err := m.getPack(id, func(mp *musicPack) bool {
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
		buf := memio.Buffer("[")
		first := true
		j := json.NewEncoder(&buf)
		m.mu.RLock()
		for id, p := range m.packs {
			if first {
				first = false
			} else {
				buf = append(buf, ',')
			}
			j.Encode(p)
			buf = append(strconv.AppendUint(append(buf[:len(buf)-2], ",\"id\":"...), id, 10), '}')
		}
		m.mu.RUnlock()
		buf = append(buf, ']')
		return json.RawMessage(buf), nil
	case "new":
		var name string
		if err := json.Unmarshal(data, &name); err != nil {
			return nil, err
		}
		m.mu.Lock()
		oName := name
		name = uniqueName(oName, func(name string) bool {
			_, ok := m.names[name]
			return !ok
		})
		p := &musicPack{
			Name:   name,
			Tracks: make([]musicTrack, 0),
		}
		p.Volume = 255
		m.lastID++
		m.packs[m.lastID] = p
		err := m.fileStore.Set(strconv.FormatUint(m.lastID, 10), p)
		m.mu.Unlock()
		if err != nil {
			return nil, err
		}
		data = append(appendString(append(strconv.AppendUint(append(data[:0], "{\"id\":"...), m.lastID, 10), ",\"name\":"...), name), '}')
		m.socket.broadcastMapChange(cd, broadcastMusicPackAdd, data, userAny)
		return data, nil
	case "rename":
		var names struct {
			ID   uint64 `json:"id"`
			Name string `json:"name"`
		}
		if err := json.Unmarshal(data, &names); err != nil {
			return nil, err
		}
		m.mu.Lock()
		mp, ok := m.packs[names.ID]
		if !ok {
			m.mu.Unlock()
			return nil, ErrUnknownMusicPack
		}
		delete(m.names, mp.Name)
		mp.Name = uniqueName(names.Name, func(name string) bool {
			_, ok := m.names[name]
			return !ok
		})
		if mp.Name != names.Name {
			data = json.RawMessage(append(appendString(append(strconv.AppendUint(append(data[:0], "{\"id\":"...), names.ID, 10), ",\"name\":"...), names.Name), '}'))
		}
		m.names[mp.Name] = struct{}{}
		m.mu.Unlock()
		m.socket.broadcastMapChange(cd, broadcastMusicPackRename, data, userAdmin)
		return mp.Name, nil
	case "remove":
		var id uint64
		if err := json.Unmarshal(data, &id); err != nil {
			return nil, err
		}
		m.mu.Lock()
		mp, ok := m.packs[id]
		if !ok {
			m.mu.Unlock()
			return nil, ErrUnknownMusicPack
		}
		delete(m.packs, id)
		delete(m.names, mp.Name)
		m.mu.Unlock()
		m.socket.broadcastMapChange(cd, broadcastMusicPackRemove, data, userAny)
		return nil, nil
	case "copy":
		var names struct {
			ID   uint64 `json:"id"`
			Name string `json:"name"`
		}
		if err := json.Unmarshal(data, &names); err != nil {
			return nil, err
		}
		m.mu.Lock()
		mp, ok := m.packs[names.ID]
		if !ok {
			m.mu.Unlock()
			return nil, ErrUnknownMusicPack
		}
		nName := names.Name
		names.Name = uniqueName(nName, func(name string) bool {
			_, ok := m.names[name]
			return !ok
		})
		np := &musicPack{
			Name:     names.Name,
			Tracks:   make([]musicTrack, len(mp.Tracks)),
			Volume:   mp.Volume,
			PlayTime: 0,
		}
		for n, t := range mp.Tracks {
			np.Tracks[n] = t
		}
		m.lastID++
		id := m.lastID
		m.packs[id] = np
		m.fileStore.Set(strconv.FormatUint(id, 10), np)
		m.mu.Unlock()
		data = appendString(append(strconv.AppendUint(append(data[:0], "{\"id\":"...), id, 10), ",\"name\":"...), names.Name)
		pos := len(data)
		data = append(strconv.AppendUint(append(data, ",\"newID\":"...), id, 10), '}')
		m.socket.broadcastMapChange(cd, broadcastMusicPackCopy, data, userAny)
		data = append(data[:pos], '}')
		return data, nil
	case "setVolume":
		var packData struct {
			ID     uint64 `json:"id"`
			Volume uint8  `json:"volume"`
		}
		if err := json.Unmarshal(data, &packData); err != nil {
			return nil, err
		}
		if err := m.getPack(packData.ID, func(mp *musicPack) bool {
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
			ID       uint64 `json:"id"`
			PlayTime uint64 `jons:"playTime"`
		}
		if err := json.Unmarshal(data, &packData); err != nil {
			return nil, err
		}
		if packData.PlayTime == 0 {
			packData.PlayTime = uint64(time.Now().Unix())
			data = json.RawMessage(append(strconv.AppendUint(append(strconv.AppendUint(append(data[:0], "{\"id\":"...), packData.ID, 10), ",\"playTime\":"...), packData.PlayTime, 10), '}'))
		}
		if err := m.getPack(packData.ID, func(mp *musicPack) bool {
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
		var packData uint64
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
			m.fileStore.Set(strconv.FormatUint(k, 10), p)
		}
		m.mu.Unlock()
		m.socket.broadcastMapChange(cd, broadcastMusicPackStopAll, data, userAny)
		return nil, nil
	case "addTracks":
		var trackData struct {
			ID     uint64   `json:"id"`
			Tracks []uint64 `json:"tracks"`
		}
		if err := json.Unmarshal(data, &trackData); err != nil {
			return nil, err
		}
		if err := m.getPack(trackData.ID, func(mp *musicPack) bool {
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
			ID    uint64 `json:"id"`
			Track uint   `json:"track"`
		}
		if err := json.Unmarshal(data, &trackData); err != nil {
			return nil, err
		}
		if err := m.getTrack(trackData.ID, trackData.Track, func(mp *musicPack, mt *musicTrack) bool {
			mp.Tracks = append(mp.Tracks[:trackData.Track], mp.Tracks[trackData.Track+1:]...)
			return true
		}); err != nil {
			return nil, err
		}
		m.socket.broadcastMapChange(cd, broadcastMusicPackTrackRemove, data, userAny)
		return nil, nil
	case "setTrackVolume":
		var trackData struct {
			ID     uint64 `json:"id"`
			Track  uint   `json:"track"`
			Volume uint8  `json:"volume"`
		}
		if err := json.Unmarshal(data, &trackData); err != nil {
			return nil, err
		}
		if err := m.getTrack(trackData.ID, trackData.Track, func(mp *musicPack, mt *musicTrack) bool {
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
			ID     uint64 `json:"id"`
			Track  uint   `json:"track"`
			Repeat int32  `json:"repeat"`
		}
		if err := json.Unmarshal(data, &trackData); err != nil {
			return nil, err
		}
		if err := m.getTrack(trackData.ID, trackData.Track, func(mp *musicPack, mt *musicTrack) bool {
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
