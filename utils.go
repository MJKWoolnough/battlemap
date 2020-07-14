package battlemap

import (
	"io"
	"net/http"

	"vimagination.zapto.org/httpaccept"
)

type fileType uint8

const (
	fileTypeUnknown fileType = iota
	fileTypeImage
	fileTypeAudio
	fileTypeKeystore
	fileTypeMap
)

func getType(mime string) fileType {
	switch mime {
	case "image/gif", "image/png", "image/jpeg", "image/webp", "video/apng":
		return fileTypeImage
	case "application/ogg", "audio/mpeg":
		return fileTypeAudio
	case "application/x-gzip":
		return fileTypeKeystore
	case "text/plain; charset=utf-8":
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

type acceptType string

func (a *acceptType) Handle(m httpaccept.Mime) bool {
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
