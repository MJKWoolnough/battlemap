package battlemap

import (
	"bytes"
	"crypto/rand"
	"fmt"
	"io"
	"net/http"
	"time"

	"golang.org/x/net/websocket"
	"vimagination.zapto.org/memio"
	"vimagination.zapto.org/sessions"
)

// Auth allows for specifying a custom authorisation module
type Auth interface {
	http.Handler
	Auth(*http.Request) *http.Request
	IsAdmin(*http.Request) bool
	IsUser(*http.Request) bool
}

type userState uint8

const (
	userStateNone userState = iota
	userStateUser
	userStateAdmin
)

func (u userState) IsAdmin() bool {
	return u == userStateAdmin
}

func (u userState) IsUser() bool {
	return u == userStateUser
}

type auth struct {
	*Battlemap
	store       *sessions.CookieStore
	sessionData memio.Buffer
}

func (a *auth) Init(b *Battlemap) error {
	var save bool
	sessionKey := make(memio.Buffer, 0, 16)
	b.config.Get("sessionKey", &sessionKey)
	if len(sessionKey) != 16 {
		sessionKey = sessionKey[:16]
		rand.Read(sessionKey)
		save = true
	}
	sessionData := make(memio.Buffer, 0, 32)
	b.config.Get("sessionData", &sessionData)
	if len(sessionData) < 16 {
		sessionData = sessionData[:32]
		rand.Read(sessionData)
		save = true
	}
	var err error
	a.store, err = sessions.NewCookieStore(sessionKey, sessions.HTTPOnly(), sessions.Path("/"), sessions.Name("admin"), sessions.Expiry(time.Hour*24*30))
	if err != nil {
		return fmt.Errorf("error creating Cookie Store: %w", err)
	}
	a.sessionData = sessionData
	if save {
		if err = b.config.SetAll(map[string]io.WriterTo{
			"sessionKey":  &sessionKey,
			"sessionData": &sessionData,
		}); err != nil {
			return fmt.Errorf("error setting auth config: %w", err)
		}
	}
	a.Battlemap = b
	return nil
}

func (a *auth) IsAdmin(r *http.Request) bool {
	rData := a.store.Get(r)
	isAdmin := bytes.Equal(rData, a.sessionData)
	return isAdmin
}

func (a *auth) IsUser(r *http.Request) bool {
	return !a.IsAdmin(r)
}

func (a *auth) Auth(r *http.Request) *http.Request { return r }

func (a *auth) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	switch r.URL.Path {
	case "logout":
		a.store.Set(w, nil)
	case "login":
		a.store.Set(w, a.sessionData)
	default:
		http.NotFound(w, r)
		return
	}
	http.Redirect(w, r, "../", http.StatusFound)
}

var (
	loggedOut     = []byte("{\"id\": -1, \"result\": 0}")
	loggedInUser  = []byte("{\"id\": -1, \"result\": 1}")
	loggedInAdmin = []byte("{\"id\": -1, \"result\": 2}")
)

func (b *Battlemap) authConn(w *websocket.Conn) userState {
	r := w.Request()
	if b.auth.IsAdmin(r) {
		w.Write(loggedInAdmin)
		return userStateAdmin
	} else if b.auth.IsUser(r) {
		w.Write(loggedInUser)
		return userStateUser
	}
	w.Write(loggedOut)
	return userStateNone
}
