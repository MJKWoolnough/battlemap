package main

import (
	"bytes"
	"context"
	"crypto/rand"
	"encoding/base64"
	"flag"
	"fmt"
	"net"
	"net/http"
	"os"
	"os/signal"
	"path/filepath"
	"time"

	"vimagination.zapto.org/battlemap"
	"vimagination.zapto.org/memio"
	"vimagination.zapto.org/sessions"
)

var unauthorised = []byte(`<html>
	<head>
		<title>Unauthorised</title>
	</head>
	<body>
		<h1>Not Authorised</h1>
	</body>
`)

type Auth struct {
	username    string
	password    string
	store       *sessions.CookieStore
	sessionData memio.Buffer
}

func NewAuth(username, password string, sessionKey []byte) (*Auth, error) {
	store, err := sessions.NewCookieStore(sessionKey, sessions.HTTPOnly(), sessions.Path("/"), sessions.Name("battlemap"), sessions.Expiry(time.Hour*24*30))
	if err != nil {
		return nil, fmt.Errorf("error starting Cookie Store: %w", err)
	}
	sessionData := make(memio.Buffer, 32)
	rand.Read(sessionData)
	return &Auth{
		username:    username,
		password:    password,
		store:       store,
		sessionData: sessionData,
	}, nil
}

func (a *Auth) Auth(r *http.Request) *http.Request { return r }

func (a *Auth) IsAdmin(r *http.Request) bool {
	rData := a.store.Get(r)
	isAdmin := bytes.Equal(rData, a.sessionData)
	return isAdmin
}

func (a *Auth) IsUser(r *http.Request) bool {
	return !a.IsAdmin(r)
}

func (a *Auth) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	switch r.URL.Path {
	case "logout":
		a.store.Set(w, nil)
	case "login":
		username, password, _ := r.BasicAuth()
		ok := username == a.username && password == a.password
		if !ok {
			w.Header().Set("WWW-Authenticate", "Basic realm=\"Enter Credentials\"")
			w.WriteHeader(http.StatusUnauthorized)
			w.Write(unauthorised)
			return
		}
		a.store.Set(w, a.sessionData)
	default:
		http.NotFound(w, r)
		return
	}
	http.Redirect(w, r, "../", http.StatusFound)
}

func main() {
	if err := run(); err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
}

func run() error {
	defaultDir, err := os.UserConfigDir()
	if err != nil {
		return fmt.Errorf("error getting user config dir: %w", err)
	}
	username := flag.String("user", "", "Username")
	password := flag.String("pass", "", "Password")
	p := flag.String("path", filepath.Join(defaultDir, "battlemap"), "Data Path")
	port := flag.Int("port", 8080, "Web Port")
	key := flag.String("key", "MDEyMzQ1Njc4OUFCQ0RFRg==", "Encryption Key (Base64: 16, 24, or 32 bytes)")
	flag.Parse()
	encKey, err := base64.StdEncoding.DecodeString(*key)
	if err != nil {
		return fmt.Errorf("error decoding encryption key: %w", err)
	}
	auth, err := NewAuth(*username, *password, encKey)
	if err != nil {
		return err
	}
	b, err := battlemap.New(*p, auth)
	if err != nil {
		return fmt.Errorf("error creating Battlemap: %w", err)
	}
	l, err := net.ListenTCP("tcp", &net.TCPAddr{Port: *port})
	if err != nil {
		return fmt.Errorf("error opening port: %w", err)
	}
	server := http.Server{Handler: b}
	go server.Serve(l)
	sc := make(chan os.Signal, 1)
	signal.Notify(sc, os.Interrupt)
	<-sc
	signal.Stop(sc)
	close(sc)
	return server.Shutdown(context.Background())
}
