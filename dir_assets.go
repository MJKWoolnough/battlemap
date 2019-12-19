package battlemap

import (
	"encoding/xml"
	"fmt"
	"io"
	"net/http"
	"path/filepath"
	"strconv"
	"sync"
	"time"

	"vimagination.zapto.org/byteio"
	"vimagination.zapto.org/errors"
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
	err = a.assetStore.Get("assets", a.assetsFolders)
	if err != nil {
		return fmt.Errorf("error getting asset data: ", err)
	}
	a.assetLinks = make(map[uint64]uint64)
	a.process(a.assetFolders)
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

func (a *assetsDir) deleteAsset(asset *Asset, id ID) error {
	idStr := strconv.FormatUint(asset.ID, 10)
	if err := a.assetStore.Remove(idStr); err != nil {
		if err != keystore.ErrUnknownKey {
			return errors.WithContext("error removing asset file: ", err)
		}
	}
	if err := a.metaStore.Remove(idStr); err != nil {
		if err != keystore.ErrUnknownKey {
			return errors.WithContext("error removing asset meta file: ", err)
		}
	}
	delete(a.assets, asset.ID)
	for _, tid := range asset.Tags {
		if tag, ok := a.tags[tid]; ok {
			tag.Assets = removeID(tag.Assets, asset.ID)
		}
	}
	a.socket.BroadcastAssetRemove(asset.ID, id)
	fs, err := a.assetStore.Stat("")
	var t time.Time
	if err != nil {
		t = time.Now()
	} else {
		t = fs.ModTime()
	}
	a.genAssetsHandler(t)
	return nil
}

func (a *assetsDir) addTag(name string) *Tag {
	id := a.nextTagID
	a.nextTagID++
	t := &Tag{
		ID:   id,
		Name: name,
	}
	a.tags[id] = t
	return t
}

func (a *assetsDir) deleteTags(tags ...*Tag) bool {
	assets := make(map[uint64]struct{})
	var change bool
	for _, tag := range tags {
		for _, aid := range tag.Assets {
			if as, ok := a.assets[aid]; ok {
				as.Tags = removeID(as.Tags, tag.ID)
				assets[aid] = struct{}{}
			}
		}
		delete(a.tags, tag.ID)
		change = true
	}
	n := len(assets)
	for aid := range assets {
		n--
		a.writeAsset(aid, n == 0)
	}
	return change
}

func (a *assetsDir) renameTag(tag *Tag, newName string) bool {
	if newName == "" || newName == tag.Name {
		return false
	}
	tag.Name = newName
	return true
}

func (a *assetsDir) removeTagsFromAsset(asset *Asset, tagIDs ...uint64) bool {
	var change bool
	for _, tagID := range tagIDs {
		if tag, ok := a.tags[tagID]; ok {
			tag.Assets = removeID(tag.Assets, asset.ID)
			l := len(asset.Tags)
			asset.Tags = removeID(asset.Tags, tagID)
			change = change || l == len(asset.Tags)
		}
	}
	return change
}

func (a *assetsDir) addTagsToAsset(asset *Asset, tagIDs ...uint64) bool {
	var change bool
	for _, tagID := range tagIDs {
		if _, ok := a.tags[tagID]; ok {
			l := len(asset.Tags)
			asset.Tags = append(removeID(asset.Tags, tagID), tagID)
			change = change || l == len(asset.Tags)
		}
	}
	return change
}

func removeID(ids []uint64, remove uint64) []uint64 {
	for i := range ids {
		if ids[i] == remove {
			ids = append(ids[:i], ids[i+1:]...)
			break
		}
	}
	return ids
}

func (a *assetsDir) modifyAsset(as *Asset, newName string, removeTags, addTags []uint64, except ID) bool {
	change := a.renameAsset(as, newName)
	if len(removeTags) > 0 || len(addTags) > 0 {
		a.tagMu.Lock()
		aChange := a.removeTagsFromAsset(as, removeTags...)
		bChange := a.addTagsToAsset(as, addTags...)
		change = change || aChange || bChange
		a.tagMu.Unlock()
	}
	if change {
		a.socket.BroadcastAssetChange(as, except)
		a.writeAsset(as.ID, true)
	}
	return change
}

func (a *assetsDir) renameAsset(asset *Asset, newName string) bool {
	if newName == "" || newName == asset.Name {
		return false
	}
	asset.Name = newName
	return true
}

// Asset is an asset
type Asset struct {
	ID   uint64   `json:"id" xml:"id,attr"`
	Name string   `json:"name" xml:"name"`
	Type string   `json:"type" xml:"type"`
	Tags []uint64 `json:"tags" xml:"tags>tag"`
}

func (a *Asset) WriteTo(w io.Writer) (int64, error) {
	lw := byteio.StickyLittleEndianWriter{Writer: w}
	lw.WriteUintX(a.ID)
	lw.WriteStringX(a.Name)
	lw.WriteUintX(uint64(len(a.Tags)))
	for _, tid := range a.Tags {
		lw.WriteUintX(tid)
	}
	return lw.Count, lw.Err
}

func (a *Asset) ReadFrom(r io.Reader) (int64, error) {
	lr := byteio.StickyLittleEndianReader{Reader: r}
	a.ID = lr.ReadUintX()
	a.Name = lr.ReadStringX()
	a.Tags = make([]uint64, lr.ReadUintX())
	for n := range a.Tags {
		a.Tags[n] = lr.ReadUintX()
	}
	return lr.Count, lr.Err
}

type Assets map[uint64]*Asset

func (a Assets) MarshalXML(e *xml.Encoder, start xml.StartElement) error {
	for _, asset := range a {
		if err := e.EncodeElement(asset, start); err != nil {
			return err
		}
	}
	return nil
}

func (a Assets) WriteTo(w io.Writer) (int64, error) {
	var total int64
	for id, asset := range a {
		n, err := fmt.Fprintf(w, "%d:%q\n%s\n%v\n\n", id, asset.Name, asset.Type, asset.Tags)
		total += int64(n)
		if err != nil {
			return total, err
		}
	}
	return total, nil
}

type Tag struct {
	ID     uint64   `json:"id" xml:"id,attr"`
	Name   string   `json:"name" xml:",chardata"`
	Assets []uint64 `json:"-" xml:"-"`
}

type Tags map[uint64]*Tag

func (t Tags) MarshalXML(e *xml.Encoder, start xml.StartElement) error {
	for _, tag := range t {
		if err := e.EncodeElement(tag, start); err != nil {
			return err
		}
	}
	return nil
}

func (t Tags) WriteTo(w io.Writer) (int64, error) {
	lw := byteio.StickyLittleEndianWriter{Writer: w}
	for id, tag := range t {
		lw.WriteUintX(id)
		lw.WriteStringX(tag.Name)
	}
	return lw.Count, lw.Err
}

func (t Tags) ReadFrom(r io.Reader) (int64, error) {
	lr := byteio.StickyLittleEndianReader{Reader: r}
	for {
		id := lr.ReadUintX()
		name := lr.ReadStringX()
		if lr.Err != nil {
			if lr.Err == io.EOF {
				lr.Err = nil
			}
			return lr.Count, lr.Err
		}
		t[id] = &Tag{
			ID:   id,
			Name: name,
		}
	}
}

const (
	tagsPath                          = "/tags"
	ErrInvalidMethodByte errors.Error = "invalid method byte"
	ErrCannotMultiRename errors.Error = "cannot rename multiple times"
	ErrInvalidTagFile    errors.Error = "invalid tag file"
	ErrInvalidFileType   errors.Error = "invalid file type"
	ErrUnknownAsset      errors.Error = "unknown asset"
	ErrUnknownTag        errors.Error = "unknown tag"
	ErrDuplicateAsset    errors.Error = "asset already loaded"
)
