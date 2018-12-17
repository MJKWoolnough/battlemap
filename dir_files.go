package main

import (
	"io"
	"net/http"
	"os"
	"path"
	"path/filepath"
	"strings"
)

type files struct {
	location string
	http.Handler
}

func (f *files) Init() {
	Config.RLock()
	f.location = Config.FilesDir
	Config.RUnlock()
	f.Handler = http.FileServer(http.Dir(f.location))
}

func (f *files) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	filename := filepath.Join(f.location, filepath.Clean(filepath.FromSlash(r.URL.Path)))
	switch r.Method {
	case http.MethodOptions:
		if Auth.IsAdmin(r) {
			if r.URL.Path == "/" {
				w.Header().Set("Allow", "OPTIONS, GET, HEAD, POST")
			} else {
				w.Header().Set("Allow", "OPTIONS, GET, HEAD, PUT, DELETE")
				if !fileExists(filename) {
					w.WriteHeader(http.StatusNotFound)
				}
			}
		} else {
			w.Header().Set("Allow", "OPTIONS, GET, HEAD")
		}
		return
	case http.MethodGet, http.MethodHead:
		f.Handler.ServeHTTP(w, r)
	case http.MethodPut:
		if r.URL.Path != "/" && Auth.IsAdmin(r) {
			newFile := !fileExists(filename)
			err := uploadFile(r.Body, filename)
			r.Body.Close()
			if err != nil {
				http.Error(w, err.Error(), http.StatusInternalServerError)
				return
			}
			w.Header().Set("Content-Location", path.Join("/files", r.URL.Path))
			if newFile {
				w.WriteHeader(http.StatusCreated)
			} else {
				w.WriteHeader(http.StatusNoContent)
			}
			return
		}
	case http.MethodPost:
		if r.URL.Path == "/" && Auth.IsAdmin(r) {
			m, err := r.MultipartReader()
			if err != nil {
				w.WriteHeader(http.StatusBadRequest)
				io.WriteString(w, err.Error())
				return
			}
			for {
				p, err := m.NextPart()
				if err != nil {
					if err == io.EOF {
						break
					}
					w.WriteHeader(http.StatusBadRequest)
					io.WriteString(w, err.Error())
					return
				}
				name := p.FileName()
				if name == "" || strings.IndexByte(name, '/') >= 0 {
					continue
				}
				if err := uploadFile(p, filepath.Join(f.location, name)); err != nil {
					http.Error(w, err.Error(), http.StatusInternalServerError)
					return
				}
			}
		}
	case http.MethodDelete:
		if Auth.IsAdmin(r) && r.URL.Path != "/" {
			file := filepath.Join(f.location, filepath.Clean(filepath.FromSlash(r.URL.Path)))
			if err := os.Remove(file); err != nil {
				if os.IsNotExist(err) {
					http.NotFound(w, r)
					return
				}
				http.Error(w, err.Error(), http.StatusInternalServerError)
				return
			}
			w.WriteHeader(http.StatusNoContent)
			return
		}
	}
	w.WriteHeader(http.StatusMethodNotAllowed)
}

var Files files
