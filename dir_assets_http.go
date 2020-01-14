package battlemap

import (
	"fmt"
	"io"
	"net/http"
	"path"
	"strconv"
	"strings"
)

func (a *assetsDir) Options(w http.ResponseWriter, r *http.Request) {
	if a.auth.IsAdmin(r) {
		if strings.HasPrefix(r.URL.Path, "root/") {
			if a.exists(r.URL.Path[5:]) {
				w.Header().Set("Allow", "OPTIONS, GET, HEAD, DELETE, PATCH")
			} else {
				w.Header().Set("Allow", "OPTIONS, PATCH")
			}
			w.Header().Set("Accept-Patch", "text/plain")
		} else {
			if r.URL.Path == "" {
				w.Header().Set("Allow", "OPTIONS, GET, HEAD, POST")
			} else if r.URL.Path != assetsMetadata && a.assetStore.Exists(r.URL.Path) {
				w.Header().Set("Allow", "OPTIONS, GET, HEAD, PATCH, PUT, DELETE")
				w.Header().Set("Accept-Patch", "text/plain")
			} else {
				http.NotFound(w, r)
			}
		}
	} else if a.assetStore.Exists(r.URL.Path) {
		w.Header().Set("Allow", "OPTIONS, GET, HEAD")
	} else {
		http.NotFound(w, r)
	}
}

func (a *assetsDir) Get(w http.ResponseWriter, r *http.Request) bool {
	if a.auth.IsAdmin(r) {
		if r.URL.Path == "" {
			a.assetMu.RLock()
			j := a.assetJSON
			a.assetMu.RUnlock()
			w.Header().Set("Content-Type", "application/json")
			w.Header().Set("Content-Length", strconv.Itoa(len(j)))
			w.Write(j)
			return true
		} else if strings.HasPrefix(r.URL.Path, "root/") {
			path, file := path.Split(r.URL.Path[5:])
			a.assetMu.RLock()
			folder := a.getFolder(path)
			if folder != nil {
				if id, ok := folder.Assets[file]; ok {
					a.assetMu.RUnlock()
					rel := "../"
					for _, c := range path {
						if c == '/' {
							rel += "../"
						}
					}
					http.Redirect(w, r, fmt.Sprintf("%s%d", rel, id), http.StatusFound)
					return true
				}
			}
			a.assetMu.RUnlock()
		}
	}
	if r.URL.Path == assetsMetadata {
		http.NotFound(w, r)
	} else {
		a.handler.ServeHTTP(w, r)
	}
	return true
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
		added []uint64
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
		id := a.nextAssetID
		a.nextAssetID++
		a.assetLinks[id] = 1
		a.assetMu.Unlock()
		idStr := strconv.FormatUint(id, 10)
		if err = a.assetStore.Set(idStr, bufReaderWriterTo{gft.Buffer[:gft.BufLen], p}); err != nil {
			http.Error(w, err.Error(), http.StatusBadRequest)
			return true
		}
		filename := p.FileName()
		if filename == "" {
			filename = idStr
		}
		addTo(a.assetFolders.Assets, filename, id)
		added = append(added, id)
	}
	if len(added) == 0 {
		w.WriteHeader(http.StatusNoContent)
		return true
	}
	a.saveFolders()
	w.Header().Set(contentType, "text/plain")
	for _, id := range added {
		fmt.Fprintln(w, id)
	}
	a.socket.BroadcastAssetsAdd(added, SocketIDFromRequest(r))
	return true
}

func (a *assetsDir) Put(w http.ResponseWriter, r *http.Request) bool {
	if r.URL.Path == "" || !a.auth.IsAdmin(r) {
		return false
	}
	idStr := strings.TrimLeft(r.URL.Path, "0")
	id, err := strconv.ParseUint(idStr, 10, 0)
	if err != nil {
		return false
	}
	a.assetMu.Lock()
	_, ok := a.assetLinks[id]
	a.assetMu.Unlock()
	if !ok {
		return false
	}
	var gft getFileType
	_, err = gft.ReadFrom(r.Body)
	defer r.Body.Close()
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return true
	}
	if gft.Type != a.fileType {
		http.Error(w, "incorrect file type", http.StatusUnsupportedMediaType)
		return true
	}
	if err = a.assetStore.Set(idStr, bufReaderWriterTo{gft.Buffer[:gft.BufLen], r.Body}); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return true
	}
	w.WriteHeader(http.StatusNoContent)
	return true
}

func (a *assetsDir) Delete(w http.ResponseWriter, r *http.Request) bool {
	if r.URL.Path == "" || !a.auth.IsAdmin(r) {
		return false
	}
	if strings.HasPrefix(r.URL.Path, "root/") {
		path, file := path.Split(r.URL.Path[5:])
		a.assetMu.Lock()
		folder := a.getFolder(path)
		if folder == nil {
			a.assetMu.Unlock()
			http.NotFound(w, r)
			return true
		}
		if file == "" {
			lastSlash := strings.LastIndexByte(path[:len(path)-1], '/')
			parentPath := path[:lastSlash]
			delete(a.getFolder(parentPath).Folders, path[lastSlash+1:len(path)-1])
			walkFolders(folder, func(assets map[string]uint64) {
				for _, id := range assets {
					newCount := a.assetLinks[id] - 1
					if newCount == 0 {
						delete(a.assetLinks, id)
						a.assetStore.Remove(strconv.FormatUint(id, 10))
					} else {
						a.assetLinks[id] = newCount
					}
				}
			})
		} else {
			id := folder.Assets[file]
			delete(folder.Assets, file)
			newCount := a.assetLinks[id] - 1
			if newCount == 0 {
				delete(a.assetLinks, id)
				a.assetStore.Remove(strconv.FormatUint(id, 10))
				a.socket.BroadcastAssetRemove(id, SocketIDFromRequest(r))
			} else {
				a.assetLinks[id] = newCount
			}
		}
		a.assetMu.Unlock()
	} else {
		id, err := strconv.ParseUint(r.URL.Path, 10, 0)
		if err != nil {
			http.NotFound(w, r)
			return true
		}
		delete(a.assetLinks, id)
		walkFolders(a.assetFolders, func(assets map[string]uint64) {
			for name, aid := range assets {
				if id == aid {
					delete(assets, name)
				}
			}
		})
		a.socket.BroadcastAssetRemove(id, SocketIDFromRequest(r))
	}
	a.assetMu.Lock()
	w.WriteHeader(http.StatusNoContent)
	return true
}

func (a *assetsDir) Patch(w http.ResponseWriter, r *http.Request) bool {
	if !strings.HasPrefix(r.URL.Path, "root/") || !a.auth.IsAdmin(r) {
		return false
	}
	name := make([]byte, 1024)
	n, err := io.ReadFull(r.Body, name) // check for invalid chars '/', '\0', etc.
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return true
	}
	path, file := path.Split(r.URL.Path[5:])
	a.assetMu.Lock()
	if file == "" {
		lastSlash := strings.LastIndexByte(path[:len(path)-1], '/')
		parentPath := path[:lastSlash]
		thisPath := path[lastSlash+1 : len(path)-1]
		parent := a.getFolder(parentPath)
		if parent == nil {
			http.NotFound(w, r)
		} else {
			f, ok := parent.Folders[thisPath]
			if !ok {
				http.NotFound(w, r)
			} else {
				delete(parent.Folders, thisPath)
				parent.Folders[string(name[:n])] = f
				// broadcast folder rename
			}
		}
	} else {
		folder := a.getFolder(path)
		if folder == nil {
			http.NotFound(w, r)
		} else {
			aid, ok := folder.Assets[file]
			if !ok {
				if aid, err := strconv.ParseUint(string(name[:n]), 10, 64); err != nil {
					http.Error(w, "invalid ID", http.StatusBadRequest)
				} else if links, ok := a.assetLinks[aid]; !ok {
					http.Error(w, "invalid ID", http.StatusBadRequest)
				} else {
					addAssetTo(folder.Assets, file, aid)
					a.assetLinks[aid] = links + 1
					// broadcast asset link
				}
			} else {
				delete(folder.Assets, file)
				addAssetTo(folder.Assets, string(name[:n]), aid)
				// broadcast asset rename
			}
		}
	}
	a.assetMu.Unlock()
	return true
}
