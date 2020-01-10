package battlemap

import (
	"bufio"
	"encoding/json"
	"encoding/xml"
	"fmt"
	"io"
	"net/http"
	"path"
	"strconv"
	"strings"

	"vimagination.zapto.org/httpaccept"
	"vimagination.zapto.org/memio"
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
			if folder := a.getFolder(path); folder != nil {
				if id, ok := folder.Assets[file]; ok {
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
	if a.auth.IsAdmin(r) {
		if r.URL.Path == tagsPath {
			a.patchTags(w, r)
			return true
		} else if !isRoot(r.URL.Path) {
			a.patchAssets(w, r)
			return true
		}
	}
	return false

}

func (a *assetsDir) patchTags(w http.ResponseWriter, r *http.Request) {
	var (
		at AcceptType
		tp struct {
			Add    []string `json:"add" xml:"add"`
			Remove []uint64 `json:"remove" xml:"remove"`
			Rename Tags     `json:"rename" xml:"rename"`
		}
		err error
	)
	switch r.Header.Get(contentType) {
	case "application/json", "text/json":
		at = "json"
		err = json.NewDecoder(r.Body).Decode(&tp)
	case "text/xml":
		at = "xml"
		err = xml.NewDecoder(r.Body).Decode(&tp)
	default:
		br := bufio.NewReader(r.Body)
	Loop:
		for {
			switch method, _ := br.ReadByte(); method {
			case '>':
				var tag string
				_, err = fmt.Fscanf(br, "%q", &tag)
				if err != nil {
					break Loop
				}
				tp.Add = append(tp.Add, tag)
			case '<':
				var tid uint64
				_, err = fmt.Fscanf(br, "%d", &tid)
				if err != nil {
					break Loop
				}
				tp.Remove = append(tp.Remove, tid)
			case '~':
				tag := new(Tag)
				_, err = fmt.Fscanf(br, "%d:%q", &tag.ID, &tag.Name)
				if err != nil {
					break Loop
				}
				tp.Rename[tag.ID] = tag
			case '\n':
			default:
				break Loop
			}
		}
	}
	r.Body.Close()
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	var change bool
	id := SocketIDFromRequest(r)
	if len(tp.Remove) > 0 {
		a.assetMu.Lock() //need to lock in this order!
		a.tagMu.Lock()
		tags := make([]*Tag, 0, len(tp.Remove))
		for _, tid := range tp.Remove {
			if tag, ok := a.tags[tid]; ok {
				tags = append(tags, tag)
			}
		}
		change = a.deleteTags(tags...)
		a.assetMu.Unlock()
		a.socket.BroadcastTagRemove(tp.Remove, id)
	} else {
		a.tagMu.Lock()
	}
	newTags := make(Tags, len(tp.Add)+len(tp.Rename))
	for _, tag := range tp.Rename {
		t, ok := a.tags[tag.ID]
		if !ok {
			continue
		}
		if a.renameTag(t, tag.Name) {
			change = true
			newTags[t.ID] = t
		}
	}
	for _, tagName := range tp.Add {
		tag := a.addTag(tagName)
		newTags[tag.ID] = tag
		change = true
	}
	if change {
		a.writeTags() // handle error??
		a.tagMu.Unlock()
		httpaccept.HandleAccept(r, &at)
		switch at {
		case "json":
			w.Header().Set(contentType, "application/json")
			json.NewEncoder(w).Encode(newTags)
		case "xml":
			w.Header().Set(contentType, "text/xml")
			xml.NewEncoder(w).EncodeElement(struct {
				Tags `xml:"tag"`
			}{newTags}, xml.StartElement{Name: xml.Name{Local: "tags"}})
		default:
			w.Header().Set(contentType, "text/plain")
			for _, tag := range newTags {
				fmt.Fprintf(w, "%d:%q\n", tag.ID, tag.Name)
			}
		}
		a.socket.BroadcastTagsAdd(newTags, id)
	} else {
		a.tagMu.Unlock()
		w.WriteHeader(http.StatusNoContent)
	}
}

func (a *assetsDir) patchAssets(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.ParseUint(strings.TrimPrefix(r.URL.Path, "/"), 10, 0)
	if err != nil {
		http.NotFound(w, r)
		return
	}
	var (
		at AcceptType
		ap struct {
			AddTag    []uint64 `json:"addTag" xml:"addTag"`
			RemoveTag []uint64 `json:"removeTag" xml:"removeTag"`
			Rename    string   `json:"rename" xml:"rename"`
		}
	)
	switch r.Header.Get(contentType) {
	case "application/json", "text/json":
		at = "json"
		err = json.NewDecoder(r.Body).Decode(&ap)
	case "text/xml":
		at = "xml"
		err = xml.NewDecoder(r.Body).Decode(&ap)
	default:
		br := bufio.NewReader(r.Body)
	Loop:
		for {
			switch method, _ := br.ReadByte(); method {
			case '>':
				var tid uint64
				_, err = fmt.Fscanf(br, "%d", &tid)
				if err != nil {
					break Loop
				}
				ap.AddTag = append(ap.AddTag, tid)
			case '<':
				var tid uint64
				_, err = fmt.Fscanf(br, "%d", &tid)
				if err != nil {
					break Loop
				}
				ap.RemoveTag = append(ap.RemoveTag, tid)
			case '~':
				var newName string
				_, err = fmt.Fscanf(br, "%q", &newName)
				if err != nil {
					break Loop
				}
				ap.Rename = newName
			case '\n':
			default:
				break Loop
			}
		}
	}
	r.Body.Close()
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	httpaccept.HandleAccept(r, &at)
	a.assetMu.Lock()
	as, ok := a.assets[id]
	if !ok {
		a.assetMu.Unlock()
		http.NotFound(w, r)
		return
	}
	if a.modifyAsset(as, ap.Rename, ap.RemoveTag, ap.AddTag, SocketIDFromRequest(r)) {
		var buf memio.Buffer
		switch at {
		case "json":
			w.Header().Set(contentType, "application/json")
			json.NewEncoder(&buf).Encode(as)
		case "xml":
			w.Header().Set(contentType, "text/xml")
			xml.NewEncoder(&buf).EncodeElement(as, xml.StartElement{Name: xml.Name{Local: "asset"}})
		default:
			w.Header().Set(contentType, "text/plain")
			fmt.Fprintf(&buf, "%d:%q\n%v\n", as.ID, as.Name, as.Tags)
		}
		a.assetMu.Unlock()
		w.Write(buf)
	} else {
		a.assetMu.Unlock()
		w.WriteHeader(http.StatusNoContent)
	}
}
