package main

import (
	"bufio"
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
	Name, Filename, Type string
	Tags                 []int
}

type assets struct {
	location string
	http.Handler

	assetMu     sync.RWMutex
	nextAssetID uint
	assets      map[uint]Asset

	tagMu     sync.RWMutex
	nextTagID uint
	tags      map[uint]string
}

func (a *assets) Init() {
	Config.RLock()
	a.location = Config.AssetsDir
	Config.RUnlock()
	a.Handler = http.FileServer(http.Dir(a.location))
}

func (a *assets) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	filename := filepath.Join(a.location, filepath.Clean(filepath.FromSlash(r.URL.Path)))
	switch r.Method {
	case http.MethodOptions:
		if Auth.IsAdmin(r) {
			if r.URL.Path == "/" {
				w.Header().Set("Allow", "OPTIONS, GET, HEAD, POST")
				return
			} else if r.URL.Path == tagsPath {
				w.Header().Set("Allow", "OPTIONS, GET, HEAD, PATCH")
				return
			} else if fileExists(filename) {
				w.Header().Set("Allow", "OPTIONS, GET, HEAD, PATCH, PUT, DELETE")
				return
			}
		}
		w.Header().Set("Allow", "OPTIONS, GET, HEAD")
		return
	case http.MethodGet, http.MethodHead:
		if r.Header.Get(contentType) == jsonType && Auth.IsAdmin(r) {
			if r.URL.Path == "/" {

			} else if fileExists(filename) {

			} else {
				http.NotFound(w, r)
			}
		} else {
			if r.URL.Path == tagsPath {
				w.WriteHeader(http.StatusUnauthorized)
				return
			} else {
				a.Handler.ServeHTTP(w, r)
			}
		}
		return
	case http.MethodPost:
		if Auth.IsAdmin(r) {
			if r.URL.Path == "/" {
				m, err := r.MultipartReader()
				if err != nil {
					http.Error(w, err.Error(), http.StatusBadRequest)
					return
				}
				buf := make(memio.Buffer, 512)
				for {
					p, err := m.NextPart()
					if err != nil {
						if err == io.EOF {
							break
						}
						http.Error(w, err.Error(), http.StatusBadRequest)
						return
					}
					n, err := io.ReadFull(p, buf)
					if err != nil {
						http.Error(w, err.Error(), http.StatusBadRequest)
						return
					}
					var ctype, ext string
					switch http.DetectContentType(buf[:n]) {
					case "image/gif":
						ext = "gif"
						ctype = "image"
					case "image/png":
						ext = "png"
						ctype = "image"
					case "image/jpeg":
						ext = "jpg"
						ctype = "image"
					case "image/webp":
						ext = "webp"
						ctype = "image"
					case "application/ogg":
						ext = "ogg"
						ctype = "audio"
					case "audio/mpeg":
						ext = "mp3"
						ctype = "audio"
					case "text/html; charset=utf-8":
						ext = "html"
						ctype = "document"
					case "text/plain; charset=utf-8":
						ext = "txt"
						ctype = "document"
					case "application/pdf", "application/postscript":
						ext = "pdf"
						ctype = "document"
					case "video/mp4":
						ext = "mp4"
						ctype = "video"
					case "video/webm":
						ext = "webm"
						ctype = "video"
					default:
						continue
					}
					a.assetMu.Lock()
					id := a.nextAssetID
					a.nextAssetID++
					a.assetMu.Unlock()
					filename := strconv.FormatUint(uint64(id), 10) + "." + ext
					mBuf := buf[:n]
					if err := uploadFile(io.MultiReader(&mBuf, p), filepath.Join(a.location, filename)); err != nil {
						http.Error(w, err.Error(), http.StatusBadRequest)
						return
					}
					a.assetMu.Lock()
					a.assets[id] = Asset{
						Name:     p.FileName(),
						Filename: filename,
						Type:     ctype,
					}
					a.assetMu.Unlock()
				}
			} else if fileExists(filename) {

			}
		}
		return
	case http.MethodPatch:
	case http.MethodPut:
	case http.MethodDelete:
		if Auth.IsAdmin(r) && r.URL.Path != "/" && r.URL.Path != tagsPath {
			if err := os.Remove(filename); err != nil {
				if os.IsNotExist(err) {
					http.NotFound(w, r)
					return
				}
				w.WriteHeader(http.StatusInternalServerError)
				io.WriteString(w, err.Error())
				return
			}
			w.WriteHeader(http.StatusNoContent)
			return
		}
	}
	w.WriteHeader(http.StatusMethodNotAllowed)
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

const (
	tagsPath                          = "/tags"
	ErrInvalidMethodByte errors.Error = "invalid method byte"
)
