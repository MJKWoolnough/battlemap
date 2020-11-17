package battlemap

import (
	"bytes"
	"compress/gzip"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"sync"

	"vimagination.zapto.org/httpdir"
	"vimagination.zapto.org/httpgzip"
	"vimagination.zapto.org/keystore"
	"vimagination.zapto.org/memio"
	"vimagination.zapto.org/rwcount"
)

type plugin struct {
	Enabled bool                       `json:"enabled"`
	Data    map[string]json.RawMessage `json:"data"`
}

type pluginData map[string]*plugin

func (p pluginData) ReadFrom(r io.Reader) (int64, error) {
	var rc = rwcount.Reader{Reader: r}
	err := json.NewDecoder(&rc).Decode(&p)
	return rc.Count, err
}

func (p pluginData) WriteTo(w io.Writer) (int64, error) {
	var wc = rwcount.Writer{Writer: w}
	err := json.NewEncoder(&wc).Encode(p)
	return wc.Count, err
}

type pluginsDir struct {
	*Battlemap
	http.Handler
	plugins pluginData

	mu   sync.RWMutex
	json json.RawMessage
}

func (p *pluginsDir) Init(b *Battlemap) error {
	var pd keystore.String
	b.config.Get("PluginsDir", &pd)
	if pd == "" {
		return ErrInvalidPlugins
	}
	p.plugins = make(pluginData)
	if err := b.config.Get("PluginsInfo", p.plugins); err != nil {
		return err
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
	currPlugins := make(map[string]struct{}, len(p.plugins))
	for p := range p.plugins {
		currPlugins[p] = struct{}{}
	}
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
		if _, ok := currPlugins[file]; ok {
			delete(currPlugins, file)
		} else {
			p.plugins[file] = &plugin{Data: make(map[string]json.RawMessage)}
		}
	}
	for pn := range currPlugins {
		delete(p.plugins, pn)
	}
	p.Battlemap = b
	p.Handler = httpgzip.FileServer(hd)
	p.updateJSON()
	return nil
}

func (*pluginsDir) Cleanup() {}

func (p *pluginsDir) savePlugins() error {
	p.updateJSON()
	return p.config.Set("PluginsInfo", p.plugins)
}

func (p *pluginsDir) updateJSON() {
	var w memio.Buffer
	json.NewEncoder(&w).Encode(p.plugins)
	p.json = json.RawMessage(w)
}

func (p *pluginsDir) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	p.Handler.ServeHTTP(w, r)
}

var null = json.RawMessage{'n', 'u', 'l', 'l'}

func (p *pluginsDir) RPCData(cd ConnData, method string, data json.RawMessage) (interface{}, error) {
	switch method {
	case "list":
		p.mu.RLock()
		j := p.json
		p.mu.RUnlock()
		return j, nil
	case "set":
		var toSet struct {
			Filename string                     `json:"file"`
			Data     map[string]json.RawMessage `json:"data"`
		}
		if err := json.Unmarshal(data, &toSet); err != nil {
			return nil, err
		}
		if len(toSet.Data) == 0 {
			return nil, nil
		}
		p.mu.Lock()
		plugin, ok := p.plugins[toSet.Filename]
		if !ok {
			p.mu.Unlock()
			return nil, ErrUnknownPlugin
		}
		for key, value := range toSet.Data {
			if f := p.isLinkKey(key); f != nil {
				if d, ok := plugin.Data[key]; ok {
					f.setHiddenLinkJSON(d, value)
				} else {
					f.setHiddenLinkJSON(nil, value)
				}
			}
			if bytes.Equal(value, null) {
				delete(plugin.Data, key)
			} else {
				plugin.Data[key] = value

			}
		}
		p.savePlugins()
		cd.CurrentMap = 0
		p.socket.broadcastMapChange(cd, broadcastPluginSettingChange, data, userAny)
		p.mu.Unlock()
	case "enable", "disable":
		var filename string
		if err := json.Unmarshal(data, &filename); err != nil {
			return nil, err
		}
		p.mu.Lock()
		plugin, ok := p.plugins[filename]
		if !ok {
			p.mu.Unlock()
			return nil, ErrUnknownPlugin
		}
		plugin.Enabled = method == "enable"
		p.savePlugins()
		cd.CurrentMap = 0
		p.socket.broadcastMapChange(cd, broadcastPluginChange, json.RawMessage{'0'}, userAny)
		p.mu.Unlock()
	default:
		return nil, ErrUnknownMethod
	}
	return nil, nil
}

// Errors
var (
	ErrInvalidPlugins = errors.New("invalid plugin location")
	ErrUnknownPlugin  = errors.New("unknown plugin")
)
