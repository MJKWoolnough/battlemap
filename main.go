package main

import (
	"fmt"
	"log"
	"net/http"
	"os"
	"os/signal"

	"golang.org/x/net/websocket"
	"vimagination.zapto.org/httpdir"
	"vimagination.zapto.org/httpgzip"
)

var dir http.FileSystem = httpdir.Default

func e(err error, reason string) {
	if err != nil {
		fmt.Fprintf(os.Stderr, "%s: %s\n", reason, err)
		os.Exit(1)
	}
}

const configFile = "config.json"

func main() {
	e(LoadConfig(configFile), "error loading config")

	port := Config.ServerPort

	mux := http.NewServeMux()
	srv := http.Server{
		Addr:    fmt.Sprintf(":%d", port),
		Handler: mux,
	}

	e(Socket.Init(), "error initialising Socket module")
	http.Handle("/socket", websocket.Handler(Socket.ServeConn))

	e(Auth.Init(), "error initialising Auth module")
	mux.HandleFunc("/login/update", Auth.UpdatePassword)
	mux.HandleFunc("/login/logout", Auth.Logout)
	mux.HandleFunc("/login/login", Auth.Login)

	Assets.Init()
	mux.Handle("/assets/", http.StripPrefix("/assets/", Dir{&Assets}))

	Chars.Init()
	mux.Handle("/characters/", http.StripPrefix("/characters/", &Chars))

	Maps.Init()
	mux.Handle("/maps/", http.StripPrefix("/maps/", &Maps))

	Files.Init()
	mux.Handle("/files/", http.StripPrefix("/files/", Dir{&Files}))

	mux.Handle("/", httpgzip.FileServer(dir))

	c := make(chan os.Signal, 1)

	go func() {
		signal.Notify(c, os.Interrupt)
		<-c
		log.Println("...Closing")
		signal.Stop(c)
		close(c)
		srv.Close()
	}()

	log.Println("Running...")
	err := srv.ListenAndServe()

	e(SaveConfig(configFile), "error saving config")

	if err != http.ErrServerClosed {
		e(err, "fatal error")
	}
}
