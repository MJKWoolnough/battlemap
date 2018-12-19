package main

import (
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"sync"

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
			} else if fileExists(filename) {
				w.Header().Set("Allow", "OPTIONS, GET, HEAD, POST, DELETE")
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
			a.Handler.ServeHTTP(w, r)
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
					if err := uploadFile(io.MultiReader(buf[:n], p), filepath.Joing(a.location, filename)); err != nil {
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
	case http.MethodDelete:
		if Auth.IsAdmin(r) && r.URL.Path != "/" {
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
