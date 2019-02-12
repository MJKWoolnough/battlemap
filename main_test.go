package main

import (
	"fmt"
	"io/ioutil"
	"net/http/httptest"
	"os"
	"testing"
)

var srv *httptest.Server

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
	if err := initModules(dataDir); err != nil {
		fmt.Fprintln(os.Stderr, err)
		return 1
	}
	srv = httptest.NewServer(initMux())
	r := m.Run()
	srv.Close()
	return r
}
