package battlemap

import (
	"compress/gzip"
	"encoding/json"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"sort"
	"strings"

	"vimagination.zapto.org/httpdir"
	"vimagination.zapto.org/keystore"
	"vimagination.zapto.org/memio"
)

type pluginsDir struct {
	json json.RawMessage
}

func (p *pluginsDir) Init(b *Battlemap) error {
	var pd keystore.String
	b.config.Get("PluginsDir", &pd)
	if pd == "" {
		return nil
	}
	base := filepath.Join(b.config.BaseDir, string(pd))
	d, err := os.Open(base)
	if os.IsNotExist(err) {
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
	p.json = append(p.json[:0], '[')
	for _, file := range fs {
		if !strings.HasSuffix(file, ".js") {
			continue
		}
		f, err := os.Open(filepath.Join(base, file))
		if err != nil {
			return fmt.Errorf("error opening plugin file: %w", err)
		}
		fi, err := f.Stat()
		if err != nil {
			f.Close()
			return fmt.Errorf("error stat'ing plugin file: %w", err)
		}
		buf := make([]byte, fi.Size())
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
		if len(p.json) > 1 {
			p.json = append(p.json, ',')
		}
		p.json = append(appendString(append(p.json, '['), file), ",true]"...)
	}
	p.json = append(p.json, ']')
	return nil
}

func (*pluginsDir) Cleanup() {}

func (p *pluginsDir) RPCData(cd ConnData, method string, data json.RawMessage) (json.RawMessage, error) {
	switch method {
	case "list":
		return p.json, nil
	}
	return nil, ErrUnknownMethod
}
