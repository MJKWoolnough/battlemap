package main

import (
	"bufio"
	"encoding/json"
	"encoding/xml"
	"fmt"
	"io"
	"net/http"
	"strconv"
	"strings"

	"vimagination.zapto.org/errors"
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
		nm  newMap
		err error
		at  AcceptType
	)
	switch r.Header.Get(contentType) {
	case "application/json", "text/json":
		at = "json"
		err = json.NewDecoder(r.Body).Decode(&nm)
	case "text/xml":
		at = "xml"
		err = xml.NewDecoder(r.Body).Decode(&nm)
	case "application/x-www-form-urlencoded":
		at = "form"
		if err = r.ParseForm(); err != nil {
			break
		}
		nm.Name = r.PostForm.Get("name")
		if nm.Width, err = strconv.ParseUint(r.PostForm.Get("width"), 10, 64); err != nil {
			break
		}
		if nm.Height, err = strconv.ParseUint(r.PostForm.Get("height"), 10, 64); err != nil {
			break
		}
		if nm.SquaresWidth, err = strconv.ParseUint(r.PostForm.Get("squaresWidth"), 10, 64); err != nil {
			break
		}
		if nm.SquaresStroke, err = strconv.ParseUint(r.PostForm.Get("squaresStoke"), 10, 64); err != nil {
			break
		}
		nm.SquaresColour.A = 0xff
		_, err = fmt.Sscanf(r.PostForm.Get("squaresColour"), "#%2x%2x%2x", &nm.SquaresColour.R, &nm.SquaresColour.G, &nm.SquaresColour.B)
	default:
		at = "txt"
		_, err = fmt.Fscanf(r.Body, "%d:%d:%d:{%d,%d,%d,%d}:%d:%q", &nm.Width, &nm.Height, &nm.SquaresWidth, &nm.SquaresColour.R, &nm.SquaresColour.G, &nm.SquaresColour.B, &nm.SquaresColour.A, &nm.SquaresStroke, &nm.Name)
	}
	r.Body.Close()
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return true
	}
	id, err := m.newMap(nm)
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return true
	}
	idStr := strconv.FormatUint(id, 10)
	httpaccept.HandleAccept(r, &at)
	switch at {
	case "xml":
		w.Header().Set(contentType, "text/xml")
		io.WriteString(w, "<id>"+idStr+"</id>")
	case "json":
		w.Header().Set(contentType, "application/json")
		io.WriteString(w, idStr)
	case "form":
		w.Header().Set(contentType, "application/x-www-form-urlencoded")
		io.WriteString(w, "id="+idStr)
	default:
		w.Header().Set(contentType, "text/plain")
		io.WriteString(w, idStr)
	}
	return true
}

func (m *mapsDir) Patch(w http.ResponseWriter, r *http.Request) bool {
	if !Auth.IsAdmin(r) || isRoot(r.URL.Path) || !m.store.Exists(strings.TrimPrefix(r.URL.Path, "/")) {
		return false
	}
	var patchMap struct {
		Name         string `json:"name" xml:"name"`
		SquaresWidth uint64 `json:"squaresWidth" xml:"squaresWidth"`
		Width        uint64 `json:"width" xml:"width"`
		Height       uint64 `json:"height" xml:"height"`
		Order        *int   `json:"order" xml:"order"`
	}
	id, err := strconv.ParseUint(strings.TrimPrefix(r.URL.Path, "/"), 10, 64)
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return true
	}
	switch r.Header.Get(contentType) {
	case "application/json", "text/json":
		err = json.NewDecoder(r.Body).Decode(&patchMap)
	case "text/xml":
		err = xml.NewDecoder(r.Body).Decode(&patchMap)
	default:
		buf := bufio.NewReader(r.Body)
		var c byte
		for err != nil {
			c, err = buf.ReadByte()
			switch c {
			case 'n':
				_, err = fmt.Fscanf(buf, ":%q\n", &patchMap.Name)
			case 's':
				_, err = fmt.Fscanf(buf, ":%d\n", &patchMap.SquaresWidth)
			case 'w':
				_, err = fmt.Fscanf(buf, ":%d\n", &patchMap.Width)
			case 'h':
				_, err = fmt.Fscanf(buf, ":%d\n", &patchMap.Height)
			case 'o':
				patchMap.Order = new(int)
				_, err = fmt.Fscanf(buf, ":%d\n", patchMap.Order)
			default:
				err = errors.Error("unknown char code")
			}
		}
	}
	r.Body.Close()
	if err != nil && err != io.EOF {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return true
	}
	m.updateMapData(id, func(mp *Map) bool {
		var changed bool
		if patchMap.Name != "" && patchMap.Name != mp.Name {
			changed = true
			mp.Name = patchMap.Name
		}
		if patchMap.SquaresWidth != 0 {
			for n := range mp.Patterns {
				p := &mp.Patterns[n]
				if p.ID == "gridPattern" {
					if p.Width != patchMap.SquaresWidth || p.Height != patchMap.SquaresWidth {
						changed = true
						p.Width = patchMap.SquaresWidth
						p.Height = patchMap.SquaresWidth
					}
					break
				}
			}
		}
		if patchMap.Width != 0 && patchMap.Width != mp.Width {
			changed = true
			mp.Width = patchMap.Width
		}
		if patchMap.Height != 0 && patchMap.Height != mp.Height {
			changed = true
			mp.Height = patchMap.Height
		}
		if patchMap.Order != nil {
			for _, mmp := range m.order.Move(mp, *patchMap.Order) {
				if mmp.ID == mp.ID {
					changed = false
				}
				m.store.Set(strconv.FormatUint(mmp.ID, 10), mmp)
			}
		}
		return changed
	})
	w.WriteHeader(http.StatusNoContent)
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
