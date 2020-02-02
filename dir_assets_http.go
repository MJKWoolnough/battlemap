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
	} else if a.assetStore.Exists(r.URL.Path) && r.URL.Path != assetsMetadata {
		w.Header().Set("Allow", "OPTIONS, GET, HEAD")
	} else {
		http.NotFound(w, r)
	}
}

func (a *assetsDir) Get(w http.ResponseWriter, r *http.Request) bool {
	if r.URL.Path == assetsMetadata {
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
		a.assetMu.Lock()
		a.lastAssetID++
		id := a.lastAssetID
		a.assetLinks[id] = 1
		a.assetMu.Unlock()
		idStr := strconv.FormatUint(id, 10)
		if err = a.assetStore.Set(idStr, bufReaderWriterTo{gft.Buffer[:gft.BufLen], p}); err != nil {
			http.Error(w, err.Error(), http.StatusBadRequest)
			return true
		}
		filename := p.FileName()
		if filename == "" || strings.ContainsAny(filename, invalidFilenameChars) {
			filename = idStr
		}
		newName := addAssetTo(a.assetFolders.Assets, filename, id)
		added = append(added, idName{id, newName})
	}
	if len(added) == 0 {
		w.WriteHeader(http.StatusNoContent)
		return true
	}
	a.assetMu.Lock()
	a.saveFolders()
	a.assetMu.Unlock()
	w.Header().Set(contentType, "text/plain")
	for _, id := range added {
		fmt.Fprintf(w, "%d:%s\n", id.ID, id.Name)
	}
	a.socket.BroadcastAssetsAdd(a.fileType, added, SocketIDFromRequest(r))
	return true
}

const invalidFilenameChars = "\x00\r\n\\/"
