package main

import (
	"io"
	"net/http"
)

type Methods interface {
	Delete(http.ResponseWriter, *http.Request) bool
	Get(http.ResponseWriter, *http.Request) bool
	Options(http.ResponseWriter, *http.Request)
	Patch(http.ResponseWriter, *http.Request) bool
	Post(http.ResponseWriter, *http.Request) bool
	Put(http.ResponseWriter, *http.Request) bool
}

type DefaultMethods struct{}

func (DefaultMethods) Delete(http.ResponseWriter, *http.Request) bool { return false }
func (DefaultMethods) Get(http.ResponseWriter, *http.Request) bool    { return false }
func (DefaultMethods) Patch(http.ResponseWriter, *http.Request) bool  { return false }
func (DefaultMethods) Post(http.ResponseWriter, *http.Request) bool   { return false }
func (DefaultMethods) Put(http.ResponseWriter, *http.Request) bool    { return false }

type Dir struct {
	Methods
}

func (d Dir) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	var success bool
	switch r.Method {
	case http.MethodOptions:
		d.Methods.Options(w, r)
		return
	case http.MethodDelete:
		success = d.Methods.Delete(w, r)
	case http.MethodGet, http.MethodHead:
		success = d.Methods.Get(w, r)
	case http.MethodPatch:
		success = d.Methods.Patch(w, r)
	case http.MethodPost:
		success = d.Methods.Post(w, r)
	case http.MethodPut:
		success = d.Methods.Put(w, r)
	}
	if !success {
		w.WriteHeader(http.StatusMethodNotAllowed)
	}
}

type readerWriterTo struct {
	Reader io.Reader
}

func (r readerWriterTo) WriteTo(w io.Writer) (int64, error) {
	return io.Copy(w, r.Reader)
}

type writerReaderFrom struct {
	Writer io.Writer
}

func (w writerReaderFrom) ReadFrom(r io.Reader) (int64, error) {
	return io.Copy(w.Writer, r)
}

type getFileType struct {
	Buffer [512]byte
	BufLen int
	Type   string
}

func (g *getFileType) ReadFrom(r io.Reader) (int64, error) {
	n, err := io.ReadFull(r, g.Buffer[:])
	if err != nil {
		return int64(n), err
	}
	g.BufLen = n
	g.Type = getType(http.DetectContentType(g.Buffer[:n]))
	return int64(n), nil
}

type bufReaderWriterTo struct {
	Buf    []byte
	Reader io.Reader
}

func (b bufReaderWriterTo) WriteTo(w io.Writer) (int64, error) {
	n, err := w.Write(b.Buf)
	if err != nil {
		return int64(n), err
	}
	m, err := io.Copy(w, b.Reader)
	return int64(n) + m, err
}
