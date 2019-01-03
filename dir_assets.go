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

	"vimagination.zapto.org/errors"
	"vimagination.zapto.org/httpaccept"
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

	tagMu     sync.RWMutex
	nextTagID uint
	tags      map[uint]*Tag

	tagHandlerMu sync.RWMutex
	tagHandler   http.Handler
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
		tags = append(tags, tag)
	}
	sort.Sort(tags)
	genPages(t, tags, tagsTemplate, "tags", "tags", "tag", &a.tagHandler)
}

func (a *assetsDir) initAssets() error {
	d, err := os.Open(a.location)
	if err != nil {
		return errors.WithContext("error open asset directory: ", err)
	}
	files, err := d.Readdirnames(-1)
	d.Close()
	if err != nil {
		return errors.WithContext("error reading asset directory:", err)
	}
	a.assets = make(map[uint]*Asset)
	var (
		largestAssetID uint64
		latestTime     time.Time
	)
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
	genPages(t, as, assetsTemplate, "index", "assets", "asset", &a.assetHandler)
}

var exts = [...]string{".html", ".txt", ".json", ".xml"}

func genPages(t time.Time, list io.WriterTo, htmlTemplate *template.Template, baseName, topTag, tag string, handler *http.Handler) {
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

func (a *assetsDir) Options(w http.ResponseWriter, r *http.Request) bool {
	filename := filepath.Join(a.location, filepath.Clean(filepath.FromSlash(r.URL.Path)))
	if strings.HasSuffix(filename, ".meta") || !fileExists(filename) {
		http.NotFound(w, r)
	} else if Auth.IsAdmin(r) {
		if r.URL.Path == "/" {
			w.Header().Set("Allow", "OPTIONS, GET, HEAD, POST")
		} else if r.URL.Path == tagsPath {
			w.Header().Set("Allow", "OPTIONS, GET, HEAD, PATCH")
		} else {
			w.Header().Set("Allow", "OPTIONS, GET, HEAD, PATCH, PUT, DELETE")
		}
	} else {
		if r.URL.Path == tagsPath {
			w.WriteHeader(http.StatusUnauthorized)
		} else {
			w.Header().Set("Allow", "OPTIONS, GET, HEAD")
		}
	}
	return true
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
	}
	return false
}

func (a *assetsDir) Get(w http.ResponseWriter, r *http.Request) bool {
	if strings.HasSuffix(r.URL.Path, ".meta") {
		http.NotFound(w, r)
	} else if Auth.IsAdmin(r) {
		handler := a.handler
		if r.URL.Path == "/" {
			at := AcceptType("html")
			httpaccept.HandleAccept(r, &at)
			r.URL.Path += "index." + string(at)
			a.assetHandlerMu.RLock()
			handler = a.assetHandler
			a.assetHandlerMu.RUnlock()
		} else if r.URL.Path == tagsPath {
			var at AcceptType
			if httpaccept.HandleAccept(r, &at) {
				r.URL.Path += string(at)
			}
			a.tagHandlerMu.RLock()
			handler = a.tagHandler
			a.tagHandlerMu.RUnlock()
		}
		handler.ServeHTTP(w, r)
	} else {
		if r.URL.Path == "/" || r.URL.Path == tagsPath {
			w.WriteHeader(http.StatusForbidden)
		} else {
			a.handler.ServeHTTP(w, r)
		}
	}
	return true
}

func (a *assetsDir) Post(w http.ResponseWriter, r *http.Request) bool {
	if Auth.IsAdmin(r) && r.URL.Path == "/" {
		m, err := r.MultipartReader()
		if err != nil {
			http.Error(w, err.Error(), http.StatusBadRequest)
			return true
		}
		buf := make(memio.Buffer, 512)
		var added []Tag
		for {
			p, err := m.NextPart()
			if err != nil {
				if err == io.EOF {
					break
				}
				http.Error(w, err.Error(), http.StatusBadRequest)
				return true
			}
			n, err := io.ReadFull(p, buf)
			if err != nil {
				http.Error(w, err.Error(), http.StatusBadRequest)
				return true
			}
			var typ = getType(http.DetectContentType(buf[:n]))
			if typ == "" {
				continue
			}
			a.assetMu.Lock()
			id := a.nextAssetID
			a.nextAssetID++
			a.assetMu.Unlock()
			filename := strconv.FormatUint(uint64(id), 10)
			mBuf := buf[:n]
			fp := filepath.Join(a.location, filename)
			if err := uploadFile(io.MultiReader(&mBuf, p), fp); err != nil {
				http.Error(w, err.Error(), http.StatusBadRequest)
				return true
			}
			f, err := os.Create(fp + ".meta")
			if err != nil {
				http.Error(w, err.Error(), http.StatusInternalServerError)
				return true
			}
			io.WriteString(f, filename)
			f.Close()
			if err != nil {
				http.Error(w, err.Error(), http.StatusInternalServerError)
				return true
			}
			a.assetMu.Lock()
			a.assets[id] = &Asset{
				Name: filename,
				Type: typ,
			}
			a.assetMu.Unlock()
			added = append(added, Tag{ID: id, Name: filename})
		}
		w.Header().Set(contentType, jsonType)
		json.NewEncoder(w).Encode(added)
		return true
	}
	return false
}

func (a *assetsDir) Delete(w http.ResponseWriter, r *http.Request) bool {
	if Auth.IsAdmin(r) && r.URL.Path != "/" && r.URL.Path != tagsPath {
		id, err := strconv.ParseUint(strings.TrimPrefix(r.URL.Path), "/")
		if err != nil {
			http.NotFound(w, r)
			return true
		}
		filename := filepath.Join(a.location, filepath.Clean(filepath.FromSlash(r.URL.Path)))
		if !fileExists(filename) || strings.HasSuffix(filename, ".meta") {
			http.NotFound(w, r)
			return true
		}
		if err := os.Remove(filename); err != nil {
			w.WriteHeader(http.StatusInternalServerError)
			io.WriteString(w, err.Error())
			return true
		}
		if err := os.Remove(filename + ".meta"); err != nil {
			w.WriteHeader(http.StatusInternalServerError)
			io.WriteString(w, err.Error())
			return true
		}
		a.assetMu.Lock()
		delete(a.assets, uint(id))
		a.genAssetsHandler(time.Now())
		a.assetMu.Unlock()
		w.WriteHeader(http.StatusNoContent)
		return true
	}
	return false
}

var AssetsDir assetsDir

type Asset struct {
	ID   uint   `json:"id" xml:"id,attr"`
	Name string `json:"name" xml:"name"`
	Type string `json:"type" xml:"type"`
	Tags []uint `json:"tags" xml:"tags>tag"`
}

type Assets []Asset

func (a Assets) WriteTo(w io.Writer) (int64, error) {
	var total int64
	for _, asset := range a {
		n, err := fmt.Fprintf(w, "%d:%s\n", asset.ID, asset.Name)
		total += int64(n)
		if err != nil {
			return total, err
		}
		for m, tid := range asset.Tags {
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

type Tags []*Tag

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

type TagPatch struct {
	Add    []string `json:"add" xml:"add"`
	Remove []uint   `json:"remove" xml:"remove"`
	Rename Tags     `json:"rename" xml:"rename"`
}

func (t *TagPatch) Parse(r io.Reader) error {
	b := bufio.NewReader(r)
	for {
		c, err := b.ReadByte()
		if err != nil {
			if err == io.EOF {
				return nil
			}
			return errors.WithContext("error reading method byte: ", err)
		}
		switch c {
		case '>':
			newTag, err := b.ReadBytes('\n')
			newTagStr := strings.TrimSuffix(string(newTag), "\n")
			if len(newTagStr) > 0 {
				t.Add = append(t.Add, newTagStr)
			}
			if err != nil {
				if err == io.EOF {
					return nil
				}
				return errors.WithContext("error reading new tag name: ", err)
			}
		case '<':
			idStr, err := b.ReadBytes('\n')
			id, errb := strconv.ParseUint(string(strings.TrimSuffix(string(idStr), "\n")), 10, 0)
			t.Remove = append(t.Remove, uint(id))
			if err != nil {
				if err == io.EOF {
					return nil
				}
				return errors.WithContext("error read remove id: ", err)
			} else if errb != nil {
				return errors.WithContext("error parsing remove id: ", errb)
			}
		case '~':
			idStr, err := b.ReadBytes(':')
			var newName []byte
			if err == nil {
				newName, err = b.ReadBytes('\n')
			}
			id, errb := strconv.ParseUint(string(strings.TrimSuffix(string(idStr), "\n")), 10, 0)
			newNameStr := strings.TrimSuffix(string(newName), "\n")
			t.Rename = append(t.Rename, &Tag{ID: uint(id), Name: newNameStr})
			if err != nil {
				if err == io.EOF {
					return nil
				}
				return errors.WithContext("error parsing rename id:", errb)
			} else if errb != nil {
				return errors.WithContext("error read tag new name: ", errb)
			}
		default:
			return ErrInvalidMethodByte
		}
	}
}

type AssetPatch struct {
	AddTag    []uint `json:"addTag" xml:"addTag"`
	RemoveTag []uint `json:"removeTag" xml:"removeTag"`
	Rename    string `json:"rename" xml:"rename"`
}

func (a *AssetPatch) Parse(r io.Reader) error {
	b := bufio.NewReader(r)
	for {
		c, err := b.ReadByte()
		if err != nil {
			if err == io.EOF {
				return nil
			}
			return errors.WithContext("error reading method byte: ", err)
		}
		switch c {
		case '>':
			idStr, err := b.ReadBytes('\n')
			id, errb := strconv.ParseUint(string(strings.TrimSuffix(string(idStr), "\n")), 10, 0)
			a.AddTag = append(a.AddTag, uint(id))
			if err != nil {
				if err == io.EOF {
					return nil
				}
				return errors.WithContext("error reading tag id:", err)
			} else if errb != nil {
				return errors.WithContext("error parsing tag id: ", errb)
			}
		case '<':
			idStr, err := b.ReadBytes('\n')
			id, errb := strconv.ParseUint(strings.TrimSuffix(string(idStr), "\n"), 10, 0)
			a.RemoveTag = append(a.RemoveTag, uint(id))
			if err != nil {
				if err == io.EOF {
					return nil
				}
				return errors.WithContext("error reading tag id:", err)
			} else if errb != nil {
				return errors.WithContext("error parsing tag id: ", errb)
			}
		case '~':
			if a.Rename != "" {
				return ErrCannotMultiRename
			}
			newName, err := b.ReadBytes('\n')
			a.Rename = strings.TrimSuffix(string(newName), "\n")
			if err != nil {
				if err == io.EOF {
					return nil
				}
				return errors.WithContext("error reading new asset name: ", err)
			}
		default:
			return ErrInvalidMethodByte
		}
	}
}

const (
	tagsPath                          = "/tags"
	ErrInvalidMethodByte errors.Error = "invalid method byte"
	ErrCannotMultiRename errors.Error = "cannot rename multiple times"
	ErrInvalidTagFile    errors.Error = "invalid tag file"
	ErrInvalidFileType   errors.Error = "invalid file type"
)
