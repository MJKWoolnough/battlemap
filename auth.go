package main

import (
	"bytes"
	"crypto/rand"
	"crypto/sha256"
	"hash"
	"io"
	"net/http"
	"sync"
	"time"

	"vimagination.zapto.org/errors"
	"vimagination.zapto.org/sessions"
)

type auth struct {
	store *sessions.CookieStore
}

func (a *auth) Init() error {
	var save bool
	Config.Lock()
	if len(Config.Salt) == 0 {
		Config.Salt = make([]byte, 16)
		rand.Read(Config.Salt)
		Config.Password = hashPass(nil, Config.Salt)
		save = true
	} else if len(Config.Password) == 0 {
		Config.Password = hashPass(nil, Config.Salt)
	}
	if len(Config.SessionKey) != 16 {
		Config.SessionKey = make([]byte, 16)
		rand.Read(Config.SessionKey)
		save = true
	}
	if len(Config.SessionData) < 16 {
		Config.SessionData = make([]byte, 32)
		rand.Read(Config.SessionData)
		save = true
	}
	var err error
	a.store, err = sessions.NewCookieStore(Config.SessionKey, sessions.HTTPOnly(), sessions.Name("admin"), sessions.Expiry(time.Hour*24*30))
	Config.Unlock()
	if err != nil {
		return errors.WithContext("error creating Cookie Store: ", err)
	}
	if save {
		SaveConfig(configFile)
	}
	return nil
}

func (a *auth) IsAdmin(r *http.Request) bool {
	rData := a.store.Get(r)
	Config.RLock()
	isAdmin := bytes.Equal(rData, Config.SessionData)
	Config.RUnlock()
	return isAdmin
}

func (a *auth) Logout(w http.ResponseWriter, r *http.Request) {
	a.store.Set(w, nil)
	http.Redirect(w, r, "/", http.StatusSeeOther)
}

func (a *auth) UpdatePassword(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		w.WriteHeader(http.StatusMethodNotAllowed)
		return
	}
	if !a.IsAdmin(r) {
		w.WriteHeader(http.StatusUnauthorized)
		return
	}
	r.ParseForm()
	password := r.PostFormValue(passwordField)
	confirm := r.PostFormValue("confirmPassword")
	if password != confirm {
		w.WriteHeader(http.StatusBadRequest)
		return
	}
	a.store.Set(w, a.updatePassword(password))
	if r.Header.Get(contentType) == jsonType {
		w.Header().Set(contentType, jsonType)
		io.WriteString(w, "{\"updated\": true}")
		return
	}
	http.Redirect(w, r, "/", http.StatusSeeOther)
}

func (a *auth) updatePassword(newPassword string) []byte {
	Config.Lock()
	Config.Password = hashPass([]byte(newPassword), Config.Salt)
	rand.Read(Config.SessionData)
	data := Config.SessionData
	Config.Unlock()
	SaveConfig(configFile)
	Socket.KickAdmins()
	return data
}

func (a *auth) Login(w http.ResponseWriter, r *http.Request) {
	r.ParseForm()
	var password string
	if _, ok := r.PostForm[passwordField]; ok {
		password = r.PostFormValue(passwordField)
	} else {
		_, password, _ = r.BasicAuth()
	}
	if sessionData := a.login(password); len(sessionData) > 0 {
		a.store.Set(w, sessionData)
		if r.Header.Get(contentType) == jsonType {
			w.Header().Set(contentType, jsonType)
			io.WriteString(w, "{\"admin\": true}")
			return
		}
		http.Redirect(w, r, "/", http.StatusSeeOther)
		return
	}
	w.Header().Set("WWW-Authenticate", "Basic realm=\"Battlemap\"")
	w.WriteHeader(http.StatusUnauthorized)
}

func (a *auth) login(password string) []byte {
	var toRet []byte
	Config.RLock()
	if bytes.Equal(Config.Password, hashPass([]byte(password), Config.Salt)) {
		toRet = Config.SessionData
	}
	Config.RUnlock()
	return toRet
}

func (a *auth) LoginGetData(password string) string {
	sessionData := a.login(password)
	if len(sessionData) == 0 {
		return ""
	}
	pw := make([]string, 0, 1)
	a.store.Set(psuedoHeaders{"Set-Cookie": pw}, sessionData)
	return pw[0]
}

type psuedoHeaders http.Header

func (psuedoHeaders) Write([]byte) (int, error) { return 0, nil }
func (psuedoHeaders) WriteHeader(int)           {}
func (p psuedoHeaders) Header() http.Header     { return http.Header(p) }

var Auth auth

var hashPool = sync.Pool{
	New: func() interface{} {
		return sha256.New()
	},
}

func hashPass(password, salt []byte) []byte {
	h := hashPool.Get().(hash.Hash)
	h.Write(password)
	h.Write(salt)
	res := h.Sum(make([]byte, 0, sha256.Size))
	h.Reset()
	hashPool.Put(h)
	return res
}

const (
	passwordField = "password"
	contentType   = "Content-Type"
	jsonType      = "application/json"
)
