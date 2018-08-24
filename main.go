package main

import (
	"fmt"
	"net/http"
	"os"
	"os/signal"
	"strings"

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

	Assets.dir = "./assets"
	e(Socket.init())

	Auth.Handle("/socket", &Socket)
	Auth.Handle("/files/", Trim("/files", http.FileServer(http.Dir("./files"))))
	Auth.Handle("/assets/", Trim("/assets", http.FileServer(http.Dir("./assets"))))
	Auth.Handle("/", httpgzip.FileServer(dir))

	srv := http.Server{
		Addr:    ":8080",
		Handler: &Auth,
	}

	c := make(chan os.Signal, 1)
	go func() {
		signal.Notify(c, os.Interrupt)
		<-c
		fmt.Println("...Closing")
		signal.Stop(c)
		close(c)
		srv.Close()
	}()

	fmt.Println("Running...")
	err := srv.ListenAndServe()
	if err != http.ErrServerClosed {
		e(err)
	}
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
