package battlemap

import (
	"fmt"
	"io/ioutil"
	"net/http/httptest"
	"os"
	"testing"

	"vimagination.zapto.org/httpdir"
)

var (
	srv       *httptest.Server
	battlemap Battlemap
)

func TestMain(m *testing.M) {
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
	if err := battlemap.initModules(dataDir); err != nil {
		fmt.Fprintln(os.Stderr, err)
		return 1
	}
	battlemap.initMux(httpdir.Default)
	srv = httptest.NewServer(&battlemap)
	r := m.Run()
	srv.Close()
	return r
}
