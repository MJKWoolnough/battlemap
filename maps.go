package main

import (
	"database/sql"
	"fmt"
	"os"

	"vimagination.zapto.org/errors"
)

var Maps maps

type maps struct {
	maps                                           map[int]*Map
	characters                                     map[int]*Character
	currentAdminMap, currentUserMap                int
	addMap, updateMapName, updateMapDim, removeMap *sql.Stmt
	setLightLayer, setLightLevel                   *sql.Stmt
	setCurrentAdminMap, setCurrentUserMap          *sql.Stmt
	swapMapOrder                                   *sql.Stmt
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
	Stmts         MapStmts `json:"-"`
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
	BlockLight     bool
	Tokens         map[int]*Token
}

type MapStmts struct {
	addToken, moveTokenPos, moveTokenLayer, resizeToken, rotateToken, removeToken *sql.Stmt

	addLayer, getLayerOrder, renameLayer, swapLayerOrder, hideLayer, showLayer, lockLayer, unlockLayer, removeLayer *sql.Stmt

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
	if _, err = db.Exec(fmt.Sprintf("CREATE TABLE IF NOT EXISTS [MapLayers_%d]([ID] INTEGER PRIMARY KEY, [Name] TEXT NOT NULL DEFAULT '', [Locked] BOOLEAN NOT NULL DEFAULT 0 CHECK([Locked] IN (0, 1)), [Hidden] BOOLEAN NOT NULL DEFAULT 0 CHECK([Hidden] IN (0, 1)), [Mask] BOOLEAN NOT NULL DEFAULT 0 CHECK([Mask] IN (0, 1)), [LightBlock] BOOLEAN NOT NULL DEFAULT 0 CHECK([LightBlock] IN (0, 1)), [Order] INTEGER);", table)); err != nil {
		return m, errors.WithContext("error creating MapLayers table: ", err)
	}
	var numRows int
	if err = db.QueryRow(fmt.Sprintf("SELECT COUNT(1) FROM [MapLayers_%d];", table)).Scan(&numRows); err != nil {
		return m, errors.WithContext("error counting MapLayers rows: ", err)
	} else if numRows == 0 {
		db.Exec(fmt.Sprintf("INSERT INTO [MapLayers_%d] ([Name], [Order]) VALUES ('Background', 0), ('Grid', 1), ('Foreground', 2);", table))
	}
	for stmt, code := range map[**sql.Stmt]string{
		&m.addToken:       "INSERT INTO [MapTokens_%d]([Asset], [Width], [Height], [X], [Y], [Layer]) VALUES (?, ?, ?, ?, ?, ?);",
		&m.moveTokenPos:   "UPDATE [MapTokens_%d] SET [X] = ?, [Y] = ? WHERE [ID] = ?;",
		&m.moveTokenLayer: "UPDATE [MapTokens_%d] SET [Layer] = ? WHERE [ID] = ?;",
		&m.resizeToken:    "UPDATE [MapTokens_%d] SET [Width] = ?, [Height] = ? WHERE [ID] = ?;",
		&m.rotateToken:    "UPDATE [MapTokens_%d] SET [Angle] = ? WHERE [ID] = ?;",
		&m.removeToken:    "DELETE FROM [MapTokens_%d] WHERE [ID] = ?;",

		&m.addLayer:      "INSERT INTO [MapLayers_%[1]d]([Name], [Order]) VALUES (?, (SELECT COALESCE(MAX([Order]), 0) FROM [MapLayers_%[1]d]) + 1);",
		&m.getLayerOrder: "SELECT [Order] FROM [MapLayers_%d] WHERE [ID] = ?;",
		&m.renameLayer:   "UPDATE [MapLayers_%d] SET [Name] = ? WHERE [ID] = ?;",
		&m.swapLayerOrder: "UPDATE [MapLayers_%[1]d] SET [Order] = CASE [ID] " +
			"	WHEN ?1 THEN (SELECT [Order] FROM [MapLayers_%[1]d] WHERE [ID] = ?2) " +
			"	WHEN ?2 THEN (SELECT [Order] FROM [MapLayers_%[1]d] WHERE [ID] = ?1)" +
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
			fmt.Fprintf(os.Stderr, fmt.Sprintf(code, table))
			return m, errors.WithContext(fmt.Sprintf("error creating prepared statement for %d: ", table), err)
		}
	}
	return m, nil
}

func (m *maps) init(db *sql.DB) error {
	var err error
	if _, err = db.Exec("CREATE TABLE IF NOT EXISTS [Maps]([ID] INTEGER PRIMARY KEY, [Name] TEXT NOT NULL DEFAULT '', [Width] INTEGER NOT NULL DEFAULT 0, [Height] INTEGER NOT NULL DEFAULT 0, [LightLayer] INTEGER NOT NULL DEFAULT 0, [LightLevel] INTEGER NOT NULL DEFAULT 0, [Order] INTEGER NOT NULL DEFAULT 0);"); err != nil {
		return errors.WithContext("error creating Maps table: ", err)
	}
	if _, err = db.Exec("CREATE TABLE IF NOT EXISTS [Characters]([ID] INTEGER PRIMARY KEY, [Name] TEXT NOT NULL DEFAULT '', [Icon] INTEGER, [Asset] INTEGER, [Width] INTEGER NOT NULL DEFAULT 0, [HEIGHT] INTEGER NOT NULL DEFAULT 0, [Data] TEXT NOT NULL DEFAULT '{}');"); err != nil {
		return errors.WithContext("error creating Characters table: ", err)
	}
	for stmt, code := range map[**sql.Stmt]string{
		&m.addMap:        "INSERT INTO [Maps]([Name], [Width], [Height], [Order]) VALUES (?, ?, ?, (SELECT COALESCE(MAX([Order]), 0) FROM [Maps]) + 1);",
		&m.updateMapName: "UPDATE [Maps] SET [Name] = ? WHERE [ID] = ?;",
		&m.updateMapDim:  "UPDATE [Maps] SET [Width] = ?, [Height] = ? WHERE [ID] = ?;",
		&m.removeMap:     "DELETE FROM [Maps] WHERE [ID] = ?;",

		&m.setLightLayer: "UPDATE [Maps] SET [LightLayer] = ? WHERE [ID] = ?;",
		&m.setLightLevel: "UPDATE [Maps] SET [LightLevel] = ? WHERE [ID] = ?;",

		&m.setCurrentAdminMap: "UPDATE [Config] SET [CurrentAdminMap] = ?;",
		&m.setCurrentUserMap:  "UPDATE [Config] SET [CurrentUserMap] = ?;",

		&m.swapMapOrder: "UPDATE [Maps] SET [Order] = CASE [ID] " +
			"	WHEN ?1 THEN (SELECT [Order] FROM [Maps] WHERE [ID] = ?2) " +
			"	WHEN ?2 THEN (SELECT [Order] FROM [Maps] WHERE [ID] = ?1)" +
			"END " +
			"WHERE [ID] IN (?1, ?2);", // TODO:Needs checking
	} {
		if *stmt, err = db.Prepare(code); err != nil {
			return errors.WithContext("error preparing Map statement: ", err)
		}
	}

	if err = db.QueryRow("SELECT [CurrentAdminMap], [CurrentUserMap] FROM [Config];").Scan(&m.currentAdminMap, &m.currentUserMap); err != nil {
		return errors.WithContext("error getting current map values: ", err)
	}

	rows, err := db.Query("SELECT [ID], [Name], [Width], [Height], [Order] FROM [Maps];")
	if err != nil {
		return errors.WithContext("error getting Maps data: ", err)
	}
	m.maps = make(map[int]*Map)
	for rows.Next() {
		ms := new(Map)
		if err = rows.Scan(&ms.ID, &ms.Name, &ms.Width, &ms.Height, &ms.Order); err != nil {
			return errors.WithContext("error loading Map data: ", err)
		}
		ms.Layers = make([]Layer, 0)
		m.maps[ms.ID] = ms
	}
	if err = rows.Close(); err != nil {
		return errors.WithContext("error closing Maps data: ", err)
	}
	for _, ms := range m.maps {
		ms.Stmts, err = NewMapStmts(db, ms.ID)
		if err != nil {
			return errors.WithContext("error creating Map statements: ", err)
		}
		rows, err = db.Query(fmt.Sprintf("SELECT [ID], [Name], [Locked], [Hidden], [Mask], [LightBlock], [Order] FROM [MapLayers_%d] ORDER BY [Order] ASC;", ms.ID))
		if err != nil {
			return errors.WithContext("error read Map Layers: ", err)
		}
		for rows.Next() {
			var l Layer
			if err = rows.Scan(&l.ID, &l.Name, &l.Locked, &l.Hidden, &l.UseMask, &l.BlockLight, &l.Order); err != nil {
				return errors.WithContext("error loading Map Layer: ", err)
			}
			ms.Layers = append(ms.Layers, l)
		}
		if err = rows.Close(); err != nil {
			return errors.WithContext("error closing Map Layers: ", err)
		}
	}
	return nil
}

func (m *maps) ListMaps(_ struct{}, ms *[]*Map) error {
	for _, mp := range m.maps {
		*ms = append(*ms, mp)
	}
	return nil
}

func (m *maps) AddMap(nm Map, mp *Map) error {
	if nm.Width < 10 || nm.Height < 10 {
		return ErrInvalidDimensions
	}
	res, err := m.addMap.Exec(nm.Name, nm.Width, nm.Height)
	if err != nil {
		return errors.WithContext("error creating new map: ", err)
	}
	id, err := res.LastInsertId()
	if err != nil {
		return errors.WithContext("error getting new map ID: ", err)
	}
	nm.ID = int(id)
	nm.Stmts, err = NewMapStmts(&DB, nm.ID)
	nm.Order = nm.ID
	nm.Layers = make([]Layer, 0)
	if err != nil {
		return err
	}
	*mp = nm
	m.maps[nm.ID] = mp
	return nil
}

type Rename struct {
	ID   int
	Name string
}

func (m *maps) RenameMap(nm Rename, _ *struct{}) error {
	mp, ok := m.maps[nm.ID]
	if !ok {
		return ErrMapNotExist
	}
	if _, err := m.updateMapName.Exec(nm.Name, nm.ID); err != nil {
		return errors.WithContext("error updating map name: ", err)
	}
	mp.Name = nm.Name
	return nil
}

func (m *maps) RemoveMap(id int, _ *struct{}) error {
	if id == m.currentAdminMap {
		return ErrCurrentAdminMap
	} else if id == m.currentUserMap {
		return ErrCurrentUserMap
	}
	_, ok := m.maps[id]
	if !ok {
		return ErrMapNotExist
	}
	if _, err := m.removeMap.Exec(id); err != nil {
		return errors.WithContext("error removing map: ", err)
	}
	delete(m.maps, id)
	return nil
}

func (m *maps) CurrentAdminMap(_ struct{}, id *int) error {
	*id = m.currentAdminMap
	return nil
}

func (m *maps) CurrentUserMap(_ struct{}, id *int) error {
	*id = m.currentUserMap
	return nil
}

func (m *maps) SetCurrentAdminMap(id int, _ *struct{}) error {
	if _, ok := m.maps[id]; !ok {
		return ErrMapNotExist
	}
	if _, err := m.setCurrentAdminMap.Exec(id); err != nil {
		return errors.WithContext("error setting admin map: ", err)
	}
	m.currentAdminMap = id
	return nil
}

func (m *maps) SetCurrentUserMap(id int, _ *struct{}) error {
	if _, ok := m.maps[id]; !ok {
		return ErrMapNotExist
	}
	if _, err := m.setCurrentUserMap.Exec(id); err != nil {
		return errors.WithContext("error setting user map: ", err)
	}
	m.currentUserMap = id
	return nil
}

func (m *maps) SwapMapOrder(ids [2]int, orders *[2]int) error {
	mo, ok := m.maps[ids[0]]
	if !ok {
		return ErrMapNotExist
	}
	mt, ok := m.maps[ids[1]]
	if !ok {
		return ErrMapNotExist
	}
	if _, err := m.swapMapOrder.Exec(ids[0], ids[1]); err != nil {
		return errors.WithContext("error swapping map orders: ", err)
	}
	mo.Order, mt.Order = mt.Order, mo.Order
	orders[0] = mo.Order
	orders[1] = mt.Order
	return nil
}

func (m *maps) AlterMapSize(nm Map, _ *struct{}) error {
	if nm.Width < 10 || nm.Height < 10 {
		return ErrInvalidDimensions
	}
	mm, ok := m.maps[nm.ID]
	if !ok {
		return ErrMapNotExist
	}
	if _, err := m.updateMapDim.Exec(nm.Width, nm.Height, nm.ID); err != nil {
		return errors.WithContext("error updating map dimensions: ", err)
	}
	mm.Width = nm.Width
	nm.Height = nm.Height
	return nil
}

func (m *maps) GetLayers(id int, l *[]Layer) error {
	tm, ok := m.maps[id]
	if !ok {
		return ErrMapNotExist
	}
	*l = tm.Layers
	return nil
}

func (m *maps) SwapLayerOrder(s [2]int, positions *[2]int) error {
	if m.currentAdminMap < 0 {
		return ErrMapNotExist
	}
	mp, ok := m.maps[m.currentAdminMap]
	if !ok {
		return ErrMapNotExist
	}
	var lo, lt *Layer
	for n := range mp.Layers {
		if mp.Layers[n].ID == s[0] {
			lo = &mp.Layers[n]
		} else if mp.Layers[n].ID == s[1] {
			lt = &mp.Layers[n]
		}
	}
	if _, err := mp.Stmts.swapLayerOrder.Exec(s[0], s[1]); err != nil {
		return errors.WithContext("error swapping layers: ", err)
	}
	lo.Order, lt.Order = lt.Order, lo.Order
	return nil
}

func (m *maps) AddLayer(name string, layer *Layer) error {
	if m.currentAdminMap < 0 {
		return ErrMapNotExist
	}
	mp, ok := m.maps[m.currentAdminMap]
	if !ok {
		return ErrMapNotExist
	}
	res, err := mp.Stmts.addLayer.Exec(name)
	if err != nil {
		return errors.WithContext("error adding layer: ", err)
	}
	id, err := res.LastInsertId()
	if err != nil {
		return errors.WithContext("error getting layer ID: ", err)
	}
	var order int
	if err := mp.Stmts.getLayerOrder.QueryRow(id).Scan(&order); err != nil {
		return errors.WithContext("error getting layer order: ", err)
	}
	*layer = Layer{
		ID:     int(id),
		Name:   name,
		Order:  order,
		Tokens: make(map[int]*Token),
	}
	mp.Layers = append(mp.Layers, *layer)
	return nil
}

func (m *maps) RemoveLayer(id int, _ *struct{}) error {
	if m.currentAdminMap < 0 {
		return ErrMapNotExist
	}
	mp, ok := m.maps[m.currentAdminMap]
	if !ok {
		return ErrMapNotExist
	}
	for n, l := range mp.Layers {
		if l.ID == id {
			if _, err := mp.Stmts.removeLayer.Exec(id); err != nil {
				return errors.WithContext("error removing layer: ", err)
			}
			mp.Layers = append(mp.Layers[:n], mp.Layers[n+1:]...)
			return nil
		}
	}
	return ErrLayerNotExist
}

func (m *maps) RenameLayer(nl Rename, _ *struct{}) error {
	if m.currentAdminMap < 0 {
		return ErrMapNotExist
	}
	mp, ok := m.maps[m.currentAdminMap]
	if !ok {
		return ErrMapNotExist
	}
	for n, l := range mp.Layers {
		if l.ID == nl.ID {
			if _, err := mp.Stmts.renameLayer.Exec(nl.Name, nl.ID); err != nil {
				return errors.WithContext("error renaming layer: ", err)
			}
			mp.Layers[n].Name = nl.Name
		}
	}
	return ErrLayerNotExist
}

func (m *maps) HideLayer(id int, hidden *bool) error {
	if m.currentAdminMap < 0 {
		return ErrMapNotExist
	}
	mp, ok := m.maps[m.currentAdminMap]
	if !ok {
		return ErrMapNotExist
	}
	for n, l := range mp.Layers {
		if l.ID == id {
			*hidden = !l.Hidden
			if !l.Hidden {
				if _, err := mp.Stmts.hideLayer.Exec(id); err != nil {
					return errors.WithContext("error hiding layer: ", err)
				}
				mp.Layers[n].Hidden = true
			}
			return nil
		}
	}
	return ErrLayerNotExist
}

func (m *maps) ShowLayer(id int, shown *bool) error {
	if m.currentAdminMap < 0 {
		return ErrMapNotExist
	}
	mp, ok := m.maps[m.currentAdminMap]
	if !ok {
		return ErrMapNotExist
	}
	for n, l := range mp.Layers {
		if l.ID == id {
			*shown = l.Hidden
			if l.Hidden {
				if _, err := mp.Stmts.showLayer.Exec(id); err != nil {
					return errors.WithContext("error showing layer: ", err)
				}
				mp.Layers[n].Hidden = false
			}
			return nil
		}
	}
	return ErrLayerNotExist
}

func (m *maps) LockLayer(id int, locked *bool) error {
	if m.currentAdminMap < 0 {
		return ErrMapNotExist
	}
	mp, ok := m.maps[m.currentAdminMap]
	if !ok {
		return ErrMapNotExist
	}
	for n, l := range mp.Layers {
		if l.ID == id {
			*locked = !l.Locked
			if !l.Locked {
				if _, err := mp.Stmts.lockLayer.Exec(id); err != nil {
					return errors.WithContext("error locking layer: ", err)
				}
				mp.Layers[n].Locked = true
			}
			return nil
		}
	}
	return ErrLayerNotExist
}

func (m *maps) UnlockLayer(id int, unlocked *bool) error {
	if m.currentAdminMap < 0 {
		return ErrMapNotExist
	}
	mp, ok := m.maps[m.currentAdminMap]
	if !ok {
		return ErrMapNotExist
	}
	for n, l := range mp.Layers {
		if l.ID == id {
			*unlocked = l.Locked
			if l.Locked {
				if _, err := mp.Stmts.unlockLayer.Exec(id); err != nil {
					return errors.WithContext("error unlocking layer: ", err)
				}
				mp.Layers[n].Locked = false
			}
			return nil
		}
	}
	return ErrLayerNotExist
}

func (m *maps) OpaqueLayer(id int, opaque *bool) error {
	if m.currentAdminMap < 0 {
		return ErrMapNotExist
	}
	mp, ok := m.maps[m.currentAdminMap]
	if !ok {
		return ErrMapNotExist
	}
	for n, l := range mp.Layers {
		if l.ID == id {
			*opaque = !l.BlockLight
			if !l.BlockLight {
				if _, err := mp.Stmts.layerLightBlock.Exec(id); err != nil {
					return errors.WithContext("error opaquing layer: ", err)
				}
				mp.Layers[n].BlockLight = true
			}
			return nil
		}
	}
	return ErrLayerNotExist
}

func (m *maps) TransparentLayer(id int, transparent *bool) error {
	if m.currentAdminMap < 0 {
		return ErrMapNotExist
	}
	mp, ok := m.maps[m.currentAdminMap]
	if !ok {
		return ErrMapNotExist
	}
	for n, l := range mp.Layers {
		if l.ID == id {
			*transparent = l.BlockLight
			if l.BlockLight {
				if _, err := mp.Stmts.layerLightBlock.Exec(id); err != nil {
					return errors.WithContext("error tansparenting layer: ", err)
				}
				mp.Layers[n].BlockLight = false
			}
			return nil
		}
	}
	return ErrLayerNotExist
}

const (
	ErrMapNotExist       errors.Error = "map doesn't exist"
	ErrCurrentAdminMap   errors.Error = "map is currently set as admin map"
	ErrCurrentUserMap    errors.Error = "map is currently set as user map"
	ErrInvalidDimensions errors.Error = "invalid map dimensions"
	ErrLayerNotExist     errors.Error = "layer doesn't exist"
)
