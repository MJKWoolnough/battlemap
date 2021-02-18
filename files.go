package battlemap

import (
	"fmt"
	"io"
	"net/http"
	"path"
	"path/filepath"
	"strings"

	"vimagination.zapto.org/keystore"
)

type filesDir struct {
	*Battlemap
	files *keystore.FileStore
	http.Handler
}

func (f *filesDir) Init(b *Battlemap, _ links) error {
	f.Battlemap = b
	var (
		location keystore.String
		err      error
	)
	b.config.Get("filesDir", &location)
	f.files, err = keystore.NewFileStore(filepath.Join(b.config.BaseDir, string(location)), "", keystore.NoMangle)
	if err != nil {
		return fmt.Errorf("error creating file store: %w", err)
	}
	f.Handler = http.FileServer(http.Dir(location))
	return nil
}

func (f *filesDir) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodGet:
		f.Handler.ServeHTTP(w, r)
		return
	case http.MethodPost:
		if isRoot(r.URL.Path) && f.auth.IsAdmin(r) {
			if err := f.Post(w, r); err != nil {
				http.Error(w, err.Error(), http.StatusBadRequest)
			}
			return
		}
	case http.MethodPut:
		if !isRoot(r.URL.Path) && f.auth.IsAdmin(r) {
			if err := f.Put(w, r); err != nil {
				http.Error(w, err.Error(), http.StatusBadRequest)
			}
			return
		}
	case http.MethodDelete:
		if f.auth.IsAdmin(r) && !isRoot(r.URL.Path) {
			if err := f.Delete(w, r); err != nil {
				http.Error(w, err.Error(), http.StatusBadRequest)
			}
			return
		}
	}
	http.Error(w, http.StatusText(http.StatusBadRequest), http.StatusBadRequest)
}

func (f *filesDir) Put(w http.ResponseWriter, r *http.Request) error {
	filename := filepath.FromSlash(r.URL.Path)
	newFile := !f.files.Exists(filename)
	err := f.files.Set(filename, readerWriterTo{r.Body})
	r.Body.Close()
	if err != nil {
		return err
	}
	w.Header().Set("Content-Location", path.Join("/files", r.URL.Path))
	if newFile {
		w.WriteHeader(http.StatusCreated)
	} else {
		w.WriteHeader(http.StatusNoContent)
	}
	return nil
}

func (f *filesDir) Post(w http.ResponseWriter, r *http.Request) error {
	m, err := r.MultipartReader()
	if err != nil {
		return err
	}
	var uploaded []string
	for {
		p, err := m.NextPart()
		if err != nil {
			if err == io.EOF {
				break
			}
			return err
		}
		name := p.FileName()
		if name == "" || strings.IndexByte(name, '/') >= 0 {
			continue
		}
		if err := f.files.Set(name, readerWriterTo{p}); err != nil {
			return err
		}
		uploaded = append(uploaded, name)
	}
	w.Header().Set("Content-Type", "text/plain; charset=utf-8")
	for _, file := range uploaded {
		fmt.Fprintln(w, file)
	}
	return nil
}

func (f *filesDir) Delete(w http.ResponseWriter, r *http.Request) error {
	if err := f.files.Remove(filepath.FromSlash(r.URL.Path)); err != nil {
		if err == keystore.ErrUnknownKey {
			http.NotFound(w, r)
			return nil
		}
		return err
	}
	w.WriteHeader(http.StatusNoContent)
	return nil
}

type readerWriterTo struct {
	Reader io.Reader
}

func (r readerWriterTo) WriteTo(w io.Writer) (int64, error) {
	return io.Copy(w, r.Reader)
}
