package main

import (
	"fmt"
	"net"
	"net/http"
	"os"

	"golang.org/x/net/websocket"
	"vimagination.zapto.org/httpbuffer"
	"vimagination.zapto.org/httpdir"
	"vimagination.zapto.org/httpgzip"
)

var dir http.FileSystem = httpdir.Default

func e(err error) {
	if err != nil {
		fmt.Fprintf(os.Stderr, "error: %s", err)
		os.Exit(1)
	}
}

func main() {
	e(DB.Init("database.db"))

	l, err := net.Listen("tcp", ":8080")
	e(err)

	Auth.Handle("/socket", websocket.Handler(handleConn))
	Auth.Handle("/files", http.FileServer(http.Dir("./files/")))
	Auth.Handle("/assets", httpbuffer.Handler{&Assets})
	Auth.Handle("/", httpgzip.FileServer(dir))
	http.Serve(l, &Auth)
}
