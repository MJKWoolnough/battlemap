package battlemap

import (
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"path"
	"path/filepath"
	"strconv"
	"strings"
	"sync"

	"vimagination.zapto.org/byteio"
	"vimagination.zapto.org/keystore"
	"vimagination.zapto.org/memio"
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
		lw.WriteUint64(aid)
	}
}

func (f *folder) ReadFromX(lr *byteio.StickyLittleEndianReader) {
	f.ID = lr.ReadUint64()
	fl := lr.ReadUint64()
	f.Folders = make(map[string]*folder, fl)
	for i := uint64(0); i < fl; i++ {
		fd := new(folder)
		name := lr.ReadStringX()
		fd.ReadFromX(lr)
		f.Folders[name] = fd
	}
	al := lr.ReadUint64()
	f.Assets = make(map[string]uint64, lr.ReadUint64())
	for i := uint64(0); i < al; i++ {
		name := lr.ReadStringX()
		f.Assets[name] = lr.ReadUint64()
	}
}

type assetsDir struct {
	*Battlemap
	DefaultMethods
	fileType
	assetStore *keystore.FileStore
	handler    http.Handler

	assetMu      sync.RWMutex
	nextAssetID  uint64
	nextFolderID uint64
	assetFolders *folder
	assetLinks   map[uint64]uint64
	folders      map[uint64]*folder
	assetJSON    memio.Buffer
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
	err := a.config.Get(locname, &location)
	if err != nil {
		return fmt.Errorf("error getting asset data directory: %w", err)
	}
	l := filepath.Join(b.config.BaseDir, string(location))
	a.assetStore, err = keystore.NewFileStore(l, l, keystore.NoMangle)
	if err != nil {
		return fmt.Errorf("error creating asset meta store: ", err)
	}
	a.assetFolders = new(folder)
	err = a.assetStore.Get(assetsMetadata, a.assetFolders)
	if err != nil {
		return fmt.Errorf("error getting asset data: ", err)
	}
	a.assetLinks = make(map[uint64]uint64)
	a.processFolder(a.assetFolders)
	keys := a.assetStore.Keys()
	var gft getFileType
	for _, k := range keys {
		if k == assetsMetadata {
			continue
		}
		a.assetStore.Get(k, &gft)
		if gft.Type != a.fileType {
			continue
		}
		if !strings.HasPrefix(k, "0") || k == "0" {
			n, err := strconv.ParseUint(k, 10, 64)
			if err == nil {
				if _, ok := a.assetLinks[n]; !ok {
					addTo(a.assetFolders.Assets, k, n)
					a.assetLinks[n] = 1
					continue
				}
			}
		}
		if a.assetStore.Rename(k, strconv.FormatUint(a.nextAssetID, 10)) == nil {
			addTo(a.assetFolders.Assets, k, a.nextAssetID)
			a.nextAssetID++
		}
	}
	if len(keys) > 0 {
		a.assetStore.Set(assetsMetadata, a.assetFolders)
	}
	json.NewEncoder(&a.assetJSON).Encode(a.assetFolders)
	a.Battlemap = b
	return nil
}

func addTo(files map[string]uint64, name string, id uint64) {
	if _, ok := files[name]; !ok {
		files[name] = id
		return
	}
	n := make([]byte, len(name), len(name)+32)
	m := n[len(name)+1 : len(name)+1]
	copy(n, name)
	n[len(name)] = '.'
	for i := uint64(0); ; i++ {
		p := len(strconv.AppendUint(m, i, 10))
		if _, ok := files[string(n[:len(name)+1+p])]; !ok {
			files[string(n[:len(name)+1+p])] = id
			return
		}
	}
}

func (a *assetsDir) processFolder(f *folder) {
	a.folders[f.ID] = f
	if f.ID > a.nextFolderID {
		a.nextFolderID = f.ID + 1
	}
	for _, g := range f.Folders {
		a.processFolder(g)
	}
	for name, as := range f.Assets {
		if !a.assetStore.Exists(strconv.FormatUint(as, 10)) {
			delete(f.Assets, name)
		}
		if as > a.nextAssetID {
			a.nextAssetID = as + 1
		}
		al, _ := a.assetLinks[as]
		a.assetLinks[as] = al + 1
	}
}

func (a *assetsDir) getFolder(path string) *folder {
	d := a.assetFolders
	for _, p := range strings.Split(path, "/") {
		if p == "" {
			continue
		}
		e, ok := d.Folders[p]
		if !ok {
			return nil
		}
		d = e
	}
	return d
}

func (a *assetsDir) exists(p string) bool {
	dir, file := path.Split(p)
	folder := a.getFolder(dir)
	if folder == nil {
		return false
	} else if file == "" {
		return true
	}
	_, ok := folder.Assets[file]
	return ok
}

func (a *assetsDir) saveFolders() {
	a.assetMu.Lock()
	a.assetStore.Set(assetsMetadata, a.assetFolders)
	a.assetJSON = memio.Buffer{}
	json.NewEncoder(&a.assetJSON).Encode(a.assetFolders)
	a.assetMu.Unlock()
}

const assetsMetadata = "assets"

var (
	ErrInvalidFileType = errors.New("invalid file type")
)
