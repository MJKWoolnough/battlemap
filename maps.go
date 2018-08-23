package main

import (
	"database/sql"
	"fmt"
	"sort"

	"vimagination.zapto.org/errors"
)

var Maps maps

type maps struct {
	maps                                           map[int]*Map
	characters                                     map[int]*Character
	addMap, updateMapName, updateMapDim, removeMap *sql.Stmt
	setLightLayer, setLightLevel                   *sql.Stmt
}

type Character struct {
	ID            int
	Name          string
	Icon, Token   *int
	Width, Height int
	Data          string
}

type Map struct {
	ID            int
	Name          string
	Width, Height int
	Layers        []Layer
	Order         int
	Stmts         MapStmts
}

type MapList []*Map

func (m MapList) Len() int {
	return len(m)
}

func (m MapList) Less(i, j int) bool {
	return m[i].Order < m[j].Order
}

func (m MapList) Swap(i, j int) {
	m[i], m[j] = m[j], m[i]
}

type Token struct {
	ID                        int
	Asset                     int
	X, Y, Width, Height       int
	Angle                     int
	RepeatWidth, RepeatHeight int
	LightLevel                int
	Layer                     int
	Data                      string
}

type Layer struct {
	ID             int
	Name           string
	Order          int
	Hidden, Locked bool
	UseMask        bool
	Tokens         map[int]*Token
}

type MapStmts struct {
	addToken, moveTokenPos, moveTokenLayer, resizeToken, rotateToken, removeToken *sql.Stmt

	addLayer, renameLayer, swapLayerOrder, hideLayer, showLayer, lockLayer, unlockLayer, removeLayer *sql.Stmt

	layerLightBlock, layerLightAllow, tokenLightLevel *sql.Stmt

	removeAllTokens, removeAllLayers *sql.Stmt

	removeTables *sql.Stmt
}

type di interface {
	Exec(string, ...interface{}) (sql.Result, error)
	Prepare(string) (*sql.Stmt, error)
	QueryRow(string, ...interface{}) *sql.Row
}

func NewMapStmts(db di, table int) (MapStmts, error) {
	var (
		err error
		m   MapStmts
	)
	if _, err = db.Exec(fmt.Sprintf("CREATE TABLE IF NOT EXISTS [MapTokens_%d]([ID] INTEGER PRIMARY KEY, [Asset] INTEGER, [Width] INTEGER, [Height] INTEGER, [X] INTGER NOT NULL DEFAULT 0, [Y] INTEGER NOT NULL DEFAULT 0, [Angle] INTEGER NOT NULL DEFAULT 0, [RepeatWidth] INTEGER NOT NULL DEFAULT 0, [RepeatHeight] INTEGER NOT NULL DEFAULT 0, [Layer] INTEGER NOT NULL DEFAULT 0, [LightLevel] INTEGER NOT NULL DEFAULT 0, [Data] TEXT NOT NULL DEFAULT '{}');", table)); err != nil {
		return m, errors.WithContext("error creating MapTokens table: ", err)
	}
	if _, err = db.Exec(fmt.Sprintf("CREATE TABLE IF NOT EXISTS [MapLayers_%d]([ID] INTEGER PRIMARY KEY, [Name] TEXT NOT NULL DEFAULT '', [Locked] BOOLEAN NOT NULL DEFAULT 0 ([Locked] IN (0, 1)), [Hidden] BOOLEAN NOT NULL DEFAULT 0 CHECK([Hidden] IN (0, 1)), [Mask] BOOLEAN NOT NULL DEFAULT 0 CHECK([Mask] IN (0, 1)), [LightBlock] BOOLEAN NOT NULL DEFAULT 0 CHECK([LightBlock] IN (0, 1)), [Order] INTEGER);", table)); err != nil {
		return m, errors.WithContext("error creating MapLayers table: ", err)
	}
	var numRows int
	if err = db.QueryRow(fmt.Sprintf("SELECT COUNT(1) FROM [MapLayers_%d];", table)).Scan(&numRows); err != nil {
		return m, errors.WithContext("error counting MapLayers rows: ", err)
	} else if numRows == 0 {
		db.Exec(fmt.Sprintf("INSERT INTO [MapLayers_%d] ([Name], [Order]) VALUES ('Background', 0), ('Grid', 1), ('Foreground', 2);"))
	}
	for stmt, code := range map[**sql.Stmt]string{
		&m.addToken:       "INSERT INTO [MapTokens_%d]([Token], [Width], [Height], [X], [Y], [Layer]) VALUES (?, ?, ?, ?, ?, ?);",
		&m.moveTokenPos:   "UPDATE [MapTokens_%d] SET [X] = ?, [Y] = ? WHERE [ID] = ?;",
		&m.moveTokenLayer: "UPDATE [MapTokens_%d] SET [Layer] = ? WHERE [ID] = ?;",
		&m.resizeToken:    "UPDATE [MapTokens_%d] SET [Width] = ?, [Height] = ? WHERE [ID] = ?;",
		&m.rotateToken:    "UPDATE [MapTokens_%d] SET [Angle] = ? WHERE [ID] = ?;",
		&m.removeToken:    "DELETE FROM [MapTokens_%d] WHERE [ID] = ?;",

		&m.addLayer:    "INSERT INTO [MapLayers_%d]([Name], [Order]) VALUES (?, MAX([Order] + 1);",
		&m.renameLayer: "UPDATE [MapLayers_%d] SET [Name] = ? WHERE [ID] = ?;",
		&m.swapLayerOrder: "UPDATE [MapLayers_%[0]d] SET [Order] = CASE [ID] " +
			"	WHEN ?1 THEN (SELECT [Order] FROM [MapLayers_%[0]d] WHERE [ID] = ?2) " +
			"	WHEN ?2 THEN (SELECT [Order] FROM [MapLayers_%[0]d] WHERE [ID] = ?1)" +
			"END " +
			"WHERE [ID] IN (?1, ?2);", // TODO:Needs checking
		&m.hideLayer:   "UPDATE [MapLayers_%d] SET [Hidden] = 1 WHERE [ID] = ?;",
		&m.showLayer:   "UPDATE [MapLayers_%d] SET [Hidden] = 0 WHERE [ID] = ?;",
		&m.lockLayer:   "UPDATE [MapLayers_%d] SET [Locked] = 1 WHERE [ID] = ?;",
		&m.unlockLayer: "UPDATE [MapLayers_%d] SET [Locked] = 0 WHERE [ID] = ?;",
		&m.removeLayer: "DELETE FROM [MapLayers_%d] WHERE [ID] = ?;",

		&m.layerLightBlock: "UPDATE [MapLayers_%d] SET [LightBlock] = 1 WHERE [ID] = ?;",
		&m.layerLightAllow: "UPDATE [MapLayers_%d] SET [LightBlock] = 0 WHERE [ID] = ?;",
		&m.tokenLightLevel: "UPDATE [MapTokens_%d] SET [LightLevel] = ? WHERE [ID] = ?;",

		&m.removeAllTokens: "DELETE FROM [MapTokens_%d];",
		&m.removeAllLayers: "DELETE FROM [MapLayers_%d] WHERE [ID] > 2;",

		&m.removeTables: "DROP TABLE [MapTokens_%d]; DROP TABLE [MapLayers_%d]",
	} {
		if *stmt, err = db.Prepare(fmt.Sprintf(code, table)); err != nil {
			return m, errors.WithContext(fmt.Sprintf("error creating prepared statement for %s: ", table), err)
		}
	}
	return m, nil
}

func (m *maps) init(db *sql.DB) error {
	var err error
	if _, err = db.Exec("CREATE TABLE IF NOT EXISTS [Maps]([ID] INTEGER PRIMARY KEY, [Name] TEXT NOT NULL DEFAULT '', [Width] INTEGER NOT NULL DEFAULT 0, [Height] INTEGER NOT NULL DEFAULT 0, [LightLayer] INTEGER NOT NULL DEFAULT 0, [LightLevel] INTEGER NOT NULL DEFAULT 0, [Order] INTEGER NOT NULL DEFAULT [ID]);"); err != nil {
		return errors.WithContext("error creating Maps table: ", err)
	}
	if _, err = db.Exec("CREATE TABLE IF NOT EXISTS [Characters]([ID] INTEGER PRIMARY KEY, [Name] TEXT NOT NULL DEFAULT '', [Icon] INTEGER, [Asset] INTEGER, [Width] INTEGER NOT NULL DEFAULT 0, [HEIGHT] INTEGER NOT NULL DEFAULT 0, [Data] TEXT NOT NULL DEFAULT '{}');"); err != nil {
		return errors.WithContext("error creating Characters table: ", err)
	}
	for stmt, code := range map[**sql.Stmt]string{
		&m.addMap:        "INSERT INTO [Maps]([Name], [Width], [Height]) VALUES (?, ?, ?);",
		&m.updateMapName: "UPDATE [Maps] SET [Name] = ? WHERE [ID] = ?;",
		&m.updateMapDim:  "UPDATE [Maps] SET [Width] = ?, [Height] = ? WHERE [ID] = ?;",
		&m.removeMap:     "DELETE FROM [Maps] WHERE [ID] = ?;",

		&m.setLightLayer: "UPDATE [Maps] SET [LightLayer] = ? WHERE [ID] = ?;",
		&m.setLightLevel: "UPDATE [Maps] SET [LightLevel] = ? WHERE [ID] = ?;",
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
		ms.Stmts, err = NewMapStmts(db, ms.ID)
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

func (m *maps) ListMaps(_ struct{}, ms *MapList) error {
	for _, mp := range m.maps {
		*ms = append(*ms, mp)
	}
	sort.Sort(ms)
	return nil
}
