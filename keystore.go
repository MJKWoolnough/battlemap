package battlemap

import (
	"compress/gzip"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"path/filepath"
	"strconv"
	"strings"

	"vimagination.zapto.org/byteio"
	"vimagination.zapto.org/keystore"
)

type keystoreData struct {
	User bool            `json:"user"`
	Data json.RawMessage `json:"data"`
}

type keystoreMap map[string]keystoreData

func (k keystoreMap) ReadFrom(r io.Reader) (int64, error) {
	g, err := gzip.NewReader(r)
	if err != nil {
		return 0, err
	}
	br := byteio.StickyLittleEndianReader{Reader: g}
	l := br.ReadUint64()
	for i := uint64(0); i < l; i++ {
		key := br.ReadString64()
		user := br.ReadBool()
		data := br.ReadBytes64()
		k[key] = keystoreData{
			User: user,
			Data: data,
		}
	}
	return br.Count, br.Err
}

func (k keystoreMap) WriteTo(w io.Writer) (int64, error) {
	g, err := gzip.NewWriterLevel(w, gzip.BestCompression)
	if err != nil {
		return 0, err
	}
	bw := byteio.StickyLittleEndianWriter{Writer: g}
	bw.WriteUint64(uint64(len(k)))
	for key, data := range k {
		bw.WriteString64(key)
		bw.WriteBool(data.User)
		bw.WriteBytes64(data.Data)
	}
	g.Close()
	return bw.Count, bw.Err
}

type keystoreDir struct {
	folders
	Name    string
	DirType uint8

	data *keystore.FileBackedMemStore
}

func (k *keystoreDir) cleanup(_ *Battlemap, id uint64) {
	ms := make(keystoreMap)
	err := k.data.Get(strconv.FormatUint(id, 10), ms)
	if err != nil {
		return
	}
	for key, data := range ms {
		if f := k.IsLinkKey(key); f != nil {
			var id uint64
			json.Unmarshal(data.Data, &id)
			f.removeHiddenLink(id)
		}
	}
}

func (k *keystoreDir) Init(b *Battlemap) error {
	var location keystore.String
	err := b.config.Get(k.Name+"Dir", &location)
	if err != nil {
		return fmt.Errorf("error retrieving keystore location: %w", err)
	}
	sp := filepath.Join(b.config.BaseDir, string(location))
	fileStore, err := keystore.NewFileStore(sp, sp, keystore.NoMangle)
	if err != nil {
		return fmt.Errorf("error creating keystore: %w", err)
	}
	k.data = keystore.NewFileBackedMemStoreFromFileStore(fileStore)
	k.fileType = fileTypeKeystore
	k.folders.Init(b, fileStore, k.cleanup)
	return nil
}

func (k *keystoreDir) RPCData(cd ConnData, method string, data json.RawMessage) (interface{}, error) {
	switch method {
	case "create":
		return k.create(cd, data)
	case "set":
		return nil, k.set(cd, data)
	case "get":
		return k.get(cd, data)
	case "removeKeys":
		return nil, k.removeKeys(cd, data)
	default:
		return k.folders.RPCData(cd, method, data)
	}
}

func (k *keystoreDir) create(cd ConnData, data json.RawMessage) (json.RawMessage, error) {
	var name string
	if err := json.Unmarshal(data, &name); err != nil {
		return nil, err
	}
	m := make(keystoreMap)
	k.mu.Lock()
	k.lastID++
	kid := k.lastID
	name = addItemTo(k.root.Items, name, kid)
	k.saveFolders()
	k.mu.Unlock()
	strID := strconv.FormatUint(kid, 10)
	k.data.Set(strID, m)
	k.Set(strconv.FormatUint(kid, 10), m)
	buf := append(appendString(append(strconv.AppendUint(append(json.RawMessage{}, "[{\"id\":"...), kid, 10), ",\"name\":"...), name), '}', ']')
	k.socket.broadcastAdminChange(k.getBroadcastID(broadcastCharacterItemAdd), buf, cd.ID)
	return buf[1 : len(buf)-1], nil
}

func (k *keystoreDir) set(cd ConnData, data json.RawMessage) error {
	var m struct {
		ID   uint64                  `json:"id"`
		Data map[string]keystoreData `json:"data"`
	}
	if err := json.Unmarshal(data, &m); err != nil {
		return err
	}
	if len(m.Data) == 0 {
		return nil
	}
	ms := make(keystoreMap)
	strID := strconv.FormatUint(m.ID, 10)
	err := k.data.Get(strID, ms)
	if err != nil {
		return keystore.ErrUnknownKey
	}
	k.socket.broadcastAdminChange(k.getBroadcastID(broadcastCharacterDataChange), data, cd.ID)
	buf := append(data[:0], "{\"data\":"...)
	for key, val := range m.Data {
		if val.User {
			buf = append(append(appendString(append(buf, ','), key), ':'), val.Data...)
		}
		if f := k.IsLinkKey(key); f != nil {
			var id uint64
			if oldVal, ok := ms[key]; ok {
				json.Unmarshal(oldVal.Data, &id)
				f.removeHiddenLink(id)
			}
			json.Unmarshal(val.Data, &id)
			f.setHiddenLink(id)
		}
		ms[key] = val
	}
	if len(buf) > 8 {
		buf[8] = '{'
		buf = append(strconv.AppendUint(append(buf, "},\"id\":"...), m.ID, 10), '}')
		if k.DirType == keystoreCharacter {
			cd.CurrentMap = 0
		}
		k.socket.broadcastMapChange(cd, k.getBroadcastID(broadcastCharacterDataChange), buf)
	}
	return k.data.Set(strID, &ms)
}

func (k *keystoreDir) IsLinkKey(key string) *folders {
	if strings.HasPrefix(key, "store-image") {
		return &k.images.folders
	} else if strings.HasPrefix(key, "store-audio") {
		return &k.sounds.folders
	} else if strings.HasPrefix(key, "store-token") {
		return &k.tokens.folders
	} else if strings.HasPrefix(key, "store-character") {
		return &k.chars.folders
	}
	return nil
}

func (k *keystoreDir) get(cd ConnData, data json.RawMessage) (json.RawMessage, error) {
	var m struct {
		ID   uint64   `json:"id"`
		Keys []string `json:"keys"`
	}
	if err := json.Unmarshal(data, &m); err != nil {
		return nil, err
	}
	ms := make(keystoreMap)
	strID := strconv.FormatUint(m.ID, 10)
	err := k.data.Get(strID, &ms)
	if err != nil {
		return nil, keystore.ErrUnknownKey
	}
	var buf json.RawMessage
	if m.Keys == nil {
		for key, val := range ms {
			if cd.IsAdmin() {
				buf = append(append(append(strconv.AppendBool(append(appendString(append(buf, ','), key), ":{\"user\":"...), val.User), ",\"data\":"...), val.Data...), '}')
			} else if val.User {
				buf = append(append(appendString(append(buf, ','), key), ':'), val.Data...)
			}
		}
	} else {
		for _, key := range m.Keys {
			if val, ok := ms[key]; ok {
				if cd.IsAdmin() {
					buf = append(append(append(strconv.AppendBool(append(appendString(append(buf, ','), key), ":{\"user\":"...), val.User), ",\"data\":"...), val.Data...), '}')
				} else if val.User {
					buf = append(append(appendString(append(buf, ','), key), ':'), val.Data...)
				}
			}
		}
	}
	if len(buf) == 0 {
		buf = json.RawMessage{'{', '}'}
	} else {
		buf[0] = '{'
		buf = append(buf, '}')
	}
	return buf, nil
}

func (k *keystoreDir) removeKeys(cd ConnData, data json.RawMessage) error {
	var m struct {
		ID   uint64   `json:"id"`
		Keys []string `json:"keys"`
	}
	if err := json.Unmarshal(data, &m); err != nil {
		return err
	}
	if len(m.Keys) == 0 {
		return nil
	}
	ms := make(keystoreMap)
	strID := strconv.FormatUint(m.ID, 10)
	err := k.data.Get(strID, &ms)
	if err != nil {
		return keystore.ErrUnknownKey
	}
	k.socket.broadcastAdminChange(k.getBroadcastID(broadcastCharacterDataRemove), data, cd.ID)
	buf := append(data[:0], "{\"keys\":"...)
	for _, key := range m.Keys {
		val, ok := ms[key]
		if !ok {
			continue
		}
		if val.User {
			buf = appendString(append(buf, ','), key)
		}
		if f := k.IsLinkKey(key); f != nil {
			var id uint64
			json.Unmarshal(val.Data, &id)
			f.removeHiddenLink(id)
		}
		delete(ms, key)
	}
	if len(buf) > 8 {
		buf[8] = '['
		buf = append(strconv.AppendUint(append(buf, "],\"id\":"...), m.ID, 10), '}')
		if k.DirType == keystoreCharacter {
			cd.CurrentMap = 0
		}
		k.socket.broadcastMapChange(cd, k.getBroadcastID(broadcastCharacterDataRemove), buf)
	}
	return k.data.Set(strID, &ms)
}

const (
	keystoreCharacter uint8 = iota
	keystoreToken
)

func (k *keystoreDir) getBroadcastID(base int) int {
	switch k.DirType {
	case keystoreToken:
		return base - 1
	}
	return base
}

// Errors
var (
	ErrDuplicateKey = errors.New("duplicate key")
)
