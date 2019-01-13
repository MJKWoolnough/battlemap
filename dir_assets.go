package main

import (
	"bufio"
	"bytes"
	"compress/gzip"
	"encoding/json"
	"encoding/xml"
	"fmt"
	"html/template"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"sort"
	"strconv"
	"strings"
	"sync"
	"time"

	"golang.org/x/net/websocket"
	"vimagination.zapto.org/errors"
	"vimagination.zapto.org/httpdir"
	"vimagination.zapto.org/httpgzip"
	"vimagination.zapto.org/memio"
)

type assetsDir struct {
	DefaultMethods
	location string
	handler  http.Handler

	assetMu     sync.RWMutex
	nextAssetID uint
	assets      map[uint]*Asset

	assetHandlerMu sync.RWMutex
	assetHandler   http.Handler
	assetJSON      json.RawMessage

	tagMu     sync.RWMutex
	nextTagID uint
	tags      map[uint]*Tag

	tagHandlerMu sync.RWMutex
	tagHandler   http.Handler
	tagJSON      json.RawMessage

	websocket websocket.Handler
}

func (a *assetsDir) Init() error {
	Config.RLock()
	a.location = Config.AssetsDir
	Config.RUnlock()
	err := os.MkdirAll(a.location, 0755)
	if err != nil {
		return errors.WithContext("error creating asset directory: ", err)
	}
	if err = a.initTags(); err != nil {
		return err
	}
	if err = a.initAssets(); err != nil {
		return err
	}
	a.handler = http.FileServer(http.Dir(a.location))
	a.websocket = websocket.Handler(a.WebSocket)
	return nil
}

func (a *assetsDir) initTags() error {
	f, err := os.Open(filepath.Join(a.location, "tags"))
	if err != nil {
		return errors.WithContext("error opening tags file: ", err)
	}
	defer f.Close()
	fsinfo, err := f.Stat()
	if err != nil {
		return errors.WithContext("error statting tag file: ", err)
	}

	a.tags = make(map[uint]*Tag)
	b := bufio.NewReader(f)
	var largestTagID uint64
	for {
		line, err := b.ReadBytes('\n')
		if err != nil {
			return errors.WithContext("error reading tags file: ", err)
		}
		parts := bytes.SplitN(line, sep, 2)
		if len(parts) != 2 {
			return ErrInvalidTagFile
		}
		id, err := strconv.ParseUint(string(parts[0]), 10, 0)
		if err != nil {
			return ErrInvalidTagFile
		}
		a.tags[uint(id)] = &Tag{
			Name: string(bytes.TrimSuffix(parts[2], newLine)),
		}
		if id > largestTagID {
			largestTagID = id
		}
	}
	a.nextTagID = uint(largestTagID) + 1
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
{{range .}}			<tr><td>{{.ID}}</td><td>{{.Name}}</td></tr>
{{end}}		</table>
	</body>
</html>`))

func (a *assetsDir) genTagsHandler(t time.Time) {
	tags := make(Tags, 0, len(a.tags))
	for _, tag := range a.tags {
		tags = append(tags, *tag)
	}
	sort.Sort(tags)
	a.tagJSON = json.RawMessage(genPages(t, tags, tagsTemplate, "tags", "tags", "tag", &a.tagHandler))
}

func (a *assetsDir) initAssets() error {
	d, err := os.Open(a.location)
	if err != nil {
		return errors.WithContext("error open asset directory: ", err)
	}
	fi, err := d.Stat()
	if err != nil {
		return errors.WithContext("error reading asset directory stats: ", err)
	}
	latestTime := fi.ModTime()
	files, err := d.Readdirnames(-1)
	d.Close()
	if err != nil {
		return errors.WithContext("error reading asset directory:", err)
	}
	a.assets = make(map[uint]*Asset)
	var largestAssetID uint64
	buf := make([]byte, 512)
	for _, file := range files {
		id, err := strconv.ParseUint(file, 10, 0)
		if err != nil {
			continue
		}
		as := new(Asset)
		as.ID = uint(id)
		f, err := os.Open(filepath.Join(a.location, file+".meta"))
		if err != nil {
			if !os.IsNotExist(err) {
				return errors.WithContext("error opening meta file "+file+".meta: ", err)
			}
			as.Name = file
		} else {
			fi, err := f.Stat()
			if err != nil {
				return errors.WithContext("error stating meta file "+file+".meta: ", err)
			}
			mt := fi.ModTime()
			if latestTime.Before(mt) {
				latestTime = mt
			}
			b := bufio.NewReader(f)
			name, err := b.ReadBytes('\n')
			if err != nil && err != io.EOF {
				return errors.WithContext("error reading asset name "+file+": ", err)
			}
			as.Name = string(bytes.TrimRight(name, "\n"))
			for err == nil {
				var tagIDStr []byte
				tagIDStr, err = b.ReadBytes('\n')
				if err == nil {
					var tagID uint64
					tagID, err = strconv.ParseUint(string(tagIDStr), 10, 0)
					if tag, ok := a.tags[uint(tagID)]; ok {
						tag.Assets = append(tag.Assets, uint(id))
						as.Tags = append(as.Tags, uint(tagID))
					} // ErrInvalidTagID??
				}
			}
			if err != nil && err != io.EOF {
				return errors.WithContext("error reading tad ID "+file+": ", err)
			}
			f.Close()
		}
		f, err = os.Open(filepath.Join(a.location, file))
		if err != nil {
			return errors.WithContext("error opening asset file "+file+": ", err)
		}
		fi, err := f.Stat()
		if err != nil {
			return errors.WithContext("error stating asset file "+file+": ", err)
		}
		mt := fi.ModTime()
		if latestTime.Before(mt) {
			latestTime = mt
		}
		n, err := io.ReadFull(f, buf)
		f.Close()
		if err != nil && err != io.EOF {
			return errors.WithContext("error reading asset file "+file+": ", err)
		}
		as.Type = getType(http.DetectContentType(buf[:n]))
		if as.Type == "" {
			return errors.WithContext("error detecting or invalid file type of "+file+": ", ErrInvalidFileType)
		}
		a.assets[uint(id)] = as
		if id > largestAssetID {
			largestAssetID = id
		}
	}
	a.nextAssetID = uint(largestAssetID) + 1
	a.genAssetsHandler(latestTime)
	return nil
}

var assetsTemplate = template.Must(template.New("").Parse(`<!DOCTYPE html>
<html>
	<head>
		<title>Assets</title>
	</head>
	<body>
		<table>
{{range .}}			<tr><td><a href="{{.ID}}">{{.Name}}</td><td>{{.Type}}</td></tr>
{{end}}		</table>
	</body>
</html>`))

func (a *assetsDir) genAssetsHandler(t time.Time) {
	as := make(Assets, 0, len(a.assets))
	for _, asset := range a.assets {
		as = append(as, *asset)
	}
	sort.Sort(as)
	a.assetJSON = json.RawMessage(genPages(t, as, assetsTemplate, "index", "assets", "asset", &a.assetHandler))
}

var exts = [...]string{".html", ".txt", ".json", ".xml"}

func genPages(t time.Time, list io.WriterTo, htmlTemplate *template.Template, baseName, topTag, tag string, handler *http.Handler) []byte {
	var buffers [2 * len(exts)]memio.Buffer
	htmlTemplate.Execute(&buffers[0], list)
	list.WriteTo(&buffers[1])
	json.NewEncoder(&buffers[2]).Encode(list)
	x := xml.NewEncoder(&buffers[3])
	var se = xml.StartElement{Name: xml.Name{Local: topTag}}
	x.EncodeToken(se)
	x.EncodeElement(list, xml.StartElement{Name: xml.Name{Local: tag}})
	x.EncodeToken(se.End())
	x.Flush()

	d := httpdir.New(t)
	gw, _ := gzip.NewWriterLevel(nil, gzip.BestCompression)
	for i, ext := range exts {
		gw.Reset(&buffers[i+len(exts)])
		gw.Write(buffers[i])
		gw.Close()
		d.Create(baseName+ext, httpdir.FileBytes(buffers[i], t))
		d.Create(baseName+ext+".gz", httpdir.FileBytes(buffers[i], t))
	}
	*handler = httpgzip.FileServer(d)
	return buffers[2]
}

var (
	sep     = []byte{':'}
	newLine = []byte{'\n'}
)

func getType(mime string) string {
	switch mime {
	//case "text/html; charset=utf-8", "text/plain; charset=utf-8", "application/pdf", "application/postscript":
	//	return "document"
	case "image/gif", "image/png", "image/jpeg", "image/webp":
		return "visual"
	case "application/ogg", "audio/mpeg":
		return "audio"
	case "video/mp4", "video/webm":
		return "visual"
	}
	return ""
}

func (a *assetsDir) writeAsset(id uint, regen bool) error {
	as, ok := a.assets[id]
	if !ok {
		return ErrUnknownAsset
	}
	file := filepath.Join(a.location, strconv.FormatUint(uint64(id), 10)+".meta")
	f, err := os.Create(file)
	if err != nil {
		return errors.WithContext("error creating meta file: ", err)
	}
	if _, err = fmt.Fprintln(f, as.Name); err != nil {
		return errors.WithContext("error writing asset name: ", err)
	}
	for _, tag := range as.Tags {
		if _, err = fmt.Fprintf(f, "%d\n", tag); err != nil {
			return errors.WithContext("error writing tag data for asset: ", err)
		}
	}
	if err = f.Close(); err != nil {
		return errors.WithContext("error closing asset meta file: ", err)
	}
	if regen {
		fi, err := os.Stat(file)
		if err != nil {
			return errors.WithContext("error reading asset meta file stats: ", err)
		}
		a.genAssetsHandler(fi.ModTime())
	}
	return nil
}

func (a *assetsDir) writeTags() error {
	file := filepath.Join(a.location, "tags")
	f, err := os.Create(file)
	if err != nil {
		return errors.WithContext("error creating tags file: ", err)
	}
	for _, tag := range a.tags {
		if _, err = fmt.Fprintf(f, "%d:%s\n", tag.ID, tag.Name); err != nil {
			return errors.WithContext("error writing tags file: ", err)
		}
	}
	if err = f.Close(); err != nil {
		return errors.WithContext("error closing tags file: ", err)
	}
	fi, err := os.Stat(file)
	if err != nil {
		return errors.WithContext("error reading tag file stats: ", err)
	}
	a.genTagsHandler(fi.ModTime())
	return nil
}

func (a *assetsDir) deleteAsset(asset *Asset) error {
	filename := filepath.Join(a.location, strconv.FormatUint(uint64(asset.ID), 10))
	if err := os.Remove(filename); err != nil {
		if !os.IsNotExist(err) {
			return errors.WithContext("error removing asset file: ", err)
		}
	}
	if err := os.Remove(filename + ".meta"); err != nil {
		if !os.IsNotExist(err) {
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
	name = strings.Replace(name, "\n", "", -1)
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
	assets := make(map[uint]struct{})
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
	newName = strings.Replace(newName, "\n", "", -1)
	if newName == "" || newName == tag.Name {
		return false
	}
	tag.Name = newName
	return true
}

func (a *assetsDir) removeTagsFromAsset(asset *Asset, tagIDs ...uint) bool {
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

func (a *assetsDir) addTagsToAsset(asset *Asset, tagIDs ...uint) bool {
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

func removeID(ids []uint, remove uint) []uint {
	for i := range ids {
		if ids[i] == remove {
			ids = append(ids[:i], ids[i+1:]...)
			break
		}
	}
	return ids
}

func (a *assetsDir) renameAsset(asset *Asset, newName string) bool {
	newName = strings.Replace(newName, "\n", "", -1)
	if newName == "" || newName == asset.Name {
		return false
	}
	asset.Name = newName
	return true
}

var AssetsDir assetsDir

type Asset struct {
	ID   uint   `json:"id" xml:"id,attr"`
	Name string `json:"name" xml:"name"`
	Type string `json:"type" xml:"type"`
	Tags []uint `json:"tags" xml:"tags>tag"`
}

func (a Asset) WriteTo(w io.Writer) (int64, error) {
	var total int64
	n, err := fmt.Fprintf(w, "%d:%s\n", a.ID, a.Name)
	total += int64(n)
	if err != nil {
		return total, err
	}
	for m, tid := range a.Tags {
		if m == 0 {
			n, err = fmt.Fprintf(w, "%d", tid)
		} else {
			n, err = fmt.Fprintf(w, ",%d", tid)
		}
		total += int64(n)
		if err != nil {
			return total, err
		}
	}
	n, err = w.Write(newLine)
	total += int64(n)
	return total, err
}

type Assets []Asset

func (a Assets) WriteTo(w io.Writer) (int64, error) {
	var total int64
	for _, asset := range a {
		t, err := asset.WriteTo(w)
		total += t
		if err != nil {
			return total, err
		}
	}
	return total, nil
}

func (a Assets) Len() int {
	return len(a)
}

func (a Assets) Less(i, j int) bool {
	return a[i].ID < a[j].ID
}

func (a Assets) Swap(i, j int) {
	a[i], a[j] = a[j], a[i]
}

type Tag struct {
	ID     uint   `json:"id" xml:"id,attr"`
	Name   string `json:"name" xml:",chardata"`
	Assets []uint `json:"-" xml:"-"`
}

type Tags []Tag

func (t Tags) WriteTo(w io.Writer) (int64, error) {
	var total int64
	for _, tag := range t {
		n, err := fmt.Fprintf(w, "%d:%s\n", tag.ID, tag.Name)
		total += int64(n)
		if err != nil {
			return total, err
		}
	}
	return total, nil
}

func (t Tags) Len() int {
	return len(t)
}

func (t Tags) Less(i, j int) bool {
	return t[i].ID < t[j].ID
}

func (t Tags) Swap(i, j int) {
	t[i], t[j] = t[j], t[i]
}

const (
	tagsPath                          = "/tags"
	ErrInvalidMethodByte errors.Error = "invalid method byte"
	ErrCannotMultiRename errors.Error = "cannot rename multiple times"
	ErrInvalidTagFile    errors.Error = "invalid tag file"
	ErrInvalidFileType   errors.Error = "invalid file type"
	ErrUnknownAsset      errors.Error = "unknown asset"
	ErrUnknownEndpoint   errors.Error = "unknown endpoint"
	ErrUnknownTag        errors.Error = "unknown tag"
)
