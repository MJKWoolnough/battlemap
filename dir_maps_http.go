package battlemap

import (
	"net/http"
	"strconv"
	"strings"

	"vimagination.zapto.org/keystore"
)

func (m *mapsDir) Options(w http.ResponseWriter, r *http.Request) {
	if m.auth.IsAdmin(r) {
		if m.store.Exists(strings.TrimPrefix(r.URL.Path, "/")) {
			w.Header().Set("Allow", "OPTIONS, GET, HEAD")
		} else {
			http.NotFound(w, r)
		}
	} else {
		var currentUserMap keystore.Uint
		m.config.Get("currentUserMap", &currentUserMap)
		id, _ := strconv.ParseUint(strings.TrimPrefix(r.URL.Path, "/"), 10, 0)
		if id == uint64(currentUserMap) {
			w.Header().Set("Allow", "OPTIONS, GET, HEAD")
		} else {
			http.Error(w, http.StatusText(http.StatusForbidden), http.StatusForbidden)
		}
	}
}

func (m *mapsDir) Get(w http.ResponseWriter, r *http.Request) bool {
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
	return true
}
