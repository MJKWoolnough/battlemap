package battlemap

import (
	"encoding/json"
	"errors"
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

func mapCleanup(b *Battlemap, id uint64) {
	mp := b.maps.maps[id]
	if mp != nil {
		delete(b.maps.maps, id)
		mapCleanupLayerWalk(b, mp, &mp.layer)
	}
}

func mapCleanupLayerWalk(b *Battlemap, mp *levelMap, layer *layer) {
	for _, tk := range layer.Tokens {
		mapCleanupTokenRemove(b, mp, layer, tk)
	}
	for _, l := range layer.Layers {
		mapCleanupLayerWalk(b, mp, l)
	}
}

func mapCleanupTokenRemove(b *Battlemap, mp *levelMap, layer *layer, tk *token) {
	if tk.Source > 0 {
		b.images.removeHiddenLink(tk.Source)
	}
}

func (m *mapsDir) Init(b *Battlemap) error {
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
	m.folders.Init(b, store, mapCleanup)
	m.maps = make(map[uint64]*levelMap, len(m.links))
	for id := range m.links {
		key := strconv.FormatUint(id, 10)
		mp := new(levelMap)
		if err = m.Get(key, mp); err != nil {
			return fmt.Errorf("error reading map data (%q): %w", key, err)
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
	Width  uint64 `json:"width" xml:"width,attr"`
	Height uint64 `json:"height" xml:"height,attr"`
}

type mapGrid struct {
	GridSize   uint64 `json:"gridSize" xml:"square,attr"`
	GridColour colour `json:"gridColour" xml:"colour,attr"`
	GridStroke uint64 `json:"gridStroke" xml:"stroke,attr"`
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
			"Layer": struct{}{},
			"Light": struct{}{},
			"Grid":  struct{}{},
		},
		layer: layer{
			Layers: []*layer{
				&layer{
					Name: "Layer",
				},
				&layer{
					Name: "Light",
				},
				&layer{
					Name: "Grid",
				},
			},
		},
	}
	name := addItemTo(m.folders.root.Items, nm.Name, mid)
	m.maps[mid] = mp
	m.links[mid] = 1
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

func (m *mapsDir) updateMapLayer(mid uint64, path string, fn func(*levelMap, *layer) bool) error {
	var err error
	if errr := m.updateMapData(mid, func(mp *levelMap) bool {
		l := getLayer(&mp.layer, path)
		if l != nil {
			return fn(mp, l)
		}
		err = ErrUnknownLayer
		return false
	}); errr != nil {
		return errr
	}
	return err
}

func (m *mapsDir) updateMapsLayerToken(mid uint64, path string, pos uint, fn func(*levelMap, *layer, *token) bool) error {
	var err error
	if errr := m.updateMapData(mid, func(mp *levelMap) bool {
		l, t := getParentToken(&mp.layer, path, pos)
		if t != nil {
			return fn(mp, l, t)
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
	if _, ok := l[name]; !ok {
		l[name] = struct{}{}
		return name
	}
	n := make([]byte, len(name)+32)
	m := n[len(name)+1 : len(name)+1]
	copy(n, name)
	n[len(name)] = '.'
	for i := uint64(0); ; i++ {
		p := len(strconv.AppendUint(m, i, 10))
		if _, ok := l[string(n[:len(name)+1+p])]; !ok {
			name := string(n[:len(name)+1+p])
			l[name] = struct{}{}
			return name
		}
	}
}

func getLayer(l *layer, p string) *layer {
Loop:
	for _, p := range strings.Split(strings.TrimRight(strings.TrimLeft(p, "/"), "/"), "/") {
		if p == "" {
			continue
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

func getParentToken(l *layer, p string, pos uint) (*layer, *token) {
	parent := getLayer(l, p)
	if parent == nil || parent.Layers != nil {
		return nil, nil
	}
	if uint(len(parent.Tokens)) <= pos {
		return parent, nil
	}
	return parent, parent.Tokens[pos]
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

func (l *layer) removeToken(pos uint) {
	if pos < uint(len(l.Tokens))-1 {
		copy(l.Tokens[pos:], l.Tokens[pos+1:])
	}
	l.Tokens[len(l.Tokens)-1] = nil
	l.Tokens = l.Tokens[:len(l.Tokens)-1]
}

func (l *layer) addToken(nt *token, pos uint) {
	if pos >= uint(len(l.Tokens)) {
		pos = uint(len(l.Tokens))
	}
	l.Tokens = append(l.Tokens, nil)
	copy(l.Tokens[pos+1:], l.Tokens[pos:])
	l.Tokens[pos] = nt
}

// Errors
var (
	ErrUnknownMap        = errors.New("unknown map")
	ErrUnknownLayer      = errors.New("unknown layer")
	ErrUnknownToken      = errors.New("unknown token")
	ErrInvalidDimensions = errors.New("invalid dimensions")
)
