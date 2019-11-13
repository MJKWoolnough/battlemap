package battlemap

import (
	"compress/gzip"
	"encoding/json"
	"encoding/xml"
	"html/template"
	"io"
	"net/http"
	"time"

	"vimagination.zapto.org/httpaccept"
	"vimagination.zapto.org/httpdir"
	"vimagination.zapto.org/httpgzip"
	"vimagination.zapto.org/memio"
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
		d.Methods.Options(w, r)
		http.Error(w, http.StatusText(http.StatusMethodNotAllowed), http.StatusMethodNotAllowed)
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

func getType(mime string) string {
	switch mime {
	case "image/gif", "image/png", "image/jpeg", "image/webp", "video/apng":
		return "image"
	case "application/ogg", "audio/mpeg":
		return "audio"
	}
	return ""
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
	} else if m.Match("application/x-www-form-urlencoded") {
		*a = "form"
		return true
	}
	return false
}

func isRoot(path string) bool {
	return path == "/" || path == ""
}

var exts = [...]string{".html", ".json", ".xml"}

func genPages(t time.Time, list interface{}, htmlTemplate *template.Template, baseName, topTag, tag string, handler *http.Handler) []byte {
	d := httpdir.New(t)
	buf := genPagesDir(t, list, htmlTemplate, baseName, topTag, tag, &d)
	*handler = httpgzip.FileServer(d)
	return buf
}

func genPagesDir(t time.Time, list interface{}, htmlTemplate *template.Template, baseName, topTag, tag string, d *httpdir.Dir) []byte {
	var buffers [2 * len(exts)]memio.Buffer
	htmlTemplate.Execute(&buffers[0], list)
	json.NewEncoder(&buffers[1]).Encode(list)
	x := xml.NewEncoder(&buffers[2])
	var se = xml.StartElement{Name: xml.Name{Local: topTag}}
	x.EncodeToken(se)
	x.EncodeElement(list, xml.StartElement{Name: xml.Name{Local: tag}})
	x.EncodeToken(se.End())
	x.Flush()

	gw, _ := gzip.NewWriterLevel(nil, gzip.BestCompression)
	for i, ext := range exts {
		gw.Reset(&buffers[i+len(exts)])
		gw.Write(buffers[i])
		gw.Close()
		d.Create(baseName+ext, httpdir.FileBytes(buffers[i], t))
		d.Create(baseName+ext+".gz", httpdir.FileBytes(buffers[i], t))
	}
	return buffers[1]
}
