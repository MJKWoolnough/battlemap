package battlemap

import (
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"path/filepath"
	"strconv"
	"strings"

	"vimagination.zapto.org/keystore"
	"vimagination.zapto.org/memio"
)

type assetsDir struct {
	folders
	handler http.Handler
}

func (a *assetsDir) Init(b *Battlemap) error {
	var (
		location keystore.String
		locname  string
	)
	switch a.fileType {
	case fileTypeImage:
		locname = "ImageAssetsDir"
	case fileTypeAudio:
		locname = "AudioAssetsDir"
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
	a.handler = http.FileServer(http.Dir(l))
	return a.folders.Init(b, assetStore)
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
		_, err = gft.ReadFrom(p)
		if err != nil {
			return err
		}
		if gft.Type != a.fileType {
			continue
		}
		a.mu.Lock()
		a.lastID++
		id := a.lastID
		a.links[id] = 1
		a.mu.Unlock()
		idStr := strconv.FormatUint(id, 10)
		if err = a.Set(idStr, bufReaderWriterTo{gft.Buffer[:gft.BufLen], p}); err != nil {
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
	w.Write(buf)
	return nil
}

const invalidFilenameChars = "\x00\r\n\\/"

// Errors
var (
	ErrInvalidFileType = errors.New("invalid file type")
)
