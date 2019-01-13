package main

import (
	"bufio"
	"encoding/json"
	"encoding/xml"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"strings"

	"vimagination.zapto.org/errors"
	"vimagination.zapto.org/httpaccept"
	"vimagination.zapto.org/memio"
)

func (a *assetsDir) Options(w http.ResponseWriter, r *http.Request) bool {
	filename := filepath.Join(a.location, filepath.Clean(filepath.FromSlash(r.URL.Path)))
	if strings.HasSuffix(filename, ".meta") || !fileExists(filename) {
		http.NotFound(w, r)
	} else if Auth.IsAdmin(r) {
		if r.URL.Path == "/" {
			w.Header().Set("Allow", "OPTIONS, GET, HEAD, POST")
		} else if r.URL.Path == tagsPath {
			w.Header().Set("Allow", "OPTIONS, GET, HEAD, PATCH")
		} else {
			w.Header().Set("Allow", "OPTIONS, GET, HEAD, PATCH, PUT, DELETE")
		}
	} else {
		if r.URL.Path == tagsPath {
			w.WriteHeader(http.StatusUnauthorized)
		} else {
			w.Header().Set("Allow", "OPTIONS, GET, HEAD")
		}
	}
	return true
}

type AcceptType string

func (a *AcceptType) Handle(m httpaccept.Mime) bool {
	if m.Match("text/plain") {
		*a = "txt"
		return true
	} else if m.Match("text/xml") {
		*a = "xml"
		return true
	} else if m.Match("application/json") || m.Match("text/json") || m.Match("text/x-json") {
		*a = "json"
		return true
	}
	return false
}

func (a *assetsDir) Get(w http.ResponseWriter, r *http.Request) bool {
	if strings.HasSuffix(r.URL.Path, ".meta") {
		http.NotFound(w, r)
	} else if Auth.IsAdmin(r) {
		handler := a.handler
		if r.URL.Path == "/" {
			if strings.EqualFold(r.Header.Get("Upgrade"), "websocket") && strings.Contains(strings.ToLower(r.Header.Get("Connection")), "upgrade") {
				a.websocket.ServeHTTP(w, r)
			} else {
				at := AcceptType("html")
				httpaccept.HandleAccept(r, &at)
				r.URL.Path += "index." + string(at)
				a.assetHandlerMu.RLock()
				handler = a.assetHandler
				a.assetHandlerMu.RUnlock()
			}
		} else if r.URL.Path == tagsPath {
			var at AcceptType
			if httpaccept.HandleAccept(r, &at) {
				r.URL.Path += string(at)
			}
			a.tagHandlerMu.RLock()
			handler = a.tagHandler
			a.tagHandlerMu.RUnlock()
		}
		handler.ServeHTTP(w, r)
	} else {
		if r.URL.Path == "/" || r.URL.Path == tagsPath {
			w.WriteHeader(http.StatusForbidden)
		} else {
			a.handler.ServeHTTP(w, r)
		}
	}
	return true
}

func (a *assetsDir) Post(w http.ResponseWriter, r *http.Request) bool {
	if !Auth.IsAdmin(r) || r.URL.Path != "/" {
		return false
	}
	m, err := r.MultipartReader()
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return true
	}
	buf := make(memio.Buffer, 512)
	var added Assets
	for {
		p, err := m.NextPart()
		if err != nil {
			if err == io.EOF {
				break
			}
			http.Error(w, err.Error(), http.StatusBadRequest)
			return true
		}
		n, err := io.ReadFull(p, buf)
		if err != nil {
			http.Error(w, err.Error(), http.StatusBadRequest)
			return true
		}
		var typ = getType(http.DetectContentType(buf[:n]))
		if typ == "" {
			continue
		}
		a.assetMu.Lock()
		id := a.nextAssetID
		a.nextAssetID++
		a.assetMu.Unlock()
		filename := strconv.FormatUint(uint64(id), 10)
		mBuf := buf[:n]
		fp := filepath.Join(a.location, filename)
		if err := uploadFile(io.MultiReader(&mBuf, p), fp); err != nil {
			http.Error(w, err.Error(), http.StatusBadRequest)
			return true
		}
		f, err := os.Create(fp + ".meta")
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return true
		}
		io.WriteString(f, filename)
		f.Close()
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return true
		}
		a.assetMu.Lock()
		a.assets[id] = &Asset{
			Name: filename,
			Type: typ,
		}
		a.assetMu.Unlock()
		added = append(added, Asset{ID: id, Name: filename})
	}
	if len(added) == 0 {
		w.WriteHeader(http.StatusNoContent)
		return true
	}
	a.assetMu.Lock()
	for n, asset := range added {
		a.writeAsset(asset.ID, n == len(added))
	}
	a.assetMu.Unlock()
	at := AcceptType("txt")
	httpaccept.HandleAccept(r, &at)
	switch at {
	case "txt":
		w.Header().Set(contentType, "text/plain")
		added.WriteTo(w)
	case "json":
		w.Header().Set(contentType, "application/json")
		json.NewEncoder(w).Encode(added)
	case "xml":
		w.Header().Set(contentType, "text/xml")
		xml.NewEncoder(w).EncodeElement(struct {
			Asset Assets `xml:"asset"`
		}{added}, xml.StartElement{Name: xml.Name{Local: "assets"}})
	}
	return true
}

func (a *assetsDir) Put(w http.ResponseWriter, r *http.Request) bool {
	if !Auth.IsAdmin(r) || r.URL.Path == "/" {
		return false
	}
	id, err := strconv.ParseUint(strings.TrimPrefix(r.URL.Path, "/"), 10, 0)
	if err != nil {
		http.NotFound(w, r)
		return true
	}
	a.assetMu.Lock()
	as, ok := a.assets[uint(id)]
	mime := as.Type
	a.assetMu.Unlock()
	if !ok {
		http.NotFound(w, r)
		return true
	}
	buf := make(memio.Buffer, 512)
	n, err := io.ReadFull(r.Body, buf)
	defer r.Body.Close()
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return true
	}
	if getType(http.DetectContentType(buf[:n])) != mime {
		http.Error(w, "incorrect file type", http.StatusUnsupportedMediaType)
		return true
	}
	mBuf := buf[:n]
	fp := filepath.Join(a.location, r.URL.Path)
	if err = uploadFile(io.MultiReader(&mBuf, r.Body), fp); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return true
	}
	w.WriteHeader(http.StatusNoContent)
	return true
}

func (a *assetsDir) Delete(w http.ResponseWriter, r *http.Request) bool {
	if Auth.IsAdmin(r) && r.URL.Path != "/" && r.URL.Path != tagsPath {
		id, err := strconv.ParseUint(strings.TrimPrefix(r.URL.Path, "/"), 10, 0)
		if err != nil {
			http.NotFound(w, r)
			return true
		}
		a.assetMu.Lock()
		if as, ok := a.assets[uint(id)]; ok {
			a.tagMu.Lock()
			err = a.deleteAsset(as)
			a.tagMu.Unlock()
		} else {
			err = ErrUnknownAsset
		}
		a.assetMu.Unlock()
		if err != nil {
			w.WriteHeader(http.StatusInternalServerError)
			io.WriteString(w, err.Error())
			return true
		}
		w.WriteHeader(http.StatusNoContent)
		return true
	}
	return false
}

func (a *assetsDir) Patch(w http.ResponseWriter, r *http.Request) bool {
	if Auth.IsAdmin(r) {
		if r.URL.Path == tagsPath {
			a.patchTags(w, r)
			return true
		} else if r.URL.Path != "/" {
			a.patchAssets(w, r)
			return true
		}
	}
	return false

}

func (a *assetsDir) patchTags(w http.ResponseWriter, r *http.Request) {
	var (
		at  AcceptType
		tp  TagPatch
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
		at = "txt"
		err = tp.Parse(r.Body)
	}
	r.Body.Close()
	if err != nil {
		w.WriteHeader(http.StatusInternalServerError)
		io.WriteString(w, err.Error())
		return
	}
	httpaccept.HandleAccept(r, &at)
	var change bool
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
	} else {
		a.tagMu.Lock()
	}
	newTags := make([]Tag, 0, len(tp.Add)+len(tp.Rename))
	for _, tag := range tp.Rename {
		t, ok := a.tags[tag.ID]
		if !ok {
			continue
		}
		if a.renameTag(t, tag.Name) {
			change = true
			newTags = append(newTags, *t)
		}
	}
	for _, tagName := range tp.Add {
		tag := a.addTag(tagName)
		newTags = append(newTags, *tag)
		change = true
	}
	if change {
		a.writeTags() // handle error??
		a.tagMu.Unlock()
		switch at {
		case "txt":
			w.Header().Set(contentType, "text/plain")
			for _, tag := range newTags {
				fmt.Fprintf(w, "%d:%s\n", tag.ID, tag.Name)
			}
		case "json":
			w.Header().Set(contentType, "application/json")
			json.NewEncoder(w).Encode(newTags)
		case "xml":
			w.Header().Set(contentType, "text/xml")
			xml.NewEncoder(w).EncodeElement(struct {
				Tag []Tag `xml:"tag"`
			}{newTags}, xml.StartElement{Name: xml.Name{Local: "tags"}})
		}
	} else {
		a.tagMu.Unlock()
		w.WriteHeader(http.StatusNoContent)
	}
}

func (a *assetsDir) patchAssets(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.ParseUint(r.URL.Path[1:], 10, 0)
	if err != nil {
		http.NotFound(w, r)
		return
	}
	var (
		at AcceptType
		ap AssetPatch
	)
	switch r.Header.Get(contentType) {
	case "application/json", "text/json":
		at = "json"
		err = json.NewDecoder(r.Body).Decode(&ap)
	case "text/xml":
		at = "xml"
		err = xml.NewDecoder(r.Body).Decode(&ap)
	default:
		at = "txt"
		err = ap.Parse(r.Body)
	}
	r.Body.Close()
	if err != nil {
		w.WriteHeader(http.StatusInternalServerError)
		io.WriteString(w, err.Error())
		return
	}
	httpaccept.HandleAccept(r, &at)
	a.assetMu.Lock()
	as, ok := a.assets[uint(id)]
	if !ok {
		a.assetMu.Unlock()
		http.NotFound(w, r)
		return
	}
	change := a.renameAsset(as, ap.Rename)
	if len(ap.RemoveTag) > 0 || len(ap.AddTag) > 0 {
		a.tagMu.Lock()
		change = a.removeTagsFromAsset(as, ap.RemoveTag...)
		change = change || a.addTagsToAsset(as, ap.AddTag...)
		a.tagMu.Unlock()
	}
	if change {
		a.writeAsset(as.ID, true)
		var buf memio.Buffer
		switch at {
		case "txt":
			w.Header().Set(contentType, "text/plain")
			as.WriteTo(&buf)
		case "json":
			w.Header().Set(contentType, "application/json")
			json.NewEncoder(&buf).Encode(as)
		case "xml":
			w.Header().Set(contentType, "text/xml")
			xml.NewEncoder(&buf).EncodeElement(as, xml.StartElement{Name: xml.Name{Local: "asset"}})
		}
		a.assetMu.Unlock()
		w.Write(buf)
	} else {
		a.assetMu.Unlock()
		w.WriteHeader(http.StatusNoContent)
	}
}

type TagPatch struct {
	Add    []string `json:"add" xml:"add"`
	Remove []uint   `json:"remove" xml:"remove"`
	Rename Tags     `json:"rename" xml:"rename"`
}

func (t *TagPatch) Parse(r io.Reader) error {
	b := bufio.NewReader(r)
	for {
		c, err := b.ReadByte()
		if err != nil {
			if err == io.EOF {
				return nil
			}
			return errors.WithContext("error reading method byte: ", err)
		}
		switch c {
		case '>':
			newTag, err := b.ReadBytes('\n')
			newTagStr := strings.TrimSuffix(string(newTag), "\n")
			if len(newTagStr) > 0 {
				t.Add = append(t.Add, newTagStr)
			}
			if err != nil {
				if err == io.EOF {
					return nil
				}
				return errors.WithContext("error reading new tag name: ", err)
			}
		case '<':
			idStr, err := b.ReadBytes('\n')
			id, errb := strconv.ParseUint(string(strings.TrimSuffix(string(idStr), "\n")), 10, 0)
			t.Remove = append(t.Remove, uint(id))
			if err != nil {
				if err == io.EOF {
					return nil
				}
				return errors.WithContext("error read remove id: ", err)
			} else if errb != nil {
				return errors.WithContext("error parsing remove id: ", errb)
			}
		case '~':
			idStr, err := b.ReadBytes(':')
			var newName []byte
			if err == nil {
				newName, err = b.ReadBytes('\n')
			}
			id, errb := strconv.ParseUint(string(strings.TrimSuffix(string(idStr), "\n")), 10, 0)
			newNameStr := strings.TrimSuffix(string(newName), "\n")
			t.Rename = append(t.Rename, Tag{ID: uint(id), Name: newNameStr})
			if err != nil {
				if err == io.EOF {
					return nil
				}
				return errors.WithContext("error parsing rename id:", errb)
			} else if errb != nil {
				return errors.WithContext("error read tag new name: ", errb)
			}
		default:
			return ErrInvalidMethodByte
		}
	}
}

type AssetPatch struct {
	AddTag    []uint `json:"addTag" xml:"addTag"`
	RemoveTag []uint `json:"removeTag" xml:"removeTag"`
	Rename    string `json:"rename" xml:"rename"`
}

func (a *AssetPatch) Parse(r io.Reader) error {
	b := bufio.NewReader(r)
	for {
		c, err := b.ReadByte()
		if err != nil {
			if err == io.EOF {
				return nil
			}
			return errors.WithContext("error reading method byte: ", err)
		}
		switch c {
		case '>':
			idStr, err := b.ReadBytes('\n')
			id, errb := strconv.ParseUint(string(strings.TrimSuffix(string(idStr), "\n")), 10, 0)
			a.AddTag = append(a.AddTag, uint(id))
			if err != nil {
				if err == io.EOF {
					return nil
				}
				return errors.WithContext("error reading tag id:", err)
			} else if errb != nil {
				return errors.WithContext("error parsing tag id: ", errb)
			}
		case '<':
			idStr, err := b.ReadBytes('\n')
			id, errb := strconv.ParseUint(strings.TrimSuffix(string(idStr), "\n"), 10, 0)
			a.RemoveTag = append(a.RemoveTag, uint(id))
			if err != nil {
				if err == io.EOF {
					return nil
				}
				return errors.WithContext("error reading tag id:", err)
			} else if errb != nil {
				return errors.WithContext("error parsing tag id: ", errb)
			}
		case '~':
			if a.Rename != "" {
				return ErrCannotMultiRename
			}
			newName, err := b.ReadBytes('\n')
			a.Rename = strings.TrimSuffix(string(newName), "\n")
			if err != nil {
				if err == io.EOF {
					return nil
				}
				return errors.WithContext("error reading new asset name: ", err)
			}
		default:
			return ErrInvalidMethodByte
		}
	}
}
