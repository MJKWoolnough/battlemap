package main

import (
	"fmt"
	"image"
	"image/png"
	"io"
	"net/http"
	"path/filepath"
	"strconv"
	"strings"
	"sync"

	"vimagination.zapto.org/errors"
	"vimagination.zapto.org/httpaccept"
	"vimagination.zapto.org/keystore"
)

type masksDir struct {
	DefaultMethods
	fileserver http.Handler
	store      *keystore.FileStore
	mu         sync.Mutex
	nextID     uint
}

func (m *masksDir) Init() error {
	var location keystore.String
	Config.Get("MasksDir", &location)
	mp := filepath.Join(Config.BaseDir, string(location))
	var err error
	m.store, err = keystore.NewFileStore(mp, mp, keystore.NoMangle)
	if err != nil {
		return errors.WithContext("error creating mask store: ", err)
	}
	m.fileserver = http.FileServer(http.Dir(mp))
	var largestID uint
	for _, key := range m.store.Keys() {
		id, err := strconv.ParseUint(key, 10, 0)
		if err != nil {
			continue
		}
		if uint(id) > largestID {
			largestID = uint(id)
		}
	}
	m.nextID = largestID + 1
	return nil
}

func (m *masksDir) Options(w http.ResponseWriter, r *http.Request) {
	if r.URL.Path == "/" {
		if Auth.IsAdmin(r) {
			w.Header().Set("Accept", "POST")
		} else {
			w.WriteHeader(http.StatusUnauthorized)
		}
	} else if m.store.Exists(strings.TrimLeft(strings.TrimPrefix(r.URL.Path, "/"), "0")) {
		if Auth.IsAdmin(r) {
			w.Header().Set("Accept", "GET, HEAD, PUT, DELETE")
		} else {
			w.Header().Set("Accept", "GET, HEAD")
		}
	} else {
		http.NotFound(w, r)
	}
}

func (m *masksDir) Get(w http.ResponseWriter, r *http.Request) bool {
	if r.URL.Path == "/" {
		w.WriteHeader(http.StatusNotAcceptable)
	} else {
		m.fileserver.ServeHTTP(w, r)
	}
	return true
}

func (m *masksDir) Post(w http.ResponseWriter, r *http.Request) bool {
	if r.URL.Path == "/" {
		im, _, err := image.Decode(r.Body)
		r.Body.Close()
		if err != nil {
			http.Error(w, err.Error(), http.StatusBadRequest)
			return true
		}
		if _, ok := im.(*image.Gray); !ok {
			r := im.Bounds()
			gim := image.NewGray(r)
			for y := r.Min.Y; y < r.Max.Y; y++ {
				for x := r.Min.X; x < r.Max.X; x++ {
					gim.Set(x, y, im.At(x, y))
				}
			}
			im = gim
		}
		m.mu.Lock()
		id := m.nextID
		m.nextID++
		m.mu.Unlock()
		m.store.Set(strconv.FormatUint(uint64(id), 10), pngWriterTo{im})
		var at AcceptType
		httpaccept.HandleAccept(r, &at)
		switch at {
		case "json":
			w.Header().Set(contentType, "application/json")
			fmt.Fprintf(w, "%d", id)
		case "xml":
			w.Header().Set(contentType, "text/xml")
			fmt.Fprintf(w, "<id>%d</id>", id)
		default:
			w.Header().Set(contentType, "text/plain")
			fmt.Fprintf(w, "%d", id)
		}
	} else {
		w.WriteHeader(http.StatusNotAcceptable)
	}
	return true
}

func (m *masksDir) Put(w http.ResponseWriter, r *http.Request) bool {
	if r.URL.Path == "/" {
		w.WriteHeader(http.StatusNotAcceptable)
	} else if idStr := strings.TrimLeft(strings.TrimPrefix(r.URL.Path, "/"), "0"); m.store.Exists(idStr) {
		im, _, err := image.Decode(r.Body)
		r.Body.Close()
		if err != nil {
			http.Error(w, err.Error(), http.StatusBadRequest)
			return true
		}
		if _, ok := im.(*image.Gray); !ok {
			r := im.Bounds()
			gim := image.NewGray(r)
			for y := r.Min.Y; y < r.Max.Y; y++ {
				for x := r.Min.X; x < r.Max.X; x++ {
					gim.Set(x, y, im.At(x, y))
				}
			}
			im = gim
		}
		m.store.Set(idStr, pngWriterTo{im})
	} else {
		http.NotFound(w, r)
	}
	return true
}

func (m *masksDir) Delete(w http.ResponseWriter, r *http.Request) bool {
	if r.URL.Path == "/" {
		w.WriteHeader(http.StatusNotAcceptable)
	} else if idStr := strings.TrimLeft(strings.TrimPrefix(r.URL.Path, "/"), "0"); m.store.Exists(idStr) {
		m.store.Remove(idStr)
		w.WriteHeader(http.StatusNoContent)
	} else {
		http.NotFound(w, r)
	}
	return true
}

type pngWriterTo struct {
	image.Image
}

func (p pngWriterTo) WriteTo(w io.Writer) (int64, error) {
	e := png.Encoder{CompressionLevel: png.BestCompression}
	return 0, e.Encode(w, p.Image)
}

var MasksDir masksDir
