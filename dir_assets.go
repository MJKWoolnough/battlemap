package main

import (
	"bufio"
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"sync"

	"vimagination.zapto.org/errors"
	"vimagination.zapto.org/memio"
)

type Asset struct {
	Name, Mime string
	Tags       []int
}

type assets struct {
	DefaultMethods
	location string
	http.Handler

	assetMu     sync.RWMutex
	nextAssetID uint
	assets      map[uint]Asset

	tagMu     sync.RWMutex
	nextTagID uint
	tags      map[uint]string
}

func (a *assets) Init() error {
	Config.RLock()
	a.location = Config.AssetsDir
	Config.RUnlock()
	err := os.MkdirAll(a.location, os.ModeDir|0755)
	if err != nil {
		return errors.WithContext("error creating asset directory: ", err)
	}
	d, err := os.Open(a.location)
	if err != nil {
		return errors.WithContext("error open asset directory: ", err)
	}
	files, err := d.Readdirnames(-1)
	d.Close()
	if err != nil {
		return errors.WithContext("error reading asset directory:", err)
	}
	a.assets = make(map[uint]Asset)
	var largestAssetID, largestTagID uint64
	for _, file := range files {
		id, err := strconv.ParseUint(file, 10, 0)
		if err != nil {
			continue
		}
		f, err := os.Open(filepath.Join(a.location, file+".meta"))
		if err == nil {
			var as Asset
			err = json.NewDecoder(f).Decode(&as)
			if err == nil {
				a.assets[uint(id)] = as
			}
		}
		if err != nil {
			f, err = os.Open(filepath.Join(a.location, file))
			if err != nil {
				continue
			}
			buf := make([]byte, 512)
			n, err := io.ReadFull(f, buf)
			if err != nil && err != io.EOF {
				continue
			}
			mime := http.DetectContentType(buf[:n])
			if goodMime(mime) {
				a.assets[uint(id)] = Asset{
					Name: file,
					Mime: mime,
				}
			}
		}
		if id > largestAssetID {
			largestAssetID = id
		}
		f.Close()
	}
	f, err := os.Open(filepath.Join(a.location, a.location))
	if err == nil {
		b := bufio.NewReader(f)
		for {
			line, err := b.ReadBytes('\n')
			if err != nil {
				break
			}
			parts := bytes.SplitN(line, sep, 2)
			if len(parts) != 2 {
				continue
			}
			id, err := strconv.ParseUint(string(parts[0]), 10, 0)
			if err != nil {
				continue
			}
			a.tags[uint(id)] = string(bytes.TrimSuffix(parts[2], newLine))
			if id > largestTagID {
				largestTagID = id
			}
		}
		f.Close()
	}
	a.nextAssetID = uint(largestAssetID) + 1
	a.nextTagID = uint(largestTagID) + 1
	a.Handler = http.FileServer(http.Dir(a.location))
	return nil
}

var (
	sep     = []byte{':'}
	newLine = []byte{'\n'}
)

func goodMime(mime string) bool {
	switch mime {
	case "image/gif", "image/png", "image/jpeg", "image/webp", "application/ogg", "audio/mpeg", "text/html; charset=utf-8", "text/plain; charset=utf-8", "application/pdf", "application/postscript", "video/mp4", "video/webm":
		return true
	}
	return false
}

func (a *assets) Options(w http.ResponseWriter, r *http.Request) bool {
	filename := filepath.Join(a.location, filepath.Clean(filepath.FromSlash(r.URL.Path)))
	if !fileExists(filename) {
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
		w.Header().Set("Allow", "OPTIONS, GET, HEAD")
	}
	return true
}

func (a *assets) Get(w http.ResponseWriter, r *http.Request) bool {
	if strings.HasSuffix(r.URL.Path, ".meta") {
		http.NotFound(w, r)
	} else if Auth.IsAdmin(r) {
		filename := filepath.Join(a.location, filepath.Clean(filepath.FromSlash(r.URL.Path)))
		if r.Header.Get(contentType) == jsonType {
			if r.URL.Path == "/" {

			} else if r.URL.Path == tagsPath {

			} else if fileExists(filename) {

			} else {
				http.NotFound(w, r)
			}
		} else {
			a.Handler.ServeHTTP(w, r)
		}
	} else {
		if r.URL.Path == "/" {
			w.WriteHeader(http.StatusForbidden)
		} else if r.URL.Path == tagsPath {
			w.WriteHeader(http.StatusForbidden)
		} else {
			a.Handler.ServeHTTP(w, r)
		}
	}
	return true
}

func (a *assets) Post(w http.ResponseWriter, r *http.Request) bool {
	if Auth.IsAdmin(r) && r.URL.Path == "/" {
		m, err := r.MultipartReader()
		if err != nil {
			http.Error(w, err.Error(), http.StatusBadRequest)
			return true
		}
		buf := make(memio.Buffer, 512)
		var added []Tag
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
			var mime = http.DetectContentType(buf[:n])
			if !goodMime(mime) {
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
			as := Asset{
				Name: filename,
				Mime: mime,
			}
			err = json.NewEncoder(f).Encode(as)
			f.Close()
			if err != nil {
				http.Error(w, err.Error(), http.StatusInternalServerError)
				return true
			}
			a.assetMu.Lock()
			a.assets[id] = as
			a.assetMu.Unlock()
			added = append(added, Tag{ID: id, Name: filename})
		}
		w.Header().Set(contentType, jsonType)
		json.NewEncoder(w).Encode(added)
		return true
	}
	return false
}

func (a *assets) Delete(w http.ResponseWriter, r *http.Request) bool {
	if Auth.IsAdmin(r) && r.URL.Path != "/" && r.URL.Path != tagsPath {
		filename := filepath.Join(a.location, filepath.Clean(filepath.FromSlash(r.URL.Path)))
		if err := os.Remove(filename); err != nil {
			if os.IsNotExist(err) {
				http.NotFound(w, r)
				return true
			}
			w.WriteHeader(http.StatusInternalServerError)
			io.WriteString(w, err.Error())
			return true
		}
		w.WriteHeader(http.StatusNoContent)
		return true
	}
	return false
}

var Assets assets

type Tag struct {
	ID   uint   `json:"id" xml:"id,attr"`
	Name string `json:"name" xml:",chardata"`
}

type Tags []Tag

func (t Tags) WriteTo(w io.Writer) (int64, error) {
	var total int64
	for _, tag := range t {
		n, err := fmt.Fprintf(w, "%d,%s\n", tag.ID, tag.Name)
		total += int64(n)
		if err != nil {
			return total, err
		}
	}
	return total, nil
}

func (t Tags) Len() int {
	return len(t)
}

func (t Tags) Less(i, j int) bool {
	return t[i].ID < t[j].ID
}

func (t Tags) Swap(i, j int) {
	t[i], t[j] = t[j], t[i]
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
			idStr, err := b.ReadBytes(',')
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
			id, errb := strconv.ParseUint(string(strings.TrimSuffix(string(idStr), "\n")), 10, 0)
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

const (
	tagsPath                          = "/tags"
	ErrInvalidMethodByte errors.Error = "invalid method byte"
	ErrCannotMultiRename errors.Error = "cannot rename multiple times"
)
