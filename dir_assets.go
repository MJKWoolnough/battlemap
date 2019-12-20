package battlemap

import (
	"fmt"
	"io"
	"net/http"
	"path/filepath"
	"sync"

	"vimagination.zapto.org/byteio"
	"vimagination.zapto.org/keystore"
)

type folder struct {
	ID      uint64             `json:"id"`
	Folders map[string]*folder `json:"folders"`
	Assets  map[string]uint64  `json:"assets"`
}

func (f *folder) WriteTo(w io.Writer) (int64, error) {
	lw := byteio.StickyLittleEndianWriter{Writer: w}
	f.WriteToX(&lw)
	return lw.Count, lw.Err
}

func (f *folder) ReadFrom(r io.Reader) (int64, error) {
	lr := byteio.StickyLittleEndianReader{Reader: r}
	f.ReadFromX(&lr)
	return lr.Count, lr.Err
}

func (f *folder) WriteToX(lw *byteio.StickyLittleEndianWriter) {
	lw.WriteUint64(f.ID)
	lw.WriteUint64(uint64(len(f.Folders)))
	for name, fd := range f.Folders {
		lw.WriteStringX(name)
		fd.WriteToX(lw)
	}
	lw.WriteUint64(uint64(len(f.Assets)))
	for name, aid := range f.Assets {
		lw.WriteStringX(name)
		as.WriteUint64(aid)
	}
}

func (f *folder) ReadFromX(lr *byteio.StickyLittleEndianReader) {
	f.ID = lr.ReadUint64()
	fl := lr.ReadUint64()
	f.Folders = make(map[string]*folder, fl)
	for i := 0; i < fl; i++ {
		fd := new(folder)
		name := lr.ReadStringX()
		fd.ReadFromX(lr)
		f.Folders[name] = fd
	}
	al := lr.ReadUint64()
	f.Assets = make(map[string]uint64, lr.ReadUint64())
	for i := 0; i < al; i++ {
		name := lr.ReadStringX()
		f.Assets[name] = lr.ReadUint64()
	}
}

type assetsDir struct {
	*Battlemap
	DefaultMethods
	assetStore *keystore.FileStore
	handler    http.Handler

	assetMu      sync.RWMutex
	nextAssetID  uint64
	nextFolderID uint64
	assetFolders *folder
	assetLinks   map[uint64]uint64
	folders      map[uint64]*folder
}

func (a *assetsDir) Init(b *Battlemap) error {
	var location keystore.String
	err := a.config.Get("AssetsDir", &location)
	if err != nil {
		return fmt.Errorf("error getting asset data directory: %w", err)
	}
	l := filepath.Join(b.config.BaseDir, string(location))
	a.assetStore, err = keystore.NewFileStore(l, l, keystore.NoMangle)
	if err != nil {
		return fmt.Errorf("error creating asset meta store: ", err)
	}
	a.assetFolders = new(folder)
	err = a.assetStore.Get("assets", a.assetFolders)
	if err != nil {
		return fmt.Errorf("error getting asset data: ", err)
	}
	a.assetLinks = make(map[uint64]uint64)
	a.processFolder(a.assetFolders)
	a.Battlemap = b
	return nil
}

func (a *assetsDir) processFolder(f *folder) error {
	a.folders[f.ID] = f
	if f.ID > a.nextFolderID {
		a.nextFolderID = f.ID + 1
	}
	for _, g := range f.Folders {
		if err := a.processFolder(g); err != nil {
			return err
		}
	}
	for _, as := range f.Assets {
		if as > a.nextAssetID {
			a.nextAssetID = as + 1
		}
		al, _ := a.assetLinks[as]
		a.assetLinks[as] = al + 1
	}
}
