package battlemap

import (
	"fmt"
	"io"
	"net/http"
	"strconv"
	"strings"
)

func (a *assetsDir) Options(w http.ResponseWriter, r *http.Request) {
	if r.URL.Path == "" && a.auth.IsAdmin(r) {
		w.Header().Set("Allow", "OPTIONS, GET, HEAD, POST")
	} else if a.assetStore.Exists(r.URL.Path) && r.URL.Path != folderMetadata {
		w.Header().Set("Allow", "OPTIONS, GET, HEAD")
	} else {
		http.NotFound(w, r)
	}
}

func (a *assetsDir) Get(w http.ResponseWriter, r *http.Request) bool {
	if r.URL.Path == folderMetadata {
		http.NotFound(w, r)
	} else {
		a.handler.ServeHTTP(w, r)
	}
	return true
}

type idName struct {
	ID   uint64 `json:"id"`
	Name string `json:"name"`
}

func (a *assetsDir) Post(w http.ResponseWriter, r *http.Request) bool {
	if r.URL.Path != "" || !a.auth.IsAdmin(r) {
		return false
	}
	m, err := r.MultipartReader()
	defer r.Body.Close()
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return true
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
			http.Error(w, err.Error(), http.StatusBadRequest)
			return true
		}
		gft.Type = fileTypeUnknown
		_, err = gft.ReadFrom(p)
		if err != nil {
			http.Error(w, err.Error(), http.StatusBadRequest)
			return true
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
			http.Error(w, err.Error(), http.StatusBadRequest)
			return true
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
		return true
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
	bid := int64(broadcastImageItemAdd)
	if a.fileType == fileTypeAudio {
		bid--
	}
	a.socket.broadcastAdminChange(bid, added, SocketIDFromRequest(r))
	return true
}

const invalidFilenameChars = "\x00\r\n\\/"
