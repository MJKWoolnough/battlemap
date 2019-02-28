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
	default:
		at = "txt"
		_, err = fmt.Fscanf(r.Body, "%d:%d:%d:%d:%d:%q", &nm.Width, &nm.Height, &nm.SquaresWidth, &nm.SquaresColour, &nm.SquaresStroke, &nm.Name)
	}
	r.Body.Close()
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	id, err := m.newMap(nm)
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
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
