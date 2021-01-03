package battlemap

import (
	"compress/gzip"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"path/filepath"
	"sync"

	"vimagination.zapto.org/byteio"
	"vimagination.zapto.org/keystore"
)

type musicTrack struct {
	ID     uint64 `json:"id"`
	Volume uint32 `json:"volume"`
	Repeat int32  `json:"repeat"`
}

type musicPack struct {
	Tracks   []musicTrack `json:"tracks"`
	Repeat   uint64       `json:"repeat"`
	PlayTime uint64       `json:"playTime"`
	Playing  bool         `json:"playing"`
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
			Volume: br.ReadUint32(),
			Repeat: br.ReadInt32(),
		}
	}
	m.Repeat = br.ReadUint64()
	m.PlayTime = br.ReadUint64()
	m.Playing = br.ReadBool()
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
		bw.WriteUint32(t.Volume)
		bw.WriteInt32(t.Repeat)
	}
	bw.WriteUint64(m.Repeat)
	bw.WriteUint64(m.PlayTime)
	bw.WriteBool(m.Playing)
	g.Close()
	return bw.Count, bw.Err
}

type musicPacksDir struct {
	*Battlemap
	fileStore *keystore.FileStore

	mu    sync.RWMutex
	packs map[string]*musicPack
}

func (m *musicPacksDir) Init(b *Battlemap) error {
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
	}
	return nil
}

func (*musicPacksDir) Cleanup() {}

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

func (m *musicPacksDir) RPCData(cd ConnData, method string, data json.RawMessage) (interface{}, error) {
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
		name = uniqueName(name, func(name string) bool {
			if _, ok := m.packs[name]; !ok {
				data = appendString(data[:0], name)
				return true
			}
			return false
		})
		p := new(musicPack)
		m.packs[name] = p
		err := m.fileStore.Set(name, p)
		m.mu.Unlock()
		if err != nil {
			return nil, err
		}
		return data, nil
	}
	return nil, ErrUnknownMethod
}

// errors
var (
	ErrUnknownMusicPack = errors.New("unknown music pack")
)
