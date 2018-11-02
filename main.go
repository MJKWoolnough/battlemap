package main

import (
	"fmt"
	"net/http"
	"os"
	"os/signal"

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
	Auth.Handle("/files/", http.StripPrefix("/files/", http.FileServer(http.Dir("./files"))))
	Auth.Handle("/assets/", http.StripPrefix("/assets/", http.FileServer(http.Dir("./assets"))))
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
	if err := DB.Close(); err != nil {
		e(err)
	}
	if err != http.ErrServerClosed {
		e(err)
	}
}
