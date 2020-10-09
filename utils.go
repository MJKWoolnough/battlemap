package battlemap

import (
	"io"
	"net/http"
)

type fileType uint8

const (
	fileTypeUnknown fileType = iota
	fileTypeImage
	fileTypeAudio
	fileTypeCharacter
	fileTypeMap
)

type getFileType struct {
	Buffer [512]byte
	Type   fileType
}

func (g *getFileType) ReadFrom(r io.Reader) (int64, error) {
	n, err := io.ReadFull(r, g.Buffer[:])
	if err != nil {
		return int64(n), err
	}
	switch http.DetectContentType(g.Buffer[:n]) {
	case "image/gif", "image/png", "image/jpeg", "image/webp", "video/apng":
		g.Type = fileTypeImage
	case "application/ogg", "audio/mpeg":
		g.Type = fileTypeAudio
	case "application/x-gzip":
		g.Type = fileTypeCharacter
	case "text/plain; charset=utf-8":
		g.Type = fileTypeMap
	default:
		g.Type = fileTypeUnknown
	}
	return int64(n), nil
}

func isRoot(path string) bool {
	return path == "/" || path == ""
}
