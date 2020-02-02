package battlemap

import (
	"bufio"
	"encoding/json"
	"encoding/xml"
	"fmt"
	"net/http"
	"path/filepath"
	"strconv"
	"strings"
	"sync"

	"vimagination.zapto.org/errors"
	"vimagination.zapto.org/httpaccept"
	"vimagination.zapto.org/keystore"
)

type keystoreDir struct {
	*Battlemap
	DefaultMethods
	Name   string
	Socket uint8
	prefix string
	store  *keystore.FileStore

	mu     sync.RWMutex
	nextID uint64
	data   map[uint64]*keystore.MemStore
}

func (k *keystoreDir) Init(b *Battlemap) error {
	k.prefix = strings.ToLower(k.Name) + "."
	var location keystore.String
	err := b.config.Get(k.Name+"Dir", &location)
	if err != nil {
		return errors.WithContext("error retrieving keystore location: ", err)
	}
	sp := filepath.Join(b.config.BaseDir, string(location))
	k.store, err = keystore.NewFileStore(sp, sp, keystore.Base64Mangler)
	if err != nil {
		return errors.WithContext("error creating keystore: ", err)
	}
	k.data = make(map[uint64]*keystore.MemStore)
	var largestID uint64
	for _, key := range k.store.Keys() {
		id, err := strconv.ParseUint(key, 10, 0)
		if err != nil {
			continue
		}
		if _, ok := k.data[id]; ok {
			return ErrDuplicateKey
		}
		var s *keystore.MemStore
		if err := k.store.Get(key, s); err != nil {
			return errors.WithContext("error reading memstore: ", err)
		}
		k.data[id] = s
		if id > largestID {
			largestID = id
		}
	}
	k.nextID = largestID + 1
	k.Battlemap = b
	return nil
}

func (k *keystoreDir) Options(w http.ResponseWriter, r *http.Request) {
	if !k.auth.IsAdmin(r) {
		http.Error(w, http.StatusText(http.StatusForbidden), http.StatusForbidden)
	} else if isRoot(r.URL.Path) {
		w.Header().Set("Allow", "OPTIONS, GET, HEAD, POST")
	} else if idStr := strings.TrimLeft(strings.TrimPrefix(r.URL.Path, "/"), "0"); !k.store.Exists(idStr) {
		http.NotFound(w, r)
	} else {
		w.Header().Set("Allow", "OPTIONS, GET, HEAD, POST, PATCH, DELETE")
		w.Header().Set("Accept-Patch", "application/json, text/plain, text/xml")
	}
}

func (k *keystoreDir) Get(w http.ResponseWriter, r *http.Request) bool {
	if !k.auth.IsAdmin(r) {
		http.Error(w, http.StatusText(http.StatusForbidden), http.StatusForbidden)
		return true
	}
	k.handleGet(w, r)
	return true
}

func (k *keystoreDir) handleGet(w http.ResponseWriter, r *http.Request) {
	if isRoot(r.URL.Path) {
		w.WriteHeader(http.StatusNoContent)
	} else if idStr := strings.TrimLeft(strings.TrimPrefix(r.URL.Path, "/"), "0"); !k.store.Exists(idStr) {
		http.NotFound(w, r)
	} else {
		id, err := strconv.ParseUint(idStr, 10, 0)
		if err != nil {
			http.Error(w, err.Error(), http.StatusBadRequest)
			return
		}
		k.printStore(w, r, id, nil, "")
	}
}

func (k *keystoreDir) Post(w http.ResponseWriter, r *http.Request) bool {
	if !k.auth.IsAdmin(r) {
		http.Error(w, http.StatusText(http.StatusForbidden), http.StatusForbidden)
		return true
	} else if isRoot(r.URL.Path) {
		var at AcceptType
		httpaccept.HandleAccept(r, &at)
		format := "%d"
		switch at {
		case "txt":
			w.Header().Set(contentType, "text/plain")
		case "json":
			w.Header().Set(contentType, "application/json")
		case "xml":
			w.Header().Set(contentType, "text/xml")
			format = "<id>%d</id>"
		}
		fmt.Fprintf(w, format, k.create())
	} else {
		k.handlePost(w, r)
	}
	return true
}

func (k *keystoreDir) handlePost(w http.ResponseWriter, r *http.Request) {
	if idStr := strings.TrimLeft(strings.TrimPrefix(r.URL.Path, "/"), "0"); k.store.Exists(idStr) {
		id, err := strconv.ParseUint(idStr, 10, 0)
		if err != nil {
			http.Error(w, err.Error(), http.StatusBadRequest)
			return
		}
		var (
			at   AcceptType
			keys []string
		)
		switch r.Header.Get(contentType) {
		case "application/json", "text/json", "text/x-json":
			at = "json"
			err := json.NewDecoder(r.Body).Decode(&keys)
			r.Body.Close()
			if err != nil {
				http.Error(w, err.Error(), http.StatusBadRequest)
				return
			}
		case "text/xml":
			at = "xml"
			var d struct {
				Keys []string `xml:"key"`
			}
			err := xml.NewDecoder(r.Body).DecodeElement(&d, nil)
			r.Body.Close()
			if err != nil {
				http.Error(w, err.Error(), http.StatusBadRequest)
				return
			}
			keys = d.Keys
		default:
			br := bufio.NewReader(r.Body)
			for {
				key, err := br.ReadString('\n')
				if err != nil {
					break
				}
				keys = append(keys, key)
			}
			r.Body.Close()
		}
		k.printStore(w, r, id, keys, at)
	} else {
		http.NotFound(w, r)
	}
}

func (k *keystoreDir) printStore(w http.ResponseWriter, r *http.Request, id uint64, keys []string, at AcceptType) {
	values, err := k.get(id, keys)
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	httpaccept.HandleAccept(r, &at)
	switch at {
	case "json":
		w.Header().Set(contentType, "application/json")
		json.NewEncoder(w).Encode(values)
	case "xml":
		w.Header().Set(contentType, "text/xml")
		type kd struct {
			Key   string `xml:"key,attr"`
			Value string `xml:",chardata"`
		}
		v := struct {
			Data []kd `xml:"datum"`
		}{
			make([]kd, len(values)),
		}
		for key, value := range values {
			v.Data = append(v.Data, kd{key, value})
		}
		xml.NewEncoder(w).EncodeElement(v, xml.StartElement{Name: xml.Name{Local: "data"}})
	default:
		w.Header().Set(contentType, "text/plain")
		for key, val := range values {
			if _, err := fmt.Fprintf(w, "%q=%q", key, val); err != nil {
				break
			}
		}
	}
}

func (k *keystoreDir) Patch(w http.ResponseWriter, r *http.Request) bool {
	if !k.auth.IsAdmin(r) {
		http.Error(w, http.StatusText(http.StatusForbidden), http.StatusForbidden)
	} else if isRoot(r.URL.Path) {
		return false
	} else if idStr := strings.TrimLeft(strings.TrimPrefix(r.URL.Path, "/"), "0"); !k.store.Exists(idStr) {
		http.NotFound(w, r)
	} else {
		id, err := strconv.ParseUint(idStr, 10, 0)
		if err != nil {
			http.Error(w, err.Error(), http.StatusBadRequest)
			return true
		}
		switch r.Header.Get(contentType) {
		case "application/json", "text/json", "text/x-json":
			var p struct {
				Remove []string          `json:"remove"`
				Set    map[string]string `json:"set"`
			}
			json.NewDecoder(r.Body).Decode(&p)
			r.Body.Close()
			k.remove(id, p.Remove)
			k.set(id, p.Set)
		case "text/xml":
			var p struct {
				Remove []string `xml:"remove"`
				Set    []struct {
					Key   string `xml:"key,attr"`
					Value string `xml:",chardata"`
				} `xml:"set"`
			}
			xml.NewDecoder(r.Body).DecodeElement(&p, nil)
			r.Body.Close()
			sets := make(map[string]string, len(p.Set))
			for _, s := range p.Set {
				sets[s.Key] = s.Value
			}
			k.remove(id, p.Remove)
			k.set(id, sets)
		case "application/x-www-form-urlencoded":
			r.ParseForm()
			k.remove(id, r.PostForm["~"])
			sets := make(map[string]string, len(r.PostForm))
			for k := range r.PostForm {
				if k == "~" {
					continue
				}
				sets[k] = r.PostForm.Get(k)
			}
			k.set(id, sets)
		default:
			remove := make([]string, 0, 32)
			sets := make(map[string]string)
			br := bufio.NewReader(r.Body)
			var (
				method     byte
				key, value string
			)
		Loop:
			for {
				switch method, _ = br.ReadByte(); method {
				case '=':
					fmt.Fscanf(br, "%q=%q", &key, &value)
					sets[key] = value
				case '~':
					fmt.Fscanf(br, "%q", &key)
					remove = append(remove, key)
				case '\n':
				default:
					break Loop
				}
			}
			r.Body.Close()
			k.remove(id, remove)
			k.set(id, sets)
		}
		w.WriteHeader(http.StatusNoContent)
	}
	return true
}

func (k *keystoreDir) Delete(w http.ResponseWriter, r *http.Request) bool {
	id, err := strconv.ParseUint(strings.TrimPrefix(r.URL.Path, "/"), 10, 0)
	if err != nil {
		http.NotFound(w, r)
	} else if err = k.delete(id); err != nil {
		http.NotFound(w, r)
	} else {
		w.WriteHeader(http.StatusNoContent)
	}
	return true
}

func (k *keystoreDir) RPCData(cd ConnData, method string, data []byte) (interface{}, error) {
	if cd.ID > 0 {
		switch strings.TrimPrefix(method, k.prefix) {
		case "create":
			return k.create(), nil
		case "set":
			var m struct {
				ID   uint64            `json:"id"`
				Data map[string]string `json:"data"`
			}
			if err := json.Unmarshal(data, &m); err != nil {
				return nil, err
			}
			return nil, k.set(m.ID, m.Data)
		case "get":
			var m struct {
				ID   uint64   `json:"id"`
				Keys []string `json:"keys"`
			}
			if err := json.Unmarshal(data, &m); err != nil {
				return nil, err
			}
			return k.get(m.ID, m.Keys)
		case "remove":
			var m struct {
				ID   uint64   `json:"id"`
				Keys []string `json:"keys"`
			}
			if err := json.Unmarshal(data, &m); err != nil {
				return nil, err
			}
			k.remove(m.ID, m.Keys)
			return nil, nil
		case "delete":
			var m uint64
			if err := json.Unmarshal(data, &m); err != nil {
				return nil, err
			}
			return nil, k.delete(m)
		}
	}
	return nil, ErrUnknownMethod
}

func (k *keystoreDir) create() uint64 {
	m := keystore.NewMemStore()
	k.mu.Lock()
	kid := k.nextID
	k.nextID++
	k.data[kid] = m
	k.mu.Unlock()
	k.store.Set(strconv.FormatUint(kid, 10), m)
	return kid
}

func (k *keystoreDir) set(id uint64, data map[string]string) error {
	k.mu.RLock()
	s, ok := k.data[id]
	k.mu.RUnlock()
	if !ok {
		return keystore.ErrUnknownKey
	}
	for key, val := range data {
		s.Set(key, keystore.String(val))
	}
	return k.store.Set(strconv.FormatUint(id, 10), s)
}

func (k *keystoreDir) get(id uint64, keys []string) (map[string]string, error) {
	k.mu.RLock()
	s, ok := k.data[id]
	k.mu.RUnlock()
	if !ok {
		return nil, keystore.ErrUnknownKey
	}
	if keys == nil {
		keys = s.Keys()
	}
	data := make(map[string]string, len(keys))
	for _, key := range keys {
		var d keystore.String
		if err := s.Get(key, &d); err == nil {
			data[key] = string(d)
		}
	}
	return data, nil
}

func (k *keystoreDir) remove(id uint64, keys []string) error {
	k.mu.RLock()
	s, ok := k.data[id]
	k.mu.RUnlock()
	if !ok {
		return keystore.ErrUnknownKey
	}
	s.RemoveAll(keys...)
	return k.store.Set(strconv.FormatUint(id, 10), s)
}

func (k *keystoreDir) delete(id uint64) error {
	k.mu.Lock()
	_, ok := k.data[id]
	if !ok {
		k.mu.Unlock()
		return keystore.ErrUnknownKey
	}
	delete(k.data, id)
	k.mu.Unlock()
	return k.store.Remove(strconv.FormatUint(id, 10))
}

type userKeystoreDir struct {
	keystoreDir
}

func (u *userKeystoreDir) Options(w http.ResponseWriter, r *http.Request) {
	if idStr := strings.TrimLeft(strings.TrimPrefix(r.URL.Path, "/"), "0"); u.store.Exists(idStr) && !u.auth.IsAdmin(r) {
		w.Header().Set("Allow", "OPTIONS, GET, HEAD, POST")
	} else {
		u.keystoreDir.Options(w, r)
	}
}

func (u *userKeystoreDir) Get(w http.ResponseWriter, r *http.Request) bool {
	u.handleGet(w, r)
	return true
}

func (u *userKeystoreDir) Post(w http.ResponseWriter, r *http.Request) bool {
	u.handlePost(w, r)
	return true
}

const (
	ErrDuplicateKey errors.Error = "duplicate key"
)
