package battlemap

import (
	"encoding/json"
	"fmt"
	"net/http"
	"path/filepath"
	"strconv"
	"strings"

	"vimagination.zapto.org/keystore"
)

type mapsDir struct {
	folders
	maps             map[uint64]*levelMap
	handler, indexes http.Handler
}

func (m *mapsDir) Init(b *Battlemap, links links) error {
	var location keystore.String
	err := b.config.Get("MapsDir", &location)
	if err != nil {
		return fmt.Errorf("error getting map directory: %w", err)
	}
	sp := filepath.Join(b.config.BaseDir, string(location))
	store, err := keystore.NewFileStore(sp, sp, keystore.NoMangle)
	if err != nil {
		return fmt.Errorf("error creating map store: %w", err)
	}
	m.folders.fileType = fileTypeMap
	m.folders.Init(b, store, links.maps)
	m.maps = make(map[uint64]*levelMap, len(links.maps))
	for id := range links.maps {
		key := strconv.FormatUint(id, 10)
		mp := new(levelMap)
		if err = m.Get(key, mp); err != nil {
			return fmt.Errorf("error reading map data (%q): %w", key, err)
		}
		for key, value := range mp.Data {
			if f := links.getLinkKey(key); f != nil {
				f.setJSONLinks(value)
			}
		}
		for _, t := range mp.tokens {
			if t.Source > 0 {
				links.images.setLink(t.Source)
			}
			for key, value := range t.TokenData {
				if f := links.getLinkKey(key); f != nil {
					f.setJSONLinks(value.Data)
				}
			}
		}
		m.maps[id] = mp
	}
	m.handler = http.FileServer(http.Dir(sp))
	return nil
}

type mapDetails struct {
	ID   uint64 `json:"id,omitempty"`
	Name string `json:"name"`
	mapDimensions
	mapGrid
}

type mapDimensions struct {
	Width  uint64 `json:"width"`
	Height uint64 `json:"height"`
}

type mapGrid struct {
	GridType   uint8  `json:"gridType"`
	GridSize   uint64 `json:"gridSize"`
	GridColour colour `json:"gridColour"`
	GridStroke uint64 `json:"gridStroke"`
}

func (m *mapsDir) newMap(nm mapDetails, id ID) (json.RawMessage, error) {
	if nm.Width == 0 || nm.Height == 0 {
		return nil, ErrInvalidDimensions
	}
	m.mu.Lock()
	m.lastID++
	mid := m.lastID
	if nm.Name == "" {
		nm.Name = "Map " + strconv.FormatUint(mid, 10)
	}
	mp := &levelMap{
		Width:      nm.Width,
		Height:     nm.Height,
		GridSize:   nm.GridSize,
		GridColour: nm.GridColour,
		GridStroke: nm.GridStroke,
		layers: map[string]struct{}{
			"Layer": {},
			"Light": {},
			"Grid":  {},
		},
		layer: layer{
			Layers: []*layer{
				{
					Name: "Layer",
				},
				{
					Name: "Light",
				},
				{
					Name: "Grid",
				},
			},
		},
		tokens: make(map[uint64]layerToken),
		walls:  make(map[uint64]layerWall),
		Data:   make(map[string]json.RawMessage),
	}
	name := addItemTo(m.folders.root.Items, nm.Name, mid)
	m.maps[mid] = mp
	m.saveFolders()
	m.mu.Unlock()
	m.Set(strconv.FormatUint(mid, 10), mp)
	buf := append(appendString(append(strconv.AppendUint(append(json.RawMessage{}, "[{\"id\":"...), mid, 10), ",\"name\":"...), name), '}', ']')
	m.socket.broadcastAdminChange(broadcastMapItemAdd, buf, id)
	return buf[1 : len(buf)-1], nil
}

func (m *mapsDir) updateMapData(id uint64, fn func(*levelMap) bool) error {
	m.mu.Lock()
	mp, ok := m.maps[id]
	if ok && fn(mp) {
		m.Set(strconv.FormatUint(id, 10), mp)
	}
	m.mu.Unlock()
	if !ok {
		return ErrUnknownMap
	}
	return nil
}

type layerType uint8

const (
	anyLayer layerType = iota
	anyLayerAll
	tokenLayer
	folderLayer
)

func (m *mapsDir) updateMapLayer(mid uint64, path string, lt layerType, fn func(*levelMap, *layer) bool) error {
	var err error
	if errr := m.updateMapData(mid, func(mp *levelMap) bool {
		var l *layer
		l = getLayer(&mp.layer, path)
		if lt == anyLayerAll && l == nil && (path == "/Light" || path == "/Grid") {
			for _, m := range mp.Layers {
				if m.Name == path[1:] {
					l = m
					break
				}
			}
		}
		if l != nil {
			if lt == tokenLayer && l.Layers != nil || lt == folderLayer && l.Layers == nil {
				err = ErrInvalidLayerPath
				return false
			}
			return fn(mp, l)
		}
		err = ErrUnknownLayer
		return false
	}); errr != nil {
		return errr
	}
	return err
}

func (m *mapsDir) updateMapsLayerToken(mid uint64, id uint64, fn func(*levelMap, *layer, *token) bool) error {
	var err error
	if errr := m.updateMapData(mid, func(mp *levelMap) bool {
		if tk, ok := mp.tokens[id]; ok {
			return fn(mp, tk.layer, tk.token)
		}
		err = ErrUnknownToken
		return false
	}); errr != nil {
		return errr
	}
	return err
}

func (m *mapsDir) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	if m.auth.IsAdmin(r) {
		m.mu.RLock()
		m.handler.ServeHTTP(w, r)
		m.mu.RUnlock()
	} else {
		var currentUserMap keystore.Uint
		m.config.Get("currentUserMap", &currentUserMap)
		id, _ := strconv.ParseUint(strings.TrimPrefix(r.URL.Path, "/"), 10, 0)
		if id == uint64(currentUserMap) {
			m.mu.RLock()
			m.handler.ServeHTTP(w, r)
			m.mu.RUnlock()
		} else {
			http.Error(w, http.StatusText(http.StatusForbidden), http.StatusForbidden)
		}
	}
}

func uniqueLayer(l map[string]struct{}, name string) string {
	return uniqueName(name, func(name string) bool {
		if _, ok := l[name]; !ok {
			l[name] = struct{}{}
			return true
		}
		return false
	})
}

func getLayer(l *layer, p string) *layer {
Loop:
	for _, p := range strings.Split(strings.TrimRight(strings.TrimLeft(p, "/"), "/"), "/") {
		switch p {
		case "":
			continue
		case "Light", "Grid":
			return nil
		}
		for _, m := range l.Layers {
			if m.Name == p {
				l = m
				continue Loop
			}
		}
		return nil
	}
	return l
}

func getParentLayer(l *layer, p string) (*layer, *layer) {
	parentStr, name := splitAfterLastSlash(strings.TrimRight(p, "/"))
	parent := getLayer(l, parentStr)
	if parent == nil || parent.Layers == nil {
		return nil, nil
	}
	return parent, getLayer(parent, name)
}

func (l *layer) removeLayer(name string) {
	pos := -1
	for n, m := range l.Layers {
		if m.Name == name {
			pos = n
			break
		}
	}
	if pos == -1 {
		return
	}
	if pos < len(l.Layers)-1 {
		copy(l.Layers[pos:], l.Layers[pos+1:])
	}
	l.Layers[len(l.Layers)-1] = nil
	l.Layers = l.Layers[:len(l.Layers)-1]
}

func (l *layer) addLayer(nl *layer, pos uint) {
	if pos >= uint(len(l.Layers)) {
		pos = uint(len(l.Layers))
	}
	l.Layers = append(l.Layers, nil)
	copy(l.Layers[pos+1:], l.Layers[pos:])
	l.Layers[pos] = nl
}

func (l *layer) removeToken(id uint64) {
	pos := -1
	for p, tk := range l.Tokens {
		if tk.ID == id {
			pos = p
			break
		}
	}
	if pos == -1 {
		return
	}
	copy(l.Tokens[pos:], l.Tokens[pos+1:])
	l.Tokens[len(l.Tokens)-1] = nil
	l.Tokens = l.Tokens[:len(l.Tokens)-1]
}

func (l *layer) addToken(tk *token, pos uint) {
	if pos >= uint(len(l.Tokens)) {
		pos = uint(len(l.Tokens))
	}
	l.Tokens = append(l.Tokens, nil)
	copy(l.Tokens[pos+1:], l.Tokens[pos:])
	l.Tokens[pos] = tk
}
