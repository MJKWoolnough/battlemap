package main

import (
	"fmt"
	"html/template"
	"net/http"
	"path/filepath"
	"sort"
	"strconv"
	"strings"
	"sync"

	"vimagination.zapto.org/errors"
	"vimagination.zapto.org/keystore"
)

type mapsDir struct {
	DefaultMethods

	store *keystore.FileStore

	mu               sync.RWMutex
	maps             map[uint64]*Map
	order            Maps
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
	stat, err := m.store.Stat("")
	if err != nil {
		return errors.WithContext("error getting map directory stat: ", err)
	}
	t := stat.ModTime()
	keys := m.store.Keys()
	m.maps = make(map[uint64]*Map, len(keys))
	m.order = make(Maps, 0, len(keys))
	for _, key := range keys {
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
		m.order = append(m.order, mp)
	}
	sort.Sort(m.order)
	genPages(t, m.order, mapsTemplate, "index", "maps", "map", &m.indexes)
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
				<tr><th>ID</th><th>Name</th></tr>
			</thead>
			<tbody>
{{range .}}				<tr><td>{{.ID}}</td><td>{{.Name}}</td></tr>
{{end}}			</tbody>
		</table>
	</body>
</html>`))

func (m *mapsDir) RPC(cd ConnData, method string, data []byte) (interface{}, error) {
	switch strings.TrimPrefix(method, "maps.") {
	case "getCurrentMap":
		return cd.CurrentMap, nil
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
