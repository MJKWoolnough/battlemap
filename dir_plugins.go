package main

import (
	"compress/gzip"
	"fmt"
	"html/template"
	"io"
	"net/http"
	"os"
	"sort"
	"strings"
	"time"

	"vimagination.zapto.org/errors"
	"vimagination.zapto.org/httpdir"
	"vimagination.zapto.org/httpgzip"
	"vimagination.zapto.org/jslib/checker"
	"vimagination.zapto.org/memio"
	"vimagination.zapto.org/parser"
)

type pluginsDir struct {
	DefaultMethods
	http.Handler
}

func (p *pluginsDir) Init() error {
	pd := Config.PluginDir
	if pd == "" {
		p.Handler = http.NotFoundHandler()
		return nil
	}
	d, err := os.Open(pd)
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
	list := make(PluginList, 0, len(fs))
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
		buf := make(memio.Buffer, 0, fi.Size())
		p := parser.New(parser.NewReaderTokeniser(f))
		checker.SetPhraser(&p)
		for {
			ph, err := p.GetPhrase()
			if err != nil {
				f.Close()
				return errors.WithContext(fmt.Sprintf("error parsing plugin file (%s): ", file), err)
			}
			if ph.Type == parser.PhraseDone {
				break
			}
			for _, t := range ph.Data {
				buf.WriteString(t.Data)
			}
		}
		f.Close()
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
		list = append(list, Plugin{
			File:    file,
			Size:    fi.Size(),
			Updated: ft.Format(time.RFC850),
		})
	}
	genPagesDir(latest, list, pluginsTemplate, "index", "plugins", "plugin", &hd)
	p.Handler = httpgzip.FileServer(hd)
	return nil
}

type PluginList []Plugin

func (pl PluginList) WriteTo(w io.Writer) (int64, error) {
	var total int64
	for _, p := range pl {
		n, err := io.WriteString(w, p.File)
		total += int64(n)
		if err != nil {
			return total, err
		}
		n, err = w.Write(newLine)
		total += int64(n)
		if err != nil {
			return total, err
		}
	}
	return total, nil
}

type Plugin struct {
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
{{range .}}			<tr><td><a href="{{.File}}">{{.File}}</a></td><td>{{.Size}}</td><td>{{.Updated}}</td></tr>
{{end}}		</table>
	</body>
</html>`))

func (p *pluginsDir) Options(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Allow", "OPTIONS, GET, HEAD")
}

func (p *pluginsDir) Get(w http.ResponseWriter, r *http.Request) bool {
	p.Handler.ServeHTTP(w, r)
	return true
}

var PluginsDir pluginsDir
