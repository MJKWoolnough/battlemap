package main

import (
	"encoding/json"
	"encoding/xml"
	"fmt"
	"io"
	"net/http"
	"strconv"
	"strings"

	"vimagination.zapto.org/httpaccept"
	"vimagination.zapto.org/keystore"
)

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
			w.Header().Set("Accept-Patch", "application/json, text/plain, text/xml")
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

func (m *mapsDir) Post(w http.ResponseWriter, r *http.Request) bool {
	if !Auth.IsAdmin(r) || !isRoot(r.URL.Path) {
		return false
	}
	var (
		newMap struct {
			Width         uint64 `json:"width" xml:"width,attr"`
			Height        uint64 `json:"height" xml:"height,attr"`
			SquaresWidth  uint64 `json:"square" xml:"square,attr"`
			SquaresColour uint32 `json:"colour" xml:"colour,attr"`
			SquaresStroke uint64 `json:"stroke" xml:"stroke,attr"`
			Name          string `json:"name" xml:",chardata"`
		}
		err error
		at  AcceptType
	)
	switch r.Header.Get(contentType) {
	case "application/json", "text/json":
		at = "json"
		err = json.NewDecoder(r.Body).Decode(&newMap)
	case "text/xml":
		at = "xml"
		err = xml.NewDecoder(r.Body).Decode(&newMap)
	default:
		at = "txt"
		_, err = fmt.Fscanf(r.Body, "%d:%d:%d:%d:%d:%q", &newMap.Width, &newMap.Height, &newMap.SquaresWidth, &newMap.SquaresColour, &newMap.SquaresStroke, &newMap.Name)
	}
	r.Body.Close()
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
	}
	if newMap.Width == 0 || newMap.Height == 0 {
		http.Error(w, "invalid dimensions", http.StatusBadRequest)
	}
	sqStr := strconv.FormatUint(newMap.SquaresWidth, 10)
	m.mu.Lock()
	id := m.nextID
	m.nextID++
	if newMap.Name == "" {
		newMap.Name = "Map " + strconv.FormatUint(id, 10)
	}
	mp := &Map{
		ID:     id,
		Name:   newMap.Name,
		Order:  m.order[len(m.order)-1].Order + 1,
		Width:  newMap.Width,
		Height: newMap.Height,
		Patterns: []Pattern{
			Pattern{
				ID:     "gridPattern",
				Width:  newMap.SquaresWidth,
				Height: newMap.SquaresWidth,
				Path: &Path{
					Path:        "M 0 " + sqStr + " V 0 H " + sqStr,
					Fill:        "rgba(0, 0, 0, 0)",
					Stroke:      fmt.Sprintf("rgba(%d, %d, %d, %.2f)", newMap.SquaresColour>>24, newMap.SquaresColour>>16&255, newMap.SquaresColour>>8&255, float32(newMap.SquaresColour&255)/255),
					StrokeWidth: newMap.SquaresStroke,
				},
			},
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
	m.maps[mp.ID] = mp
	m.order = append(m.order, mp)
	m.mu.Unlock()
	idStr := strconv.FormatUint(mp.ID, 10)
	m.store.Set(idStr, mp)
	httpaccept.HandleAccept(r, &at)
	switch at {
	case "xml":
		w.Header().Set(contentType, "text/xml")
		io.WriteString(w, "<id>"+idStr+"</id>")
	case "json":
		w.Header().Set(contentType, "application/json")
		io.WriteString(w, idStr)
	default:
		w.Header().Set(contentType, "text/plain")
		io.WriteString(w, idStr)
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
