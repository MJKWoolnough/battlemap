package main

import (
	"bytes"
	"database/sql"
	"net/http"
	"time"

	"vimagination.zapto.org/errors"
	"vimagination.zapto.org/sessions"
)

var Session session

type session struct {
	store *sessions.CookieStore
	data  []byte
}

func (s *session) Init(db *sql.DB) error {
	var key, data []byte
	err := db.QueryRow("SELECT [Key], [Data] FROM [Config];").Scan(&key, &data)
	if err != nil {
		return errors.WithContext("error getting session data: ", err)
	}
	s.store, err = sessions.NewCookieStore(key, sessions.HTTPOnly(), sessions.Name("admin"), sessions.Expiry(time.Hour*24*30))
	s.data = data
	return err
}

func (s *session) SetAdmin(w http.ResponseWriter) {
	s.store.Set(w, s.data)
}

func (s *session) GetAdmin(r *http.Request) bool {
	return bytes.Equal(s.store.Get(r), s.data)
}
