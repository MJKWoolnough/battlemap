package main

import (
	"bytes"
	"crypto/rand"
	"database/sql"
	"net/http"
	"sync"
	"time"

	"vimagination.zapto.org/errors"
	"vimagination.zapto.org/sessions"
)

var Session session

type session struct {
	store      *sessions.CookieStore
	updateData *sql.Stmt

	mu   sync.RWMutex
	data []byte
}

func (s *session) init(db *sql.DB) error {
	var key []byte
	err := db.QueryRow("SELECT [SessionKey], [SessionData] FROM [Config];").Scan(&key, &s.data)
	if err != nil {
		return errors.WithContext("error getting session data: ", err)
	}
	s.updateData, err = db.Prepare("UPDATE [Config] SET [SessionKey] = ?, [SessionData] = ?;")
	if err != nil {
		return errors.WithContext("error preparing session data update statement: ", err)
	}
	return s.Set(key)
}

func (s *session) Set(key []byte) error {
	if len(key) != 16 {
		key = make([]byte, 16)
		rand.Read(key)
	}
	if len(s.data) < 16 {
		s.data = make([]byte, 32)
		rand.Read(s.data)
	}
	DB.Lock()
	_, err := s.updateData.Exec(key, s.data)
	if err != nil {
		return errors.WithContext("error saving new session data: ", err)
	}
	DB.Unlock()
	s.store, err = sessions.NewCookieStore(key, sessions.HTTPOnly(), sessions.Name("admin"), sessions.Expiry(time.Hour*24*30))
	return err
}

func (s *session) Refresh() {
	s.mu.Lock()
	s.data = nil
	s.Set(nil)
	s.mu.Unlock()
}

func (s *session) SetAdmin(w http.ResponseWriter) {
	s.mu.RLock()
	s.store.Set(w, s.data)
	s.mu.RUnlock()
}

func (s *session) GetAdmin(r *http.Request) bool {
	return bytes.Equal(s.store.Get(r), s.data)
}
