package main

import (
	"database/sql"
	"fmt"

	_ "github.com/mattn/go-sqlite3"
	"vimagination.zapto.org/errors"
)

var DB db

type db struct {
	*sql.DB
}

func (db *db) Init(filename string) error {
	database, err := sql.Open("sqlite3", filename+"?cache=shared&mode=rwc")
	if err != nil {
		return errors.WithContext(fmt.Sprintf("error opening database file %q: ", filename), err)
	}
	database.SetMaxOpenConns(1)
	if _, err = database.Exec("CREATE TABLE IF NOT EXISTS [Config]([Password] TEXT NOT NULL DEFAULT '', [Salt] TEXT NOT NULL DEFAULT '', [SessionKey] TEXT NOT NULL DEFAULT '', [SessionData] TEXT NOT NULL DEFAULT '');"); err != nil {
		return errors.WithContext("error creating config table: ", err)
	}
	var num int
	if err = database.QueryRow("SELECT COUNT(1) FROM [Config];").Scan(&num); err != nil {
		return errors.WithContext("error counting Config rows: ", err)
	} else if num == 0 {
		_, err = database.Exec("INSERT INTO [Config]([SessionData]) VALUES ('');")
		if err != nil {
			return errors.WithContext("error creating initial Config data: ", err)
		}
	}
	for name, init := range map[string]func(*sql.DB) error{
		"authentication": Auth.init,
		"session":        Session.init,
		"assets":         Assets.init,
		"maps":           Maps.init,
	} {
		if err = init(database); err != nil {
			database.Close()
			return errors.WithContext(fmt.Sprintf("error initialising %s: ", name), err)
		}
	}
	db.DB = database
	return nil
}
