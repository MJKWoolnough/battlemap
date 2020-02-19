package battlemap

import (
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"path/filepath"
	"sort"
	"strconv"
	"strings"
	"sync"

	"vimagination.zapto.org/keystore"
	"vimagination.zapto.org/memio"
)

type mapsDir struct {
	*Battlemap

	store *keystore.FileStore

	mu               sync.RWMutex
	maps             map[uint64]*levelMap
	order            maps
	lastID           uint64
	json             memio.Buffer
	handler, indexes http.Handler
}

func (m *mapsDir) Init(b *Battlemap) error {
	m.Battlemap = b
	var location keystore.String
	err := b.config.Get("MapsDir", &location)
	if err != nil {
		return fmt.Errorf("error getting map directory: %w", err)
	}
	sp := filepath.Join(b.config.BaseDir, string(location))
	m.store, err = keystore.NewFileStore(sp, sp, keystore.NoMangle)
	if err != nil {
		return fmt.Errorf("error creating map store: %w", err)
	}
	keys := m.store.Keys()
	m.maps = make(map[uint64]*levelMap, len(keys))
	m.order = make(maps, 0, len(keys))
	for _, key := range keys {
		id, err := strconv.ParseUint(key, 10, 0)
		if err != nil {
			continue
		}
		if _, ok := m.maps[id]; ok {
			continue
		}
		mp := new(levelMap)
		if err = m.store.Get(key, mp); err != nil {
			return fmt.Errorf("error reading map data (%q): %w", key, err)
		}
		if id != mp.ID {
			return fmt.Errorf("Key ID and Parsed ID do not match: %d, %d", id, mp.ID)
		}
		m.maps[id] = mp
		m.order = append(m.order, mp)
		if id > m.lastID {
			m.lastID = id
		}
	}
	sort.Sort(m.order)
	json.NewEncoder(&m.json).Encode(m.order)
	m.handler = http.FileServer(http.Dir(sp))
	return nil
}

type mapDetails struct {
	ID            uint64 `json:"id,omitempty"`
	Name          string `json:"name" xml:",chardata"`
	Width         uint64 `json:"width" xml:"width,attr"`
	Height        uint64 `json:"height" xml:"height,attr"`
	SquaresWidth  uint64 `json:"square" xml:"square,attr"`
	SquaresColour colour `json:"colour" xml:"colour,attr"`
	SquaresStroke uint64 `json:"stroke" xml:"stroke,attr"`
}

func (m *mapsDir) newMap(nm mapDetails, id ID) (uint64, error) {
	if nm.Width == 0 || nm.Height == 0 {
		return 0, ErrInvalidDimensions
	}
	m.mu.Lock()
	m.lastID++
	mid := m.lastID
	if nm.Name == "" {
		nm.Name = "Map " + strconv.FormatUint(mid, 10)
	}
	var order int64
	if len(m.order) == 0 {
		order = 1
	} else {
		order = m.order[len(m.order)-1].Order + 1
	}
	mp := &levelMap{
		ID:     mid,
		Name:   nm.Name,
		Order:  order,
		Width:  nm.Width,
		Height: nm.Height,
		Patterns: []pattern{
			genGridPattern(nm.SquaresWidth, nm.SquaresColour, nm.SquaresStroke),
		},
		Layers: layers{
			&layer{
				ID:   "Layer_1",
				Name: "Layer",
			},
			&layer{
				ID:   "Light",
				Name: "Light",
				Tokens: tokens{
					&token{
						Source:    "rgba(0, 0, 0, 0)",
						TokenType: tokenRect,
					},
				},
			},
			&layer{
				ID:   "Grid",
				Name: "Grid",
				Tokens: tokens{
					&token{
						Source:    "gridPattern",
						TokenType: tokenPattern,
					},
				},
			},
		},
	}
	m.maps[mid] = mp
	m.order = append(m.order, mp)
	m.updateMapJSON()
	m.mu.Unlock()
	m.store.Set(strconv.FormatUint(mid, 10), mp)
	return mid, nil
}

func genGridPattern(squaresWidth uint64, squaresColour colour, squaresStroke uint64) pattern {
	return pattern{
		ID:     "gridPattern",
		Width:  squaresWidth,
		Height: squaresWidth,
		Path: &patternPath{
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

func (m *mapsDir) updateMapData(id uint64, fn func(*levelMap) bool) error {
	m.mu.Lock()
	mp, ok := m.maps[id]
	if ok && fn(mp) {
		m.store.Set(strconv.FormatUint(id, 10), mp)
	}
	m.updateMapJSON()
	m.mu.Unlock()
	if !ok {
		return ErrUnknownMap
	}
	return nil
}

func (m *mapsDir) updateMapLayer(mid uint64, lid string, fn func(*levelMap, *layer) bool) error {
	var err error
	err = m.updateMapData(mid, func(mp *levelMap) bool {
		for _, l := range mp.Layers {
			if l.ID == lid {
				return fn(mp, l)
			}
		}
		err = ErrUnknownLayer
		return false
	})
	return err
}

func (m *mapsDir) updateMapsLayerToken(mid, tid uint64, fn func(*levelMap, *layer, *token) bool) error {
	var err error
	err = m.updateMapData(mid, func(mp *levelMap) bool {
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

func (m *mapsDir) updateMapJSON() {
	m.json = m.json[:0]
	json.NewEncoder(&m.json).Encode(m.order)
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

// Errors
var (
	ErrUnknownMap        = errors.New("unknown map")
	ErrUnknownLayer      = errors.New("unknown layer")
	ErrUnknownToken      = errors.New("unknown token")
	ErrInvalidDimensions = errors.New("invalid dimensions")
)
