package battlemap

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
{{end}}	</body>
</html>`))

type filesDir struct {
	*Battlemap
	DefaultMethods
	files *keystore.FileStore
	http.Handler
}

func (f *filesDir) Init(b *Battlemap) error {
	var (
		location keystore.String
		err      error
	)
	b.config.Get("filesDir", &location)
	f.files, err = keystore.NewFileStore(filepath.Join(b.config.BaseDir, string(location)), "", keystore.NoMangle)
	if err != nil {
		return errors.WithContext("error creating file store: ", err)
	}
	f.Handler = http.FileServer(http.Dir(location))
	f.Battlemap = b
	return nil
}

func (f *filesDir) Options(w http.ResponseWriter, r *http.Request) {
	if f.auth.IsAdmin(r) {
		if isRoot(r.URL.Path) {
			w.Header().Set("Allow", "OPTIONS, GET, HEAD, POST")
		} else {
			w.Header().Set("Allow", "OPTIONS, GET, HEAD, PUT, DELETE")
			if !f.files.Exists(filepath.FromSlash(strings.TrimLeft(r.URL.Path, "/"))) {
				http.NotFound(w, r)
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
	if !isRoot(r.URL.Path) && f.auth.IsAdmin(r) {
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
	if isRoot(r.URL.Path) && f.auth.IsAdmin(r) {
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
	if f.auth.IsAdmin(r) && !isRoot(r.URL.Path) {
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
