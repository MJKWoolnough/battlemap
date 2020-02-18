package battlemap

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
	"vimagination.zapto.org/keystore"
)

type masksDir struct {
	*Battlemap
	DefaultMethods
	fileserver http.Handler
	store      *keystore.FileStore
	mu         sync.Mutex
	nextID     uint64
}

func (m *masksDir) Init(b *Battlemap) error {
	m.Battlemap = b
	var location keystore.String
	err := b.config.Get("MasksDir", &location)
	if err != nil {
		return errors.WithContext("error getting masks directory: ", err)
	}
	mp := filepath.Join(b.config.BaseDir, string(location))
	m.store, err = keystore.NewFileStore(mp, mp, keystore.NoMangle)
	if err != nil {
		return errors.WithContext("error creating mask store: ", err)
	}
	m.fileserver = http.FileServer(http.Dir(mp))
	var largestID uint64
	for _, key := range m.store.Keys() {
		id, err := strconv.ParseUint(key, 10, 0)
		if err != nil {
			continue
		}
		if id > largestID {
			largestID = id
		}
	}
	m.nextID = largestID + 1
	return nil
}

func (m *masksDir) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodGet:
		if isRoot(r.URL.Path) {
			w.WriteHeader(http.StatusNotAcceptable)
		} else {
			m.fileserver.ServeHTTP(w, r)
		}
	case http.MethodPost:
		if err := m.Post(w, r); err != nil {
			http.Error(w, http.StatusText(http.StatusBadRequest), http.StatusBadRequest)
		}
	case http.MethodPut:
		if err := m.Put(w, r); err != nil {
			http.Error(w, http.StatusText(http.StatusBadRequest), http.StatusBadRequest)
		}
	}
}

func (m *masksDir) Post(w http.ResponseWriter, r *http.Request) error {
	if isRoot(r.URL.Path) {
		im, _, err := image.Decode(r.Body)
		r.Body.Close()
		if err != nil {
			return err
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
		m.store.Set(strconv.FormatUint(id, 10), pngWriterTo{im})
		fmt.Fprintf(w, "%d", id)
	} else {
		w.WriteHeader(http.StatusNotAcceptable)
	}
	return nil
}

func (m *masksDir) Put(w http.ResponseWriter, r *http.Request) error {
	if isRoot(r.URL.Path) {
		w.WriteHeader(http.StatusNotAcceptable)
	} else if idStr := strings.TrimLeft(strings.TrimPrefix(r.URL.Path, "/"), "0"); m.store.Exists(idStr) {
		id, err := strconv.ParseUint(idStr, 10, 64)
		if err != nil {
			return err
		}
		im, _, err := image.Decode(r.Body)
		r.Body.Close()
		if err != nil {
			return err
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
		m.socket.broadcastMapChange(0, broadcastLayerMaskChange, id, SocketIDFromRequest(r))
	} else {
		http.NotFound(w, r)
	}
	return nil
}

type pngWriterTo struct {
	image.Image
}

func (p pngWriterTo) WriteTo(w io.Writer) (int64, error) {
	e := png.Encoder{CompressionLevel: png.BestCompression}
	return 0, e.Encode(w, p.Image)
}
