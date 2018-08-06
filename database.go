package main

import (
	"database/sql"
	"fmt"
	"sync"

	_ "github.com/mattn/go-sqlite3"
	"vimagination.zapto.org/errors"
)

var DB db

type db struct {
	sync.Mutex
	*sql.DB
}

func (db *db) Init(filename string) error {
	database, err := sql.Open("sqlite3", filename)
	if err != nil {
		return errors.WithContext(fmt.Sprintf("error opening database file %q: ", filename), err)
	}
	if _, err = database.Exec("CREATE TABLE IF NOT EXISTS [Config]([Password] TEXT, [SessionKey] TEXT, [SessionData] TEXT);"); err != nil {
		return errors.WithContext("error creating config table: ", err)
	}
	if err = Auth.Init(database); err != nil {
		database.Close()
		return errors.WithContext("error initialising authentication: ", err)
	}
	db.DB = database
	return nil
}

func (db *db) Close() error {
	return db.DB.Close()
}
