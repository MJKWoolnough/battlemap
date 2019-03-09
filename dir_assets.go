package main

import (
	"encoding/json"
	"encoding/xml"
	"fmt"
	"html/template"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"sync"
	"time"

	"vimagination.zapto.org/byteio"
	"vimagination.zapto.org/errors"
	"vimagination.zapto.org/keystore"
	"vimagination.zapto.org/memio"
)

type assetsDir struct {
	DefaultMethods
	metaStore, assetStore *keystore.FileStore
	handler               http.Handler

	assetMu     sync.RWMutex
	nextAssetID uint64
	assets      Assets

	assetHandlerMu sync.RWMutex
	assetHandler   http.Handler
	assetJSON      json.RawMessage

	tagMu     sync.RWMutex
	nextTagID uint64
	tags      Tags

	tagHandlerMu sync.RWMutex
	tagHandler   http.Handler
	tagJSON      json.RawMessage
}

func (a *assetsDir) Init() error {
	var metaLocation keystore.String
	err := Config.Get("AssetsMetaDir", &metaLocation)
	if err != nil {
		return errors.WithContext("error getting asset meta data directory: ", err)
	}
	sp := filepath.Join(Config.BaseDir, string(metaLocation))
	a.metaStore, err = keystore.NewFileStore(sp, sp, keystore.NoMangle)
	if err != nil {
		return errors.WithContext("error creating asset meta store: ", err)
	}
	if err = a.initTags(); err != nil {
		return err
	}
	if err = a.initAssets(); err != nil {
		return err
	}
	return nil
}

func (a *assetsDir) initTags() error {
	a.tags = make(Tags)
	var fsinfo os.FileInfo
	if err := a.metaStore.Get("tags", &a.tags); err != nil {
		if err == keystore.ErrUnknownKey {
			return nil
		} else {
			return errors.WithContext("error reading tags file: ", err)
		}
	} else if fsinfo, err = a.metaStore.Stat("tags"); err != nil {
		return errors.WithContext("error stating tags file: ", err)
	}
	var largestTagID uint64
	for id := range a.tags {
		if id > largestTagID {
			largestTagID = id
		}
	}
	a.nextTagID = largestTagID + 1
	a.genTagsHandler(fsinfo.ModTime())
	return nil
}

var tagsTemplate = template.Must(template.New("").Parse(`<!DOCTYPE html>
<html>
	<head>
		<title>Tags</title>
	</head>
	<body>
		<table>
			<thead>
				<tr><th>ID</th></tr><td>Name</td></tr>
			</thead>
			<tbody>
{{range .}}				<tr><td>{{.ID}}</td><td>{{.Name}}</td></tr>
{{end}}			</tbody>
		</table>
	</body>
</html>`))

func (a *assetsDir) genTagsHandler(t time.Time) {
	a.tagJSON = json.RawMessage(genPages(t, a.tags, tagsTemplate, "tags", "tags", "tag", &a.tagHandler))
}

func (a *assetsDir) initAssets() error {
	var (
		location keystore.String
		err      error
	)
	Config.Get("AssetsDir", &location)
	ap := filepath.Join(Config.BaseDir, string(location))
	a.assetStore, err = keystore.NewFileStore(ap, ap, keystore.NoMangle)
	if err != nil {
		return errors.WithContext("error creating asset store: ", err)
	}
	fi, err := a.assetStore.Stat("")
	if err != nil {
		return errors.WithContext("error reading asset directory stats: ", err)
	}
	latestTime := fi.ModTime()
	var (
		largestAssetID uint64
		gft            getFileType
	)
	for _, file := range a.assetStore.Keys() {
		id, err := strconv.ParseUint(file, 10, 0)
		if err != nil {
			continue
		}
		if _, ok := a.assets[id]; ok {
			return ErrDuplicateAsset
		}
		if fi, err = a.assetStore.Stat(file); err != nil {
			continue
		}
		gft.Type = ""
		a.assetStore.Get(file, &gft)
		if gft.Type == "" {
			continue
		}
		as := &Asset{
			Type: gft.Type,
		}
		a.metaStore.Get(file, as)
		if as.ID != id {
			as.ID = id
			as.Name = file
		}
		a.assets[as.ID] = as
		if id > largestAssetID {
			largestAssetID = id
		}
		ct := fi.ModTime()
		if ct.After(latestTime) {
			latestTime = ct
		}
	}
	a.nextAssetID = largestAssetID + 1
	a.genAssetsHandler(latestTime)
	a.handler = http.FileServer(http.Dir(location))
	return nil
}

var assetsTemplate = template.Must(template.New("").Parse(`<!DOCTYPE html>
<html>
	<head>
		<title>Assets</title>
	</head>
	<body>
		<table>
			<thead>
				<tr><th>Name</th><th>Type</th></tr>
			</thead>
			<tbody>
{{range .}}			<tr><td><a href="{{.ID}}">{{.Name}}</td><td>{{.Type}}</td></tr>
{{end}}			</tbody>
		</table>
	</body>
</html>`))

func (a *assetsDir) genAssetsHandler(t time.Time) {
	a.assetJSON = json.RawMessage(genPages(t, a.assets, assetsTemplate, "index", "assets", "asset", &a.assetHandler))
}

func (a *assetsDir) writeAsset(id uint64, regen bool) error {
	as, ok := a.assets[id]
	if !ok {
		return ErrUnknownAsset
	}
	idStr := strconv.FormatUint(id, 10)
	if err := a.metaStore.Set(idStr, as); err != nil {
		return errors.WithContext("error setting asset metadata: ", err)
	}
	if regen {
		fi, err := a.metaStore.Stat(idStr)
		if err != nil {
			return errors.WithContext("error reading asset meta file stats: ", err)
		}
		a.genAssetsHandler(fi.ModTime())
	}
	return nil
}

func (a *assetsDir) writeTags() error {
	err := a.metaStore.Set("tags", a.tags)
	if err != nil {
		return errors.WithContext("error setting tags data: ", err)
	}
	fi, err := a.metaStore.Stat("tags")
	if err != nil {
		return errors.WithContext("error reading tag file stats: ", err)
	}
	a.genTagsHandler(fi.ModTime())
	return nil
}

func (a *assetsDir) deleteAsset(asset *Asset) error {
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
	a.genAssetsHandler(time.Now())
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

func (a *assetsDir) renameAsset(asset *Asset, newName string) bool {
	if newName == "" || newName == asset.Name {
		return false
	}
	asset.Name = newName
	return true
}

var AssetsDir assetsDir

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

func (a *Asset) MarshalText() ([]byte, error) {
	var buf memio.Buffer
	fmt.Fprintf(&buf, "%d:%q\n%s\n%v\n\n", a.ID, a.Name, a.Type, a.Tags)
	return buf, nil
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

func (a Assets) MarshalText() ([]byte, error) {
	var buf memio.Buffer
	a.WriteTo(&buf)
	return buf, nil
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

func (t Tags) MarshalText() ([]byte, error) {
	var buf memio.Buffer
	for id, tag := range t {
		fmt.Fprintf(&buf, "%d:%q\n", id, tag.Name)
	}
	return buf, nil
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
