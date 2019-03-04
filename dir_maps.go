package main

import (
	"fmt"
	"html/template"
	"net/http"
	"path/filepath"
	"sort"
	"strconv"
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

type newMap struct {
	Width         uint64 `json:"width" xml:"width,attr"`
	Height        uint64 `json:"height" xml:"height,attr"`
	SquaresWidth  uint64 `json:"square" xml:"square,attr"`
	SquaresColour Colour `json:"colour" xml:"colour,attr"`
	SquaresStroke uint64 `json:"stroke" xml:"stroke,attr"`
	Name          string `json:"name" xml:",chardata"`
}

func (m *mapsDir) newMap(nm newMap) (uint64, error) {
	if nm.Width == 0 || nm.Height == 0 {
		return 0, errors.Error("invalid dimensions")
	}
	m.mu.Lock()
	id := m.nextID
	m.nextID++
	if nm.Name == "" {
		nm.Name = "Map " + strconv.FormatUint(id, 10)
	}
	var order int64
	if len(m.order) == 0 {
		order = 1
	} else {
		order = m.order[len(m.order)-1].Order + 1
	}
	mp := &Map{
		ID:     id,
		Name:   nm.Name,
		Order:  order,
		Width:  nm.Width,
		Height: nm.Height,
		Patterns: []Pattern{
			genGridPattern(nm.SquaresWidth, nm.SquaresColour, nm.SquaresStroke),
		},
		Layers: Layers{
			&Layer{
				ID:   "Layer_1",
				Name: "Layer",
			},
			&Layer{
				ID:   "Light",
				Name: "Light",
				Tokens: Tokens{
					&Token{
						Source:    "rgba(0, 0, 0, 0)",
						TokenType: tokenRect,
					},
				},
			},
			&Layer{
				ID:   "Grid",
				Name: "Grid",
				Tokens: Tokens{
					&Token{
						Source:    "gridPattern",
						TokenType: tokenPattern,
					},
				},
			},
		},
	}
	m.maps[id] = mp
	m.order = append(m.order, mp)
	m.mu.Unlock()
	m.store.Set(strconv.FormatUint(id, 10), mp)
	return id, nil
}

func genGridPattern(squaresWidth uint64, squaresColour Colour, squaresStroke uint64) Pattern {
	return Pattern{
		ID:     "gridPattern",
		Width:  squaresWidth,
		Height: squaresWidth,
		Path: &Path{
			Path:        genGridPath(squaresWidth),
			Stroke:      squaresColour,
			StrokeWidth: squaresStroke,
		},
	}
}

func genGridPath(squaresWidth uint64) string {
	sqStr := strconv.FormatUint(squaresWidth, 10)
	return "M 0 " + sqStr + " V 0 H " + sqStr
}

func (m *mapsDir) updateMapData(id uint64, fn func(*Map) bool) error {
	m.mu.Lock()
	mp, ok := m.maps[id]
	if ok {
		if fn(mp) {
			m.store.Set(strconv.FormatUint(id, 10), mp)
		}
	}
	m.mu.Unlock()
	if !ok {
		return ErrUnknownMap
	}
	return nil
}

func (m *mapsDir) updateMapLayer(mid, lid uint64, fn func(*Map, *Layer) bool) error {
	var err error
	err = m.updateMapData(mid, func(mp *Map) bool {
		lidStr := "Layer_" + strconv.FormatUint(lid, 10)
		for _, l := range mp.Layers {
			if l.ID == lidStr {
				return fn(mp, l)
			}
		}
		err = ErrUnknownLayer
		return false
	})
	return err
}

func (m *mapsDir) updateMapsLayerToken(mid, tid uint64, fn func(*Map, *Layer, *Token) bool) error {
	var err error
	err = m.updateMapData(mid, func(mp *Map) bool {
		for _, l := range mp.Layers {
			for _, t := range l.Tokens {
				if t.ID == tid {
					return fn(mp, l, t)
				}
			}
		}
		err = ErrUnknownToken
		return false
	})
	return err
}

var MapsDir mapsDir

type MapIDError struct {
	KeyID, ParsedID uint64
}

func (m MapIDError) Error() string {
	return fmt.Sprintf("Key ID and Parsed ID do not match: %d, %d", m.KeyID, m.ParsedID)
}

const (
	ErrUnknownMap   errors.Error = "unknown map"
	ErrUnknownLayer errors.Error = "unknown layer"
	ErrUnknownToken errors.Error = "unknown token"
)
