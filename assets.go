package main

import (
	"database/sql"
	"fmt"
	"net/rpc"
	"net/rpc/jsonrpc"
	"strings"
	"time"

	"golang.org/x/net/websocket"
	"vimagination.zapto.org/errors"
)

var Assets assets

type assets struct {
	server *rpc.Server

	Tags    map[int]*Tag
	Assets  map[int]*Asset
	TagList map[string]*Tag

	addAsset, renameAsset, removeAsset               *sql.Stmt
	addTag, renameTag, removeTag                     *sql.Stmt
	addAssetTag, removeAssetTag                      *sql.Stmt
	removeTagFromAssetTags, removeAssetFromAssetTags *sql.Stmt
}

type Tag struct {
	ID     int
	Name   string
	Assets []int
}

type Asset struct {
	ID            int
	Name          string
	Width, Height int
	Tags          []int
	Uploaded      time.Time
}

func (a *assets) init(database *sql.DB) error {
	if _, err := database.Exec("CREATE TABLE IF NOT EXISTS [Assets]([ID] INTEGER PRIMARY KEY AUTOINCREMENT, [Name] TEXT NOT NULL DEFAULT '', [Width] INTEGER NOT NULL DEFAULT 0, [Height] INTEGER NOT NULL DEFAULT 0, [Uploaded] INTEGER NOT NULL DEFAULT 0);"); err != nil {
		return errors.WithContext("error creating Assets table: ", err)
	}
	if _, err := database.Exec("CREATE TABLE IF NOT EXISTS [Tags]([ID] INTEGER PRIMARY KEY AUTOINCREMENT, [Tag] TEXT NOT NULL DEFAULT '');"); err != nil {
		return errors.WithContext("error creating Tags table: ", err)
	}
	if _, err := database.Exec("CREATE TABLE IF NOT EXISTS [AssetsTags]([Asset] INTEGER NOT NULL DEFAULT 0, [Tag] INTEGER NOT NULL DEFAULT 0);"); err != nil {
		return errors.WithContext("error creating AssetTags table: ", err)
	}
	var err error

	for stmt, code := range map[**sql.Stmt]string{
		&a.addAsset:                 "INSERT INTO [Assets]([Name], [Width], [Height]) VALUES (?, ?, ?);",
		&a.renameAsset:              "UPDATE [Assets] SET [Name] = ? WHERE [ID] = ?;",
		&a.removeAsset:              "DELETE FROM [Assets] WHERE [ID] = ?;",
		&a.addTag:                   "INSERT INTO [Tags]([Tag]) VALUES (?);",
		&a.renameTag:                "UPDATE [Tags] SET [Name] = ? WHERE [ID] = ?;",
		&a.removeTag:                "DELETE FROM [Tags] WHERE [ID] = ?;",
		&a.addAssetTag:              "INSERT INTO [AssetTags]([Asset], [Tag]) VALUES (?, ?);",
		&a.removeAssetTag:           "DELETE FROM [AssetTags] WHERE [Asset] = ? AND [Tag] = ?;",
		&a.removeTagFromAssetTags:   "DELETE FROM [AssetTags] WHERE [Tag] = ?;",
		&a.removeAssetFromAssetTags: "DELETE FROM [AssetTags] WHERE [Asset] = ?;",
	} {
		if *stmt, err = database.Prepare(code); err != nil {
			return errors.WithContext(fmt.Sprintf("error preparing statement %q: ", code), err)
		}
	}

	rows, err := database.Query("SELECT [ID], [Name], [Width], [Height], [Uploaded] FROM [Assets] ORDER BY [Uploaded] DESC;")
	if err != nil {
		return errors.WithContext("error loading Asset data: ", err)
	}
	a.Assets = make(map[int]*Asset)
	for rows.Next() {
		as := new(Asset)
		var uploaded int64
		if err = rows.Scan(&as.ID, &as.Name, &as.Width, &as.Height, &uploaded); err != nil {
			return errors.WithContext("error getting Asset data: ", err)
		}
		as.Uploaded = time.Unix(uploaded, 0)
		a.Assets[as.ID] = as
	}
	if err = rows.Close(); err != nil {
		return errors.WithContext("error closing Asset data: ", err)
	}

	if rows, err = database.Query("SELECT [ID], [Tag] FROM [Tags] ORDER BY [Tag] ASC;"); err != nil {
		return errors.WithContext("error loading Tag data: ", err)
	}
	a.Tags = make(map[int]*Tag)
	a.TagList = make(map[string]*Tag)
	for rows.Next() {
		tag := new(Tag)
		if err = rows.Scan(&tag.ID, &tag.Name); err != nil {
			return errors.WithContext("error getting Tag data: ", err)
		}
		a.Tags[tag.ID] = tag
		a.TagList[strings.ToLower(tag.Name)] = tag
	}
	if err = rows.Close(); err != nil {
		return errors.WithContext("error closing Tag data: ", err)
	}

	if rows, err = database.Query("SELECT [Asset], [Tag] FROM [AssetTags];"); err != nil {
		return errors.WithContext("error loading AssetTag data: ", err)
	}
	for rows.Next() {
		var asset, tag int
		if err = rows.Scan(&asset, &tag); err != nil {
			return errors.WithContext("error getting AssetTag data: ", err)
		}
		t, ok := a.Tags[tag]
		if !ok {
			continue
		}
		as, ok := a.Assets[asset]
		if !ok {
			continue
		}
		as.Tags = append(as.Tags, tag)
		t.Assets = append(t.Assets, asset)
	}
	if err = rows.Close(); err != nil {
		return errors.WithContext("error closing AssetTag data: ", err)
	}

	a.server = rpc.NewServer()
	a.server.Register(a)
	return nil
}

func (a *assets) handleConn(conn *websocket.Conn) {
	a.server.ServeCodec(jsonrpc.NewServerCodec(conn))
}
