package main

import (
	"html/template"
	"io"
	"net/http"
	"path"
	"path/filepath"
	"strings"

	"vimagination.zapto.org/errors"
	"vimagination.zapto.org/keystore"
)

var linkTemplate = template.Must(template.New("").Parse(`<html>
	<head>
		<title>Uploads</title>
	</head>
	<body>
		{{range .}}<a href="{{.}}">{{.}}</a><br />
{{end}}
	</body>
</html>`))

type filesDir struct {
	DefaultMethods
	files *keystore.FileStore
	http.Handler
}

func (f *filesDir) Init() error {
	var (
		location keystore.String
		err      error
	)
	Config.Get("filesDir", &location)
	f.files, err = keystore.NewFileStore(filepath.Join(Config.BaseDir, string(location)), "", keystore.NoMangle)
	if err != nil {
		return errors.WithContext("error creating file store: ", err)
	}
	f.Handler = http.FileServer(http.Dir(location))
	return nil
}

func (f *filesDir) Options(w http.ResponseWriter, r *http.Request) {
	if Auth.IsAdmin(r) {
		if r.URL.Path == "/" {
			w.Header().Set("Allow", "OPTIONS, GET, HEAD, POST")
		} else {
			w.Header().Set("Allow", "OPTIONS, GET, HEAD, PUT, DELETE")
			if !f.files.Exists(filepath.FromSlash(strings.TrimLeft(r.URL.Path, "/"))) {
				w.WriteHeader(http.StatusNotFound)
			}
		}
	} else {
		w.Header().Set("Allow", "OPTIONS, GET, HEAD")
	}
}

func (f *filesDir) Get(w http.ResponseWriter, r *http.Request) bool {
	f.Handler.ServeHTTP(w, r)
	return true
}

func (f *filesDir) Put(w http.ResponseWriter, r *http.Request) bool {
	if r.URL.Path != "/" && Auth.IsAdmin(r) {
		filename := filepath.FromSlash(r.URL.Path)
		newFile := !f.files.Exists(filename)
		err := f.files.Set(filename, readerWriterTo{r.Body})
		r.Body.Close()
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return true
		}
		w.Header().Set("Content-Location", path.Join("/files", r.URL.Path))
		if newFile {
			w.WriteHeader(http.StatusCreated)
		} else {
			w.WriteHeader(http.StatusNoContent)
		}
		return true
	}
	return false
}

func (f *filesDir) Post(w http.ResponseWriter, r *http.Request) bool {
	if r.URL.Path == "/" && Auth.IsAdmin(r) {
		m, err := r.MultipartReader()
		if err != nil {
			http.Error(w, err.Error(), http.StatusBadRequest)
			return true
		}
		var uploaded []string
		for {
			p, err := m.NextPart()
			if err != nil {
				if err == io.EOF {
					break
				}
				http.Error(w, err.Error(), http.StatusBadRequest)
				return true
			}
			name := p.FileName()
			if name == "" || strings.IndexByte(name, '/') >= 0 {
				continue
			}
			if err := f.files.Set(name, readerWriterTo{p}); err != nil {
				http.Error(w, err.Error(), http.StatusInternalServerError)
				return true
			}
			uploaded = append(uploaded, name)
		}
		w.Header().Set("Content-Type", "text/html; charset=utf-8")
		linkTemplate.Execute(w, uploaded)
		return true
	}
	return false
}

func (f *filesDir) Delete(w http.ResponseWriter, r *http.Request) bool {
	if Auth.IsAdmin(r) && r.URL.Path != "/" {
		if err := f.files.Remove(filepath.FromSlash(r.URL.Path)); err != nil {
			if err == keystore.ErrUnknownKey {
				http.NotFound(w, r)
				return true
			}
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return true
		}
		w.WriteHeader(http.StatusNoContent)
		return true
	}
	return false
}

var FilesDir filesDir
