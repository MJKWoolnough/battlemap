package main

import (
	"database/sql"
	"fmt"

	"vimagination.zapto.org/errors"
)

var Maps maps

type maps struct {
	maps                                           map[int]*Map
	addMap, updateMapName, updateMapDim, removeMap *sql.Stmt
}

type Map struct {
	ID            int
	Name          string
	Width, Height int
	Stmts         MapStmts
}

type MapStmts struct {
	addToken, moveTokenPos, moveTokenLayer, resizeToken, removeToken *sql.Stmt
}

type prepare interface {
	Prepare(string) (*sql.Stmt, error)
}

func NewMapStmts(p prepare, table string) (MapStmts, error) {
	var err error
	var m MapStmts
	for stmt, code := range map[**sql.Stmt]string{
		&m.addToken:       "INSERT INTO [%s]([Token], [Width], [Height], [X], [Y], [Layer]) VALUES (?, ?, ?, ?, ?, ?);",
		&m.moveTokenPos:   "UPDATE [%s] SET [X] = ?, [Y] = ? WHERE [ID] = ?;",
		&m.moveTokenLayer: "UPDATE [%s] SET [Layer] = ? WHERE [ID] = ?;",
		&m.resizeToken:    "UPDATE [%s] SET [Width] = ?, [Height] = ? WHERE [ID] = ?;",
		&m.removeToken:    "DELETE FROM [%s] WHERE [ID] = ?;",
	} {
		if *stmt, err = p.Prepare(fmt.Sprintf(code, table)); err != nil {
			return m, errors.WithContext(fmt.Sprintf("error creating prepared statement for %s: ", table), err)
		}
	}
	return m, nil
}

func (m *maps) init(db *sql.DB) error {
	var err error
	if _, err = db.Exec("CREATE TABLE IF NOT EXISTS [Maps]([ID] INTEGER PRIMARY KEY AUTOINCREMENT, [Name] TEXT NOT NULL DEFAULT '', [Width] INTEGER NOT NULL DEFAULT 0, [Height] INTEGER NOT NULL DEFAULT 0);"); err != nil {
		return errors.WithContext("error creating Maps table: ", err)
	}
	for stmt, code := range map[**sql.Stmt]string{
		&m.addMap:        "INSERT INTO [Maps]([Name], [Width], [Height]) VALUES (?, ?, ?);",
		&m.updateMapName: "UPDATE [Maps] SET [Name] = ? WHERE [ID] = ?;",
		&m.updateMapDim:  "UPDATE [Maps] SET [Width] = ?, [Height] = ? WHERE [ID] = ?;",
		&m.removeMap:     "DELETE FROM [Maps] WHERE [ID] = ?;",
	} {
		if *stmt, err = db.Prepare(code); err != nil {
			return errors.WithContext("error preparing Map statement: ", err)
		}
	}

	rows, err := db.Query("SELECT [ID], [Name], [Width], [Height] FROM [Maps];")
	if err != nil {
		return errors.WithContext("error getting Maps data: ", err)
	}
	m.maps = make(map[int]*Map)
	for rows.Next() {
		ms := new(Map)
		if err = rows.Scan(&ms.ID, &ms.Name, &ms.Width, &ms.Height); err != nil {
			return errors.WithContext("error loading Map data: ", err)
		}
		ms.Stmts, err = NewMapStmts(db, ms.Name)
		if err != nil {
			return errors.WithContext("error creating Map statements: ", err)
		}
		m.maps[ms.ID] = ms
	}
	if err = rows.Close(); err != nil {
		return errors.WithContext("error closing Maps data: ", err)
	}
	return nil
}

func (m *maps) Temp(a int64, b *int64) error {
	return nil
}
