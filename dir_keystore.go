package battlemap

import (
	"encoding/json"
	"path/filepath"
	"strconv"
	"sync"

	"vimagination.zapto.org/errors"
	"vimagination.zapto.org/keystore"
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
		return errors.WithContext("error retrieving keystore location: ", err)
	}
	sp := filepath.Join(b.config.BaseDir, string(location))
	fileStore, err := keystore.NewFileStore(sp, sp, keystore.Base64Mangler)
	if err != nil {
		return errors.WithContext("error creating keystore: ", err)
	}
	k.data = keystore.NewFileBackedMemStoreFromFileStore(fileStore)
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
	case "remove":
		return nil, k.remove(cd, data)
	case "delete":
		return nil, k.delete(cd, data)
	default:
		return k.folders.RPCData(cd, method, data)
	}
}

func (k *keystoreDir) create(cd ConnData, data []byte) (idName, error) {
	var name string
	if err := json.Unmarshal(data, &name); err != nil {
		return idName{}, err
	}
	m := keystore.NewMemStore()
	k.mu.Lock()
	k.lastID++
	kid := k.lastID
	name = addItemTo(k.root.Items, name, kid)
	k.mu.Unlock()
	strID := strconv.FormatUint(kid, 10)
	k.data.Set(strID, m)
	k.Set(strconv.FormatUint(kid, 10), m)
	// TODO: broadcast
	return idName{
		ID:   kid,
		Name: name,
	}, nil
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

func (k *keystoreDir) remove(cd ConnData, data []byte) error {
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

func (k *keystoreDir) delete(cd ConnData, data []byte) error {
	var id uint64
	if err := json.Unmarshal(data, &id); err != nil {
		return err
	}
	// TODO: broadcast
	return k.data.Remove(strconv.FormatUint(id, 10))
}

type userKeystoreDir struct {
	keystoreDir
}

const (
	ErrDuplicateKey errors.Error = "duplicate key"
)
