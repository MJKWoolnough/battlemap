package battlemap

import (
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"path/filepath"
	"strconv"
	"strings"
	"sync"

	"vimagination.zapto.org/byteio"
	"vimagination.zapto.org/keystore"
	"vimagination.zapto.org/memio"
)

type keystoreData struct {
	Admin bool            `json:"admin"`
	Data  json.RawMessage `json:"data"`
}

type keystoreMap map[string]keystoreData

func (k keystoreMap) ReadFrom(r io.Reader) (int64, error) {
	br := byteio.StickyLittleEndianReader{Reader: r}
	l := br.ReadUint64()
	for i := uint64(0); i < l; i++ {
		key := br.ReadString64()
		admin := br.ReadBool()
		data := make(json.RawMessage, br.ReadUint64())
		br.Read(data)
		k[key] = keystoreData{
			Admin: admin,
			Data:  data,
		}
	}
}

func (k keystoreMap) WriteTo(w io.Writer) (int64, error) {
	bw := byteio.StickyLittleEndianWriter{Writer: w}
	bw.WriteUint64(uint64(len(k)))
	for key, data := range k {
		bw.WriteString64(key)
		bw.WriteBool(data.Admin)
		bw.WriteUint64(uint64(len(data.Data)))
		bw.Write(data.Data)
	}
	return bw.Count, bw.Err
}

type keystoreDir struct {
	folders
	Name    string
	DirType uint8

	mu     sync.RWMutex
	nextID uint64
	data   *keystore.FileBackedMemStore
}

func (k *keystoreDir) cleanup(_ *Battlemap, id uint64) {
	var ms keystore.MemStore
	err := k.data.Get(strconv.FormatUint(id, 10), &ms)
	if err != nil {
		return
	}
	for _, key := range ms.Keys() {
		if f := k.IsLinkKey(key); f != nil {
			var oldVal keystore.String
			ms.Get(key, &oldVal)
			id, _ := strconv.ParseUint(string(oldVal[1:]), 10, 64)
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
	k.fileType = fileTypeCharacter
	k.folders.Init(b, fileStore, k.cleanup)
	return nil
}

func (k *keystoreDir) RPCData(cd ConnData, method string, data []byte) (interface{}, error) {
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

func (k *keystoreDir) create(cd ConnData, data []byte) (json.RawMessage, error) {
	var name string
	if err := json.Unmarshal(data, &name); err != nil {
		return nil, err
	}
	m := keystore.NewMemStore()
	k.mu.Lock()
	k.lastID++
	kid := k.lastID
	name = addItemTo(k.root.Items, name, kid)
	k.saveFolders()
	k.mu.Unlock()
	strID := strconv.FormatUint(kid, 10)
	k.data.Set(strID, m)
	k.Set(strconv.FormatUint(kid, 10), m)
	var buf memio.Buffer
	fmt.Fprintf(&buf, "[{\"id\":%d,\"name\":%q}]", kid, name)
	k.socket.broadcastAdminChange(k.getBroadcastID(broadcastCharacterItemAdd), json.RawMessage(buf), cd.ID)
	return json.RawMessage(buf[1 : len(buf)-1]), nil
}

func (k *keystoreDir) set(cd ConnData, data []byte) error {
	var m struct {
		ID   uint64            `json:"id"`
		Data map[string]string `json:"data"`
	}
	if err := json.Unmarshal(data, &m); err != nil {
		return err
	}
	var ms keystore.MemStore
	strID := strconv.FormatUint(m.ID, 10)
	err := k.data.Get(strID, &ms)
	if err != nil {
		return keystore.ErrUnknownKey
	}
	var buf memio.Buffer
	for key, val := range m.Data {
		if strings.HasPrefix(val, "0") {
			fmt.Fprintf(&buf, ",%q:%q", key, val[1:])
		} else if !strings.HasPrefix(val, "1") {
			val = "1" + val
		}
		if f := k.IsLinkKey(key); f != nil {
			if ms.Exists(key) {
				var oldVal keystore.String
				ms.Get(key, &oldVal)
				id, _ := strconv.ParseUint(string(oldVal[1:]), 10, 64)
				f.removeHiddenLink(id)
			}
			id, _ := strconv.ParseUint(string(val[1:]), 10, 64)
			f.setHiddenLink(id)
		}
		ms.Set(key, keystore.String(val))
	}
	k.socket.broadcastAdminChange(k.getBroadcastID(broadcastCharacterItemChange), data, cd.ID)
	k.socket.broadcastMapChange(cd, k.getBroadcastID(broadcastCharacterItemChange), json.RawMessage(buf))
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

func (k *keystoreDir) get(cd ConnData, data []byte) (json.RawMessage, error) {
	var m struct {
		ID   uint64   `json:"id"`
		Keys []string `json:"keys"`
	}
	if err := json.Unmarshal(data, &m); err != nil {
		return nil, err
	}
	var ms keystore.MemStore
	strID := strconv.FormatUint(m.ID, 10)
	err := k.data.Get(strID, &ms)
	if err != nil {
		return nil, keystore.ErrUnknownKey
	}
	if m.Keys == nil {
		m.Keys = ms.Keys()
	}
	var buf memio.Buffer
	for _, key := range m.Keys {
		var d keystore.String
		if err := ms.Get(key, &d); err == nil {
			if cd.IsAdmin() {
				fmt.Fprintf(&buf, ",%q:%q", key, d)
			} else if strings.HasPrefix(string(d), "0") {
				fmt.Fprintf(&buf, ",%q:%q", key, d[1:])
			}
		}
	}
	buf.WriteByte('}')
	buf[0] = '{'
	return json.RawMessage(buf), nil
}

func (k *keystoreDir) removeKeys(cd ConnData, data []byte) error {
	var m struct {
		ID   uint64   `json:"id"`
		Keys []string `json:"keys"`
	}
	if err := json.Unmarshal(data, &m); err != nil {
		return err
	}
	var ms keystore.MemStore
	strID := strconv.FormatUint(m.ID, 10)
	err := k.data.Get(strID, &ms)
	if err != nil {
		return keystore.ErrUnknownKey
	}
	for _, key := range m.Keys {
		if f := k.IsLinkKey(key); f != nil {
			if ms.Exists(key) {
				var val keystore.String
				ms.Get(key, &val)
				id, _ := strconv.ParseUint(string(val[1:]), 10, 64)
				f.removeHiddenLink(id)
			}
		}
	}
	ms.RemoveAll(m.Keys...)
	// TODO: broadcast
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
