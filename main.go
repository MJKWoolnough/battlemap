package main

import (
	"fmt"
	"net"
	"net/http"
	"os"
	"strings"

	"golang.org/x/net/websocket"
	"vimagination.zapto.org/httpdir"
	"vimagination.zapto.org/httpgzip"
)

var dir http.FileSystem = httpdir.Default

func e(err error) {
	if err != nil {
		fmt.Fprintf(os.Stderr, "error: %s\n", err)
		os.Exit(1)
	}
}

func main() {
	e(DB.Init("database.db"))

	l, err := net.Listen("tcp", ":8080")
	e(err)

	Auth.Handle("/maps", websocket.Handler(Maps.handleConn))
	Auth.Handle("/files/", Trim("/files", http.FileServer(http.Dir("./files"))))
	Auth.Handle("/assets/", Trim("/assets", http.FileServer(http.Dir("./assets"))))
	Auth.Handle("/assets", websocket.Handler(Assets.handleConn))
	Auth.Handle("/", httpgzip.FileServer(dir))
	fmt.Println("Running...")
	fmt.Println(http.Serve(l, &Auth))
}

type HTTPTrim struct {
	dir string
	http.Handler
}

func Trim(dir string, handler http.Handler) http.Handler {
	return &HTTPTrim{
		dir:     dir,
		Handler: handler,
	}
}

func (h *HTTPTrim) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	r.URL.Path = strings.TrimPrefix(r.URL.Path, h.dir)
	h.Handler.ServeHTTP(w, r)
}
