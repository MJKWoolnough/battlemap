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

	e(Socket.Init(), "error initialising Socket module")
	http.Handle("/socket", websocket.Handler(Socket.ServeConn))

	e(Auth.Init(), "error initialising Auth module")
	http.HandleFunc("/login/update", Auth.UpdatePassword)
	http.HandleFunc("/login/logout", Auth.Logout)
	http.HandleFunc("/login/login", Auth.Login)

	Assets.Init()
	http.Handle("/assets/", http.StripPrefix("/assets/", &Assets))

	Chars.Init()
	http.Handle("/characters/", http.StripPrefix("/characters/", &Chars))

	Maps.Init()
	http.Handle("/maps/", http.StripPrefix("/maps/", &Maps))

	Files.Init()
	http.Handle("/files/", http.StripPrefix("/files/", &Files))

	http.Handle("/", httpgzip.FileServer(dir))

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
	err := http.ListenAndServe(fmt.Sprintf(":%d", port), nil)

	e(SaveConfig(configFile), "error saving config")

	if err != http.ErrServerClosed {
		e(err, "fatal error")
	}
}
