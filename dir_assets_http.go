package battlemap

import (
	"fmt"
	"io"
	"net/http"
	"strconv"
	"strings"
)

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

type idName struct {
	ID   uint64 `json:"id"`
	Name string `json:"name"`
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
		if err = a.assetStore.Set(idStr, bufReaderWriterTo{gft.Buffer[:gft.BufLen], p}); err != nil {
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
	w.Header().Set(contentType, "application/json")
	fmt.Fprintf(w, "{%q:%d", added[0].Name, added[0].ID)
	for _, id := range added[1:] {
		fmt.Fprintf(w, ",%q:%d", id.Name, id.ID)
	}
	fmt.Fprint(w, "}")
	bid := broadcastImageItemAdd
	if a.fileType == fileTypeAudio {
		bid--
	}
	a.socket.broadcastAdminChange(bid, added, SocketIDFromRequest(r))
	return nil
}

const invalidFilenameChars = "\x00\r\n\\/"
