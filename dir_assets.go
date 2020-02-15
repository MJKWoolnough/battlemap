package battlemap

import (
	"errors"
	"fmt"
	"net/http"
	"path/filepath"

	"vimagination.zapto.org/keystore"
)

type assetsDir struct {
	folders
	DefaultMethods
	assetStore *keystore.FileStore
	handler    http.Handler
}

func (a *assetsDir) Init(b *Battlemap) error {
	var (
		location keystore.String
		locname  string
	)
	switch a.fileType {
	case fileTypeImage:
		locname = "ImageAssetsDir"
	case fileTypeAudio:
		locname = "AudioAssetsDir"
	default:
		return ErrInvalidFileType
	}
	err := b.config.Get(locname, &location)
	if err != nil {
		return fmt.Errorf("error getting asset data directory: %w", err)
	}
	l := filepath.Join(b.config.BaseDir, string(location))
	assetStore, err := keystore.NewFileStore(l, l, keystore.NoMangle)
	if err != nil {
		return fmt.Errorf("error creating asset meta store: %w", err)
	}
	a.handler = http.FileServer(http.Dir(l))
	return a.folders.Init(b, assetStore)
}

var (
	ErrInvalidFileType = errors.New("invalid file type")
	ErrAssetNotFound   = errors.New("asset not found")
)
