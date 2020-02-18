package battlemap

import (
	"compress/gzip"
	"html/template"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"time"

	"vimagination.zapto.org/errors"
	"vimagination.zapto.org/httpdir"
	"vimagination.zapto.org/httpgzip"
	"vimagination.zapto.org/keystore"
	"vimagination.zapto.org/memio"
)

type pluginsDir struct {
	http.Handler
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
	list := make(pluginList, 0, len(fs))
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
		list = append(list, plugin{
			File:    file,
			Size:    fi.Size(),
			Updated: ft.Format(time.RFC850),
		})
	}
	genPagesDir(latest, list, pluginsTemplate, "index", "plugins", "plugin", &hd)
	p.Handler = httpgzip.FileServer(hd)
	return nil
}

type pluginList []plugin

type plugin struct {
	File    string
	Size    int64
	Updated string
}

var pluginsTemplate = template.Must(template.New("").Parse(`<!DOCTYPE html>
<html>
	<head>
		<title>Plugins</title>
	</head>
	<body>
		<table>
			<thead>
				<tr><th>Name</th><th>Size</th><th>Last Updated</th></tr>
			</thead>
			<tbody>
{{range .}}				<tr><td><a href="{{.File}}">{{.File}}</a></td><td>{{.Size}}</td><td>{{.Updated}}</td></tr>
{{end}}			</tbody>
		</table>
	</body>
</html>`))

func (p *pluginsDir) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	p.Handler.ServeHTTP(w, r)
}

var PluginsDir pluginsDir
