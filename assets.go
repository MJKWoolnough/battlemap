package battlemap

import (
	"crypto/sha256"
	"encoding/json"
	"fmt"
	"hash"
	"io"
	"net/http"
	"path/filepath"
	"strconv"
	"strings"

	"vimagination.zapto.org/keystore"
	"vimagination.zapto.org/memio"
)

type hasher struct {
	hash.Hash
}

func (h *hasher) ReadFrom(r io.Reader) (int64, error) {
	return io.Copy(h.Hash, r)
}

type assetsDir struct {
	folders
	handler http.Handler
	hashes  map[[sha256.Size]byte][]uint64
}

func (a *assetsDir) Init(b *Battlemap, links links) error {
	var (
		location keystore.String
		locname  string
		lm       linkManager
	)
	switch a.fileType {
	case fileTypeImage:
		locname = "ImageAssetsDir"
		lm = links.images
	case fileTypeAudio:
		locname = "AudioAssetsDir"
		lm = links.audio
	default:
		return ErrInvalidFileType
	}
	err := b.config.Get(locname, &location)
	if err != nil {
		return fmt.Errorf("error getting asset data directory: %w", err)
	}
	l := filepath.Join(b.config.BaseDir, string(location))
	assetStore, err := keystore.NewFileStore(l, l, keystore.NoMangle)
	if err != nil {
		return fmt.Errorf("error creating asset meta store: %w", err)
	}
	a.hashes = make(map[[sha256.Size]byte][]uint64)
	a.handler = http.FileServer(http.Dir(l))
	return a.folders.Init(b, assetStore, lm)
}

func (a *assetsDir) cleanup(l linkManager) {
	a.folders.cleanup(l)
	h := hasher{Hash: sha256.New()}
	for _, key := range a.Keys() {
		id, err := strconv.ParseUint(key, 10, 64)
		if err != nil {
			continue
		}
		if err := a.Get(key, &h); err != nil {
			continue
		}
		hash := *(*[sha256.Size]byte)(h.Sum(nil))
		a.hashes[hash] = append(a.hashes[hash], id)
		h.Reset()
	}
}

func (a *assetsDir) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodGet, http.MethodHead:
		if r.URL.Path == folderMetadata {
			http.NotFound(w, r)
		} else {
			a.handler.ServeHTTP(w, r)
		}
	case http.MethodPost:
		if !a.auth.IsAdmin(r) {
			http.Error(w, http.StatusText(http.StatusUnauthorized), http.StatusUnauthorized)
		} else if r.URL.Path != "" {
			http.Error(w, http.StatusText(http.StatusMethodNotAllowed), http.StatusMethodNotAllowed)
		} else if err := a.Post(w, r); err != nil {
			http.Error(w, err.Error(), http.StatusBadRequest)
		}
	default:
		http.Error(w, http.StatusText(http.StatusMethodNotAllowed), http.StatusMethodNotAllowed)
	}
}

func (a *assetsDir) Post(w http.ResponseWriter, r *http.Request) error {
	m, err := r.MultipartReader()
	defer r.Body.Close()
	if err != nil {
		return err
	}
	var (
		added []idName
		gft   getFileType
	)
	for {
		p, err := m.NextPart()
		if err != nil {
			if err == io.EOF {
				break
			}
			return err
		}
		gft.Type = fileTypeUnknown
		bufLen, err := gft.ReadFrom(p)
		if err != nil {
			return err
		}
		if gft.Type != a.fileType {
			continue
		}
		a.mu.Lock()
		a.lastID++
		id := a.lastID
		a.mu.Unlock()
		idStr := strconv.FormatUint(id, 10)
		if err = a.Set(idStr, bufReaderWriterTo{gft.Buffer[:bufLen], p}); err != nil {
			return err
		}
		filename := p.FileName()
		if filename == "" || strings.ContainsAny(filename, invalidFilenameChars) {
			filename = idStr
		}
		newName := addItemTo(a.root.Items, filename, id)
		added = append(added, idName{id, newName})
	}
	if len(added) == 0 {
		w.WriteHeader(http.StatusNoContent)
		return nil
	}
	a.mu.Lock()
	a.saveFolders()
	a.mu.Unlock()
	var buf memio.Buffer
	fmt.Fprintf(&buf, "[{\"id\":%d,\"name\":%q}", added[0].ID, added[0].Name)
	for _, id := range added[1:] {
		fmt.Fprintf(&buf, ",{\"id\":%d,\"name\":%q}", id.ID, id.Name)
	}
	fmt.Fprint(&buf, "]")
	bid := broadcastImageItemAdd
	if a.fileType == fileTypeAudio {
		bid--
	}
	a.socket.broadcastAdminChange(bid, json.RawMessage(buf), SocketIDFromRequest(r))
	w.Header().Set(contentType, "application/json")
	w.Header().Set("Content-Length", strconv.FormatUint(uint64(len(buf)), 10))
	w.Write(buf)
	return nil
}

type bufReaderWriterTo struct {
	Buf    []byte
	Reader io.Reader
}

func (b bufReaderWriterTo) WriteTo(w io.Writer) (int64, error) {
	n, err := w.Write(b.Buf)
	if err != nil {
		return int64(n), err
	}
	m, err := io.Copy(w, b.Reader)
	return int64(n) + m, err
}

const (
	invalidFilenameChars = "\x00\r\n\\/"
	contentType          = "Content-Type"
)
