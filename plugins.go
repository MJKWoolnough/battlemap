package battlemap

import (
	"compress/gzip"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"sort"
	"strings"

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
	b.config.Get("PluginsDir", &pd)
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
		return fmt.Errorf("error reading plugin directory stats: %w", err)
	}
	fs, err := d.Readdirnames(-1)
	if err != nil {
		return fmt.Errorf("error reading plugin directory: %w", err)
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
			return fmt.Errorf("error opening plugin file: %w", err)
		}
		fi, err := f.Stat()
		if err != nil {
			f.Close()
			return fmt.Errorf("error stat'ing plugin file: %w", err)
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

func (*pluginsDir) Cleanup() {}

func (p *pluginsDir) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	if r.URL.Path == "" {
		w.Header().Set("Content-Type", "application/json")
		w.Write(p.json)
	} else {
		p.Handler.ServeHTTP(w, r)
	}
}
