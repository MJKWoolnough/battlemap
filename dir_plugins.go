package battlemap

import (
	"compress/gzip"
	"encoding/json"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"sort"
	"strings"

	"vimagination.zapto.org/errors"
	"vimagination.zapto.org/httpdir"
	"vimagination.zapto.org/httpgzip"
	"vimagination.zapto.org/keystore"
	"vimagination.zapto.org/memio"
)

type pluginsDir struct {
	http.Handler
	json memio.Buffer
}

func (p *pluginsDir) Init(b *Battlemap) error {
	var pd keystore.String
	b.config.Get("pluginsDir", &pd)
	if pd == "" {
		p.Handler = http.NotFoundHandler()
		return nil
	}
	d, err := os.Open(filepath.Join(b.config.BaseDir, string(pd)))
	if os.IsNotExist(err) {
		p.Handler = http.NotFoundHandler()
		return nil
	}
	di, err := d.Stat()
	if err != nil {
		return errors.WithContext("error reading plugin directory stats: ", err)
	}
	fs, err := d.Readdirnames(-1)
	if err != nil {
		return errors.WithContext("error reading plugin directory: ", err)
	}
	latest := di.ModTime()
	hd := httpdir.New(latest)
	g, _ := gzip.NewWriterLevel(nil, gzip.BestCompression)
	sort.Strings(fs)
	list := make([]string, 0, len(fs))
	for _, file := range fs {
		if !strings.HasSuffix(file, ".js") {
			continue
		}
		f, err := os.Open(file)
		if err != nil {
			return errors.WithContext("error opening plugin file: ", err)
		}
		fi, err := f.Stat()
		if err != nil {
			f.Close()
			return errors.WithContext("error stat'ing plugin file: ", err)
		}
		buf := make([]byte, 0, fi.Size())
		_, err = io.ReadFull(f, buf)
		f.Close()
		if err != nil {
			continue
		}
		var gBuf memio.Buffer
		g.Reset(&gBuf)
		g.Write(buf)
		g.Close()
		ft := fi.ModTime()
		hd.Create(file, httpdir.FileBytes(buf, ft))
		hd.Create(file+".gz", httpdir.FileBytes(gBuf, ft))
		if ft.After(latest) {
			latest = ft
		}
		list = append(list, file)
	}
	p.Handler = httpgzip.FileServer(hd)
	return json.NewEncoder(&p.json).Encode(list)
}

func (p *pluginsDir) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	if r.URL.Path == "" {
		w.Header().Set("Content-Type", "application/json")
		w.Write(p.json)
	} else {
		p.Handler.ServeHTTP(w, r)
	}
}
