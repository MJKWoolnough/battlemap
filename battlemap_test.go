package battlemap

import (
	"flag"
	"fmt"
	"io/ioutil"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"vimagination.zapto.org/keystore"
)

var (
	srv       *httptest.Server
	battlemap Battlemap
)

func TestMain(m *testing.M) {
	for _, arg := range os.Args {
		if strings.HasPrefix(arg, "-httptest.serve=") {
			pluginTest := flag.Bool("plugintest", false, "disable cached plugins for easier testing")
			flag.Parse()
			if err := battlemap.initModules("./test/", nil); err != nil {
				fmt.Fprintln(os.Stderr, err)
				os.Exit(1)
			}
			if *pluginTest {
				var pd keystore.String
				battlemap.config.Get("PluginsDir", &pd)
				battlemap.plugins.Handler = http.FileServer(http.Dir(filepath.Join(battlemap.config.BaseDir, string(pd))))
			}
			battlemap.initMux(http.FileServer(http.Dir("./internal/static")))
			mux := http.NewServeMux()
			mux.Handle("/", &battlemap)
			srv := httptest.NewUnstartedServer(mux)
			srv.Start()
		}
	}
	dataDir, err := ioutil.TempDir("", "battlemap-test")
	if err != nil {
		fmt.Fprintf(os.Stderr, "error creating temp dir: %s", err)
		os.Exit(1)
	}
	r := testMain(m, dataDir)
	os.RemoveAll(dataDir)
	os.Exit(r)
}

func testMain(m *testing.M, dataDir string) int {
	if err := battlemap.initModules(dataDir, nil); err != nil {
		fmt.Fprintln(os.Stderr, err)
		return 1
	}
	battlemap.initMux(index)
	srv = httptest.NewServer(&battlemap)
	r := m.Run()
	srv.Close()
	return r
}
