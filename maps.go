package battlemap

import (
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
	m.folders.Init(b, store)
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
	ID            uint64 `json:"id,omitempty"`
	Name          string `json:"name" xml:",chardata"`
	Width         uint64 `json:"width" xml:"width,attr"`
	Height        uint64 `json:"height" xml:"height,attr"`
	SquaresWidth  uint64 `json:"square" xml:"square,attr"`
	SquaresColour colour `json:"colour" xml:"colour,attr"`
	SquaresStroke uint64 `json:"stroke" xml:"stroke,attr"`
}

func (m *mapsDir) newMap(nm mapDetails, id ID) (idName, error) {
	if nm.Width == 0 || nm.Height == 0 {
		return idName{}, ErrInvalidDimensions
	}
	m.mu.Lock()
	m.lastID++
	mid := m.lastID
	if nm.Name == "" {
		nm.Name = "Map " + strconv.FormatUint(mid, 10)
	}
	mp := &levelMap{
		Name:   nm.Name,
		Width:  nm.Width,
		Height: nm.Height,
		Patterns: []pattern{
			genGridPattern(nm.SquaresWidth, nm.SquaresColour, nm.SquaresStroke),
		},
		Layers: layers{
			&layer{
				Name: "Layer",
			},
			&layer{
				Name: "Light",
				Tokens: tokens{
					&token{
						Source:    "rgba(0, 0, 0, 0)",
						TokenType: tokenRect,
					},
				},
			},
			&layer{
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
	name := addItemTo(m.folders.root.Items, nm.Name, mid)
	m.maps[mid] = mp
	m.links[mid] = 1
	m.saveFolders()
	m.mu.Unlock()
	m.Set(strconv.FormatUint(mid, 10), mp)
	m.socket.broadcastAdminChange(broadcastMapItemAdd, idName{ID: mid, Name: mp.Name}, id)
	return idName{
		ID:   mid,
		Name: name,
	}, nil
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
		m.Set(strconv.FormatUint(id, 10), mp)
	}
	m.mu.Unlock()
	if !ok {
		return ErrUnknownMap
	}
	return nil
}

func (m *mapsDir) updateMapLayer(mid uint64, path []uint, fn func(*levelMap, *layer) bool) error {
	var err error
	err = m.updateMapData(mid, func(mp *levelMap) bool {
		l := getLayer(mp.Layers, path)
		if l != nil {
			return fn(mp, l)
		}
		err = ErrUnknownLayer
		return false
	})
	return err
}

func (m *mapsDir) updateMapsLayerToken(mid uint64, path []uint, fn func(*levelMap, *layer, *token) bool) error {
	var err error
	err = m.updateMapData(mid, func(mp *levelMap) bool {
		l, t := getParentToken(mp.Layers, path)
		if t != nil {
			return fn(mp, l, t)
		}
		err = ErrUnknownToken
		return false
	})
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

func getLayer(layers layers, path []uint) *layer {
	return nil
}

func getParentLayer(layers layers, path []uint) (*layer, *layer) {
	return nil, nil
}

func getParentToken(layers layers, path []uint) (*layer, *token) {
	return nil, nil
}

func (l *layer) removeLayer(ol *layer) {

}

func (l *layer) addLayer(nl *layer, pos int) {

}

// Errors
var (
	ErrUnknownMap        = errors.New("unknown map")
	ErrUnknownLayer      = errors.New("unknown layer")
	ErrUnknownToken      = errors.New("unknown token")
	ErrInvalidDimensions = errors.New("invalid dimensions")
)
