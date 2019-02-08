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

var dataDir = flag.String("data", "./data", "directory containing all battlemap data")

func main() {
	flag.Parse()
	if err := Config.Init(*dataDir); err != nil {
		fmt.Fprintf(os.Stderr, "error loading Config: %s\n", err)
		os.Exit(1)
	}

	var port keystore.Uint16
	Config.Get("port", &port)

	mux := http.NewServeMux()
	srv := http.Server{
		Addr:    fmt.Sprintf(":%d", port),
		Handler: mux,
	}

	for module, init := range map[string]interface{ Init() error }{
		"Socket":  &Socket,
		"Auth":    &Auth,
		"Assets":  &AssetsDir,
		"Tokens":  &TokensDir,
		"Chars":   &CharsDir,
		"Maps":    &MapsDir,
		"Masks":   &MasksDir,
		"Files":   &FilesDir,
		"Plugins": &PluginsDir,
	} {
		if err := init.Init(); err != nil {
			fmt.Fprintf(os.Stderr, "error initialising %s module: %s\n", module, err)
			os.Exit(1)
		}
	}

	mux.Handle("/socket", websocket.Handler(Socket.ServeConn))
	mux.HandleFunc("/login/update", Auth.UpdatePassword)
	mux.HandleFunc("/login/logout", Auth.Logout)
	mux.HandleFunc("/login/login", Auth.Login)
	mux.Handle("/assets/", http.StripPrefix("/assets/", Dir{&AssetsDir}))
	mux.Handle("/tokens/", http.StripPrefix("/tokens", Dir{&TokensDir}))
	mux.Handle("/characters/", http.StripPrefix("/characters/", Dir{&CharsDir}))
	mux.Handle("/maps/", http.StripPrefix("/maps/", Dir{&MapsDir}))
	mux.Handle("/masks/", http.StripPrefix("/masks/", Dir{&MasksDir}))
	mux.Handle("/files/", http.StripPrefix("/files/", Dir{&FilesDir}))
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
	if err := srv.ListenAndServe(); err != nil {
		fmt.Fprintf(os.Stderr, "fatal error: %s\n", err)
		os.Exit(1)
	}
}
