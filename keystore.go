package battlemap

import (
	"encoding/json"
	"errors"
	"fmt"
	"path/filepath"
	"strconv"
	"sync"

	"vimagination.zapto.org/keystore"
	"vimagination.zapto.org/memio"
)

type keystoreDir struct {
	folders
	Name   string
	Socket uint8

	mu     sync.RWMutex
	nextID uint64
	data   *keystore.FileBackedMemStore
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
	k.folders.Init(b, fileStore)
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
	k.socket.broadcastAdminChange(broadcastCharacterItemAdd, json.RawMessage(buf), cd.ID)
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
	for key, val := range m.Data {
		ms.Set(key, keystore.String(val))
	}
	// TODO: broadcast
	return k.data.Set(strID, &ms)
}

func (k *keystoreDir) get(cd ConnData, data []byte) (map[string]string, error) {
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
	kvs := make(map[string]string, len(m.Keys))
	for _, key := range m.Keys {
		var d keystore.String
		if err := ms.Get(key, &d); err == nil {
			kvs[key] = string(d)
		}
	}
	return kvs, nil
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
	ms.RemoveAll(m.Keys...)
	// TODO: broadcast
	return k.data.Set(strID, &ms)
}

type userKeystoreDir struct {
	keystoreDir
}

// Errors
var (
	ErrDuplicateKey = errors.New("duplicate key")
)
