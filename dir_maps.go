package main

import (
	"fmt"
	"html/template"
	"net/http"
	"path/filepath"
	"strconv"
	"strings"
	"sync"

	"vimagination.zapto.org/errors"
	"vimagination.zapto.org/httpaccept"
	"vimagination.zapto.org/keystore"
)

type mapsDir struct {
	DefaultMethods

	store *keystore.FileStore

	mu               sync.RWMutex
	maps             Maps
	nextID           uint64
	handler, indexes http.Handler
}

func (m *mapsDir) Init() error {
	var location keystore.String
	err := Config.Get("MapsDir", &location)
	if err != nil {
		return errors.WithContext("error getting map directory: ", err)
	}
	sp := filepath.Join(Config.BaseDir, string(location))
	m.store, err = keystore.NewFileStore(sp, sp, keystore.NoMangle)
	if err != nil {
		return errors.WithContext("error creating map store: ", err)
	}
	m.maps = make(Maps)
	stat, err := m.store.Stat("")
	if err != nil {
		return errors.WithContext("error getting map directory stat: ", err)
	}
	t := stat.ModTime()
	for _, key := range m.store.Keys() {
		id, err := strconv.ParseUint(key, 10, 0)
		if err != nil {
			continue
		}
		if _, ok := m.maps[id]; ok {
			continue
		}
		stat, err = m.store.Stat(key)
		if err != nil {
			return errors.WithContext("error getting map stat: ", err)
		}
		mt := stat.ModTime()
		if t.Before(mt) {
			t = mt
		}
		mp := new(Map)
		if err = m.store.Get(key, mp); err != nil {
			return errors.WithContext(fmt.Sprintf("error reading map data (%q): ", key), err)
		}
		if id != mp.ID {
			return MapIDError{id, mp.ID}
		}
		m.maps[id] = mp
	}
	genPages(t, m.maps, mapsTemplate, "index", "maps", "map", &m.indexes)
	m.handler = http.FileServer(http.Dir(sp))
	return nil
}

var mapsTemplate = template.Must(template.New("").Parse(`<!DOCTYPE html>
<html>
	<head>
		<title>Maps</title>
	</head>
	<body>
		<table>
			<thead>
				<tr><th>ID</th><th>Order</th><th>Name</th></tr>
			</thead>
			<tbody>
{{range .}}				<tr><td>{{.ID}}</td><td>{{.Order}}</td><td>{{.Name}}</td></tr>
{{end}}			</tbody>
		</table>
	</body>
</html>`))

func (m *mapsDir) Options(w http.ResponseWriter, r *http.Request) {
	if Auth.IsAdmin(r) {
		if isRoot(r.URL.Path) {
			w.Header().Set("Allow", "OPTIONS, GET, HEAD, POST")
		} else if m.store.Exists(strings.TrimPrefix(r.URL.Path, "/")) {
			var currentUserMap keystore.Uint
			Config.Get("currentUserMap", &currentUserMap)
			id, _ := strconv.ParseUint(strings.TrimPrefix(r.URL.Path, "/"), 10, 0)
			if id == uint64(currentUserMap) {
				w.Header().Set("Allow", "OPTIONS, GET, HEAD, PATCH")
			} else {
				w.Header().Set("Allow", "OPTIONS, GET, HEAD, PATCH, DELETE")
			}
		} else {
			http.NotFound(w, r)
		}
	} else {
		var currentUserMap keystore.Uint
		Config.Get("currentUserMap", &currentUserMap)
		id, _ := strconv.ParseUint(strings.TrimPrefix(r.URL.Path, "/"), 10, 0)
		if id == uint64(currentUserMap) {
			w.Header().Set("Allow", "OPTIONS, GET, HEAD")
		} else {
			http.Error(w, http.StatusText(http.StatusForbidden), http.StatusForbidden)
		}
	}
}

func (m *mapsDir) Get(w http.ResponseWriter, r *http.Request) bool {
	if Auth.IsAdmin(r) {
		if isRoot(r.URL.Path) {
			at := AcceptType("html")
			httpaccept.HandleAccept(r, &at)
			r.URL.Path += "index." + string(at)
			m.mu.RLock()
			m.indexes.ServeHTTP(w, r)
			m.mu.RUnlock()
		} else {
			m.handler.ServeHTTP(w, r)
		}
	} else {
		var currentUserMap keystore.Uint
		Config.Get("currentUserMap", &currentUserMap)
		id, _ := strconv.ParseUint(strings.TrimPrefix(r.URL.Path, "/"), 10, 0)
		if id == uint64(currentUserMap) {
			m.handler.ServeHTTP(w, r)
		} else {
			http.Error(w, http.StatusText(http.StatusForbidden), http.StatusForbidden)
		}
	}
	return true
}

func (m *mapsDir) Delete(w http.ResponseWriter, r *http.Request) bool {
	if !Auth.IsAdmin(r) || isRoot(r.URL.Path) {
		return false
	}
	key := strings.TrimPrefix(r.URL.Path, "/")
	var currentUserMap keystore.Uint
	Config.Get("currentUserMap", &currentUserMap)
	id, _ := strconv.ParseUint(key, 10, 0)
	if id == uint64(currentUserMap) {
		return false
	}
	m.mu.Lock()
	delete(m.maps, id)
	m.mu.Unlock()
	m.store.Remove(key)
	w.WriteHeader(http.StatusNoContent)
	return true
}

type CurrentMap uint64

func (c CurrentMap) RPC(method string, data []byte) (interface{}, error) {
	switch strings.TrimPrefix(method, "maps.") {
	case "getCurrentMap":
		return c, nil
	}
	return nil, ErrUnknownMethod
}

var MapsDir mapsDir

type MapIDError struct {
	KeyID, ParsedID uint64
}

func (m MapIDError) Error() string {
	return fmt.Sprintf("Key ID and Parsed ID do not match: %d, %d", m.KeyID, m.ParsedID)
}
