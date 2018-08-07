package main

import (
	"database/sql"
	"net/http"
)

var Assets assets

type assets struct {
}

func (a *assets) Init(database *sql.DB) error {
	return nil
}

func (a *assets) ServeHTTP(w http.ResponseWriter, r *http.Request) {

}
