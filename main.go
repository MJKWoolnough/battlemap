package main

import (
	"flag"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/signal"

	"golang.org/x/net/websocket"
	"vimagination.zapto.org/httpdir"
	"vimagination.zapto.org/httpgzip"
	"vimagination.zapto.org/keystore"
)

var dir http.FileSystem = httpdir.Default

func e(err error, reason string) {
	if err != nil {
		fmt.Fprintf(os.Stderr, "%s: %s\n", reason, err)
		os.Exit(1)
	}
}

var dataDir = flag.String("data", "./data", "directory containing all battlemap data")

func main() {
	flag.Parse()
	e(Config.Init(*dataDir), "error loading config")

	var port keystore.Uint16
	Config.Get("port", &port)

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

	e(AssetsDir.Init(), "error initialising Assets module")
	mux.Handle("/assets/", http.StripPrefix("/assets/", Dir{&AssetsDir}))

	e(TokensDir.Init(), "error initialising Tokens module")
	mux.Handle("/tokens/", http.StripPrefix("/tokens", Dir{&TokensDir}))

	e(CharsDir.Init(), "error initialising Characters module")
	mux.Handle("/characters/", http.StripPrefix("/characters/", Dir{&CharsDir}))

	e(MapsDir.Init(), "error initialising Maps module")
	mux.Handle("/maps/", http.StripPrefix("/maps/", Dir{&MapsDir}))

	e(MasksDir.Init(), "error initialising Masks module")
	mux.Handle("/masks/", http.StripPrefix("/masks/", Dir{&MasksDir}))

	e(FilesDir.Init(), "error initialising Files module")
	mux.Handle("/files/", http.StripPrefix("/files/", Dir{&FilesDir}))

	e(PluginsDir.Init(), "error initialising plugins")
	mux.Handle("/plugins/", http.StripPrefix("/plugins/", Dir{&PluginsDir}))

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
	e(srv.ListenAndServe(), "fatal error")
}
