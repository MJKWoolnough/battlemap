package main

import (
	"database/sql"
	"net/http"
)

var Auth auth

type auth struct {
}

func (a *auth) Init(db *sql.DB) error {
	return nil
}

type authServeMux struct {
	http.ServeMux
}

func (a *authServeMux) ServeHTTP(w http.ResponseWriter, r *http.Request) {

}
