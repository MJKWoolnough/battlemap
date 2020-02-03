package battlemap

import (
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"os"
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
	Folders map[string]*folder `json:"folders"`
	Assets  map[string]uint64  `json:"assets"`
}

func newFolder() *folder {
	return &folder{
		Folders: make(map[string]*folder),
		Assets:  make(map[string]uint64),
	}
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
	fl := lr.ReadUint64()
	f.Folders = make(map[string]*folder, fl)
	for i := uint64(0); i < fl; i++ {
		fd := newFolder()
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
	lastAssetID  uint64
	assetFolders *folder
	assetLinks   map[uint64]uint64
	assetJSON    memio.Buffer
}

func (a *assetsDir) Init(b *Battlemap) error {
	a.Battlemap = b
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
		return fmt.Errorf("error creating asset meta store: %w", err)
	}
	a.assetFolders = newFolder()
	err = a.assetStore.Get(assetsMetadata, a.assetFolders)
	if err != nil && os.IsNotExist(err) {
		return fmt.Errorf("error getting asset data: %w", err)
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
		if !strings.HasPrefix(k, "0") {
			n, err := strconv.ParseUint(k, 10, 64)
			if err == nil {
				if _, ok := a.assetLinks[n]; !ok {
					addAssetTo(a.assetFolders.Assets, k, n)
					a.assetLinks[n] = 1
					continue
				}
			}
		}
		if a.assetStore.Rename(k, strconv.FormatUint(a.lastAssetID, 10)) == nil {
			a.lastAssetID++
			addAssetTo(a.assetFolders.Assets, k, a.lastAssetID)
			a.assetLinks[a.lastAssetID] = 1
		}
	}
	if len(keys) > 0 {
		a.assetStore.Set(assetsMetadata, a.assetFolders)
	}
	json.NewEncoder(&a.assetJSON).Encode(a.assetFolders)
	return nil
}

func addAssetTo(assets map[string]uint64, name string, id uint64) string {
	if _, ok := assets[name]; !ok {
		assets[name] = id
		return name
	}
	n := make([]byte, len(name), len(name)+32)
	m := n[len(name)+1 : len(name)+1]
	copy(n, name)
	n[len(name)] = '.'
	for i := uint64(0); ; i++ {
		p := len(strconv.AppendUint(m, i, 10))
		if _, ok := assets[string(n[:len(name)+1+p])]; !ok {
			name := string(n[:len(name)+1+p])
			assets[name] = id
			return name
		}
	}
}

func addFolderTo(folders map[string]*folder, name string, f *folder) string {
	if _, ok := folders[name]; !ok {
		folders[name] = f
		return name
	}
	n := make([]byte, len(name), len(name)+32)
	m := n[len(name)+1 : len(name)+1]
	copy(n, name)
	n[len(name)] = '.'
	for i := uint64(0); ; i++ {
		p := len(strconv.AppendUint(m, i, 10))
		if _, ok := folders[string(n[:len(name)+1+p])]; !ok {
			name := string(n[:len(name)+1+p])
			folders[name] = f
			return name
		}
	}
}

func (a *assetsDir) processFolder(f *folder) {
	for _, g := range f.Folders {
		a.processFolder(g)
	}
	for name, as := range f.Assets {
		if as == 0 || !a.assetStore.Exists(strconv.FormatUint(as, 10)) {
			delete(f.Assets, name)
		}
		if as > a.lastAssetID {
			a.lastAssetID = as
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

func (a *assetsDir) getParentFolder(p string) (parent *folder, name string, f *folder) {
	p = path.Clean(strings.TrimRight(p, "/"))
	lastSlash := strings.LastIndexByte(p, '/')
	parent = a.getFolder(p[:lastSlash])
	if parent == nil {
		return nil, "", nil
	}
	name = p[lastSlash+1 : len(p)]
	f, _ = parent.Folders[name]
	return parent, name, f
}

func (a *assetsDir) getFolderAsset(p string) (parent *folder, name string, asset uint64) {
	dir, file := path.Split(p)
	parent = a.getFolder(path.Clean(dir))
	if parent == nil {
		return nil, "", 0
	}
	asset, _ = parent.Assets[file]
	return parent, file, asset
}

func (a *assetsDir) exists(p string) bool {
	a.assetMu.RLock()
	dir, file := path.Split(p)
	folder := a.getFolder(path.Clean(dir))
	if folder == nil {
		return false
	} else if file == "" {
		return true
	}
	_, ok := folder.Assets[file]
	a.assetMu.RUnlock()
	return ok
}

func (a *assetsDir) saveFolders() {
	a.assetStore.Set(assetsMetadata, a.assetFolders)
	a.assetJSON = memio.Buffer{}
	json.NewEncoder(&a.assetJSON).Encode(a.assetFolders)
}

func walkFolders(f *folder, fn func(map[string]uint64)) {
	fn(f.Assets)
	for _, f := range f.Folders {
		walkFolders(f, fn)
	}
}

const assetsMetadata = "assets"

var (
	ErrInvalidFileType = errors.New("invalid file type")
	ErrAssetNotFound   = errors.New("asset not found")
	ErrFolderNotFound  = errors.New("folder not found")
)
