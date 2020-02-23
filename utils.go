package battlemap

import (
	"io"
	"net/http"

	"vimagination.zapto.org/httpaccept"
)

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

type fileType uint8

const (
	fileTypeUnknown fileType = iota
	fileTypeImage
	fileTypeAudio
	fileTypeCharacter
	fileTypeMap
)

func getType(mime string) fileType {
	switch mime {
	case "image/gif", "image/png", "image/jpeg", "image/webp", "video/apng":
		return fileTypeImage
	case "application/ogg", "audio/mpeg":
		return fileTypeAudio
	case "text/plain":
		return fileTypeCharacter
	case "text/xml":
		return fileTypeMap
	}
	return fileTypeUnknown
}

type getFileType struct {
	Buffer [512]byte
	BufLen int
	Type   fileType
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
