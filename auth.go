package main

import (
	"bytes"
	"crypto/rand"
	"crypto/sha256"
	"hash"
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
		Config.Save(configFile)
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

func (a *auth) Login(password []byte, w http.ResponseWriter) bool {
	Config.RLock()
	same := bytes.Equal(Config.Password, hashPass(password, Config.Salt))
	if same {
		a.store.Set(w, Config.SessionData)
	}
	Config.RUnlock()
	return same
}

func (a *auth) Logout(w http.ResponseWriter) {
	a.store.Set(w, nil)
}

func (a *auth) UpdatePassword(password []byte) {
	Config.Lock()
	Config.Password = hashPass(password, Config.Salt)
	rand.Read(Config.SessionData)
	Config.Unlock()
	Config.Save(configFile)
}

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
