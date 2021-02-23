package battlemap

import (
	"compress/gzip"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"path/filepath"
	"strings"
	"sync"
	"time"

	"vimagination.zapto.org/httpdir"
	"vimagination.zapto.org/httpgzip"
	"vimagination.zapto.org/keystore"
	"vimagination.zapto.org/memio"
	"vimagination.zapto.org/rwcount"
)

const pluginConfigExt = ".config"

type plugin struct {
	Enabled bool                    `json:"enabled"`
	Data    map[string]keystoreData `json:"data"`
}

func (p *plugin) ReadFrom(r io.Reader) (int64, error) {
	var rc = rwcount.Reader{Reader: r}
	err := json.NewDecoder(&rc).Decode(&p)
	return rc.Count, err
}

func (p *plugin) WriteTo(w io.Writer) (int64, error) {
	var wc = rwcount.Writer{Writer: w}
	p.WriteToUser(&wc, true)
	return wc.Count, wc.Err
}

var (
	pluginStart     = []byte{'{', '"', 'e', 'n', 'a', 'b', 'l', 'e', 'd', '"', ':'}
	pluginTrue      = []byte{'t', 'r', 'u', 'e'}
	pluginFalse     = []byte{'f', 'a', 'l', 's', 'e'}
	pluginMid       = []byte{',', '"', 'd', 'a', 't', 'a', '"', ':', '{'}
	pluginComma     = []byte{','}
	pluginDataStart = []byte{':', '{', '"', 'u', 's', 'e', 'r', '"', ':'}
	pluginDataMid   = []byte{',', '"', 'd', 'a', 't', 'a', '"', ':'}
	pluginEnd       = []byte{'}', '}'}
)

func (p *plugin) WriteToUser(w io.Writer, isAdmin bool) {
	w.Write(pluginStart)
	if p.Enabled {
		w.Write(pluginTrue)
	} else {
		w.Write(pluginFalse)
	}
	w.Write(pluginMid)
	first := true
	for key, val := range p.Data {
		if isAdmin || val.User {
			if first {
				first = false
			} else {
				w.Write(pluginComma)
			}
			fmt.Fprintf(w, "%q", key) // need to replace with JSON specific code
			w.Write(pluginDataStart)
			if val.User {
				w.Write(pluginTrue)
			} else {
				w.Write(pluginFalse)
			}
			w.Write(pluginDataMid)
			w.Write(val.Data)
			w.Write(pluginEnd[:1])
		}
	}
	w.Write(pluginEnd)
}

type pluginsDir struct {
	*Battlemap
	http.Handler
	plugins map[string]*plugin

	*keystore.FileStore

	mu       sync.RWMutex
	json     json.RawMessage
	userJSON json.RawMessage
}

func (p *pluginsDir) Init(b *Battlemap, links links) error {
	var pd keystore.String
	err := b.config.Get("PluginsDir", &pd)
	if err != nil {
		return fmt.Errorf("error retrieving plugins location: %w", err)
	}
	base := filepath.Join(b.config.BaseDir, string(pd))
	p.FileStore, err = keystore.NewFileStore(base, base, keystore.NoMangle)
	if err != nil {
		return fmt.Errorf("error creating plugins keystore: %w", err)
	}
	p.plugins = make(map[string]*plugin)
	hd := httpdir.New(time.Now())
	g, _ := gzip.NewWriterLevel(nil, gzip.BestCompression)
	for _, file := range p.FileStore.Keys() {
		if !strings.HasSuffix(file, ".js") {
			continue
		}
		st, err := p.FileStore.Stat(file)
		if err != nil {
			return fmt.Errorf("error stat'ing plugin (%s): %w", file, err)
		}
		buf := make(memio.Buffer, 0, st.Size())
		p.FileStore.Get(file, &buf)
		var gBuf memio.Buffer
		g.Reset(&gBuf)
		g.Write(buf)
		g.Close()
		ft := st.ModTime()
		hd.Create(file, httpdir.FileBytes(buf, ft))
		hd.Create(file+".gz", httpdir.FileBytes(gBuf, ft))
		s := file + pluginConfigExt
		if p.FileStore.Exists(s) {
			var plugin plugin
			p.FileStore.Get(s, &plugin)
			p.plugins[file] = &plugin
		} else {
			p.plugins[file] = &plugin{Data: make(map[string]keystoreData)}
		}
	}
	p.Battlemap = b
	p.Handler = httpgzip.FileServer(hd)
	p.updateJSON()
	return nil
}

func (p *pluginsDir) updateJSON() {
	wa := append(memio.Buffer{}, '{')
	wu := append(memio.Buffer{}, '{')
	first := true
	for id, plugin := range p.plugins {
		if first {
			first = false
		} else {
			wa = append(wa, ',')
			wu = append(wu, ',')
		}
		wa = append(appendString(wa, id), ':')
		wu = append(appendString(wu, id), ':')
		plugin.WriteToUser(&wa, true)
		plugin.WriteToUser(&wu, false)
	}
	wa = append(wa, '}')
	wu = append(wu, '}')
	p.json = json.RawMessage(wa)
	p.userJSON = json.RawMessage(wu)
}

func (p *pluginsDir) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	p.Handler.ServeHTTP(w, r)
}

var null = json.RawMessage{'n', 'u', 'l', 'l'}

func (p *pluginsDir) RPCData(cd ConnData, method string, data json.RawMessage) (interface{}, error) {
	switch method {
	case "list":
		var j json.RawMessage
		p.mu.RLock()
		if cd.IsAdmin() {
			j = p.json
		} else {
			j = p.userJSON
		}
		p.mu.RUnlock()
		return j, nil
	case "set":
		var toSet struct {
			ID       string                  `json:"id"`
			Setting  map[string]keystoreData `json:"setting"`
			Removing []string                `json:"removing"`
		}
		if err := json.Unmarshal(data, &toSet); err != nil {
			return nil, err
		}
		if len(toSet.Setting) == 0 && len(toSet.Removing) == 0 {
			return nil, nil
		}
		p.mu.Lock()
		plugin, ok := p.plugins[toSet.ID]
		if !ok {
			p.mu.Unlock()
			return nil, ErrUnknownPlugin
		}
		p.socket.broadcastAdminChange(broadcastPluginSettingChange, data, cd.ID)
		buf := appendString(append(data[:0], "{\"ID\":"...), toSet.ID)
		buf = append(buf, ",\"setting\":{"...)
		var userRemoves []string
		for key, val := range toSet.Setting {
			if val.User {
				buf = append(append(append(appendString(append(buf, ','), key), ":{\"user\":true,\"data\":"...), val.Data...), '}')
			} else if mv, ok := plugin.Data[key]; ok && mv.User {
				userRemoves = append(userRemoves, key)
			}
			plugin.Data[key] = val
		}
		buf = append(buf, "},\"removing\":["...)
		first := true
		for _, key := range toSet.Removing {
			val, ok := plugin.Data[key]
			if !ok {
				continue
			}
			if val.User {
				if !first {
					buf = append(buf, ',')
				} else {
					first = false
				}
				buf = appendString(buf, key)
			}
			delete(plugin.Data, key)
		}
		p.FileStore.Set(toSet.ID+pluginConfigExt, plugin)
		for _, key := range userRemoves {
			if !first {
				buf = append(buf, ',')
			} else {
				first = false
			}
			buf = appendString(buf, key)
		}
		buf = append(buf, ']', '}')
		cd.CurrentMap = 0
		p.socket.broadcastMapChange(cd, broadcastPluginSettingChange, data, userAny)
		p.updateJSON()
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
		p.FileStore.Set(filename+pluginConfigExt, plugin)
		cd.CurrentMap = 0
		p.socket.broadcastMapChange(cd, broadcastPluginChange, json.RawMessage{'0'}, userAny)
		p.updateJSON()
		p.mu.Unlock()
	default:
		return nil, ErrUnknownMethod
	}
	return nil, nil
}

// Errors
var (
	ErrUnknownPlugin = errors.New("unknown plugin")
)
