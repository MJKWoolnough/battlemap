package main

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"

	"vimagination.zapto.org/errors"
)

var Assets assets

type assets struct {
	Tags       map[int]*Tag
	Assets     map[int]*Asset
	TagList    map[string]*Tag
	AssetsList map[string]*Asset

	addAsset, renameAsset, removeAsset               *sql.Stmt
	addTag, renameTag, removeTag                     *sql.Stmt
	addAssetTag, removeAssetTag                      *sql.Stmt
	removeTagFromAssetTags, removeAssetFromAssetTags *sql.Stmt

	dir string
}

type Tag struct {
	ID     int
	Name   string
	Assets []int
}

type Asset struct {
	ID       int
	Ext      string
	Name     string
	Tags     []int
	Type     string
	Uploaded time.Time
}

func (a *assets) init(database *sql.DB) error {
	if _, err := database.Exec("CREATE TABLE IF NOT EXISTS [Assets]([ID] INTEGER PRIMARY KEY AUTOINCREMENT, [Ext] TEXT NOT NULL DEFAULT '', [Name] TEXT NOT NULL DEFAULT '', [Type] TEXT NOT NULL DEFAULT '', [Uploaded] INTEGER NOT NULL DEFAULT 0);"); err != nil {
		return errors.WithContext("error creating Assets table: ", err)
	}
	if _, err := database.Exec("CREATE TABLE IF NOT EXISTS [Tags]([ID] INTEGER PRIMARY KEY AUTOINCREMENT, [Tag] TEXT NOT NULL DEFAULT '');"); err != nil {
		return errors.WithContext("error creating Tags table: ", err)
	}
	if _, err := database.Exec("CREATE TABLE IF NOT EXISTS [AssetTags]([Asset] INTEGER NOT NULL DEFAULT 0, [Tag] INTEGER NOT NULL DEFAULT 0);"); err != nil {
		return errors.WithContext("error creating AssetTags table: ", err)
	}
	var err error

	for stmt, code := range map[**sql.Stmt]string{
		&a.addAsset:                 "INSERT INTO [Assets]([Name], [Ext], [Type], [Uploaded]) VALUES (?, ?, ?, ?);",
		&a.renameAsset:              "UPDATE [Assets] SET [Name] = ? WHERE [ID] = ?;",
		&a.removeAsset:              "DELETE FROM [Assets] WHERE [ID] = ?;",
		&a.addTag:                   "INSERT INTO [Tags]([Tag]) VALUES (?);",
		&a.renameTag:                "UPDATE [Tags] SET [Tag] = ? WHERE [ID] = ?;",
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

	rows, err := database.Query("SELECT [ID], [Ext], [Name], [Type], [Uploaded] FROM [Assets] ORDER BY [Uploaded] DESC;")
	if err != nil {
		return errors.WithContext("error loading Asset data: ", err)
	}
	a.Assets = make(map[int]*Asset)
	a.AssetsList = make(map[string]*Asset)
	for rows.Next() {
		as := &Asset{
			Tags: make([]int, 0, 0),
		}
		var uploaded int64
		if err = rows.Scan(&as.ID, &as.Ext, &as.Name, &as.Type, &uploaded); err != nil {
			return errors.WithContext("error getting Asset data: ", err)
		}
		as.Uploaded = time.Unix(uploaded, 0)
		a.Assets[as.ID] = as
		a.AssetsList[strings.ToLower(as.Name)] = as
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
		tag := &Tag{
			Assets: make([]int, 0, 0),
		}
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
	return nil
}

func (a *assets) handleUpload(w http.ResponseWriter, r *http.Request) {
	m, err := r.MultipartReader()
	if err != nil {
		w.WriteHeader(http.StatusBadRequest)
		io.WriteString(w, err.Error())
		return
	}
	buf := make([]byte, 512)
	now := time.Now()
	nowU := now.Unix()
	as := make([]*Asset, 0, 32)
	for {
		p, err := m.NextPart()
		if err != nil {
			if err == io.EOF {
				break
			}
			w.WriteHeader(http.StatusBadRequest)
			io.WriteString(w, err.Error())
			return

		}
		name := p.FileName()
		if name == "" {
			name = "asset"
		}
		if _, ok := a.AssetsList[strings.ToLower(name)]; ok {
			for i := 1; ; i++ {
				tName := fmt.Sprintf("%s-%d", name, i)
				if _, ok = a.AssetsList[strings.ToLower(tName)]; !ok {
					name = tName
					break
				}
			}
		}
		n, err := io.ReadFull(p, buf)
		if err != nil {
			w.WriteHeader(http.StatusBadRequest)
			io.WriteString(w, err.Error())
			return
		}
		var ctype, ext string
		switch http.DetectContentType(buf[:n]) {
		case "image/gif":
			ext = "gif"
			ctype = "image"
		case "image/png":
			ext = "png"
			ctype = "image"
		case "image/jpeg":
			ext = "jpg"
			ctype = "image"
		case "image/webp":
			ext = "webp"
			ctype = "image"
		case "application/ogg":
			ext = "ogg"
			ctype = "audio"
		case "audio/mpeg":
			ext = "mp3"
			ctype = "audio"
		case "text/html; charset=utf-8":
			ext = "html"
			ctype = "document"
		case "text/plain; charset=utf-8":
			ext = "txt"
			ctype = "document"
		case "application/pdf", "application/postscript":
			ext = "pdf"
			ctype = "document"
		default:
			continue
		}
		var res sql.Result
		if res, err = a.addAsset.Exec(name, ext, ctype, nowU); err == nil {
			var id int64
			if id, err = res.LastInsertId(); err == nil {
				var f *os.File
				if f, err = os.Create(filepath.Join(a.dir, fmt.Sprintf("%d.%s", id, ext))); err == nil {
					if _, err = f.Write(buf[:n]); err == nil {
						if _, err = io.Copy(f, p); err == nil {
							if err = f.Close(); err == nil {
								asset := &Asset{
									ID:       int(id),
									Ext:      ext,
									Name:     name,
									Tags:     make([]int, 0, 0),
									Type:     ctype,
									Uploaded: now,
								}
								a.Assets[int(id)] = asset
								a.AssetsList[strings.ToLower(name)] = asset
								as = append(as, asset)
								if ctype == "image" {
									//go a.generateThumbnail(asset)
								}
								continue
							}
						}
					}
				}
				a.removeAsset.Exec(id)
			}
		}
		w.WriteHeader(http.StatusInternalServerError)
		io.WriteString(w, err.Error())
		return
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(as)
}

func (a *assets) generateThumbnail(asset *Asset) {

}

func (a *assets) ListAssets(_ struct{}, list *map[int]*Asset) error {
	*list = a.Assets
	return nil
}

func (a *assets) ListTags(_ struct{}, list *map[int]*Tag) error {
	*list = a.Tags
	return nil
}

func (a *assets) AddTag(tagName string, tag *Tag) error {
	if _, ok := a.TagList[strings.ToLower(tagName)]; ok {
		return ErrTagExists
	}
	if res, err := a.addTag.Exec(tagName); err != nil {
		return errors.WithContext("error adding tag to database: ", err)
	} else if id, err := res.LastInsertId(); err != nil {
		return errors.WithContext("error getting tag ID: ", err)
	} else {
		*tag = Tag{
			ID:     int(id),
			Name:   tagName,
			Assets: make([]int, 0, 0),
		}
		a.TagList[tagName] = tag
		a.Tags[int(id)] = tag
	}
	return nil
}

func (a *assets) RenameTag(t *Tag, newName *string) error {
	u, ok := a.Tags[t.ID]
	if !ok {
		return ErrTagNotExist
	}
	if u.Name != t.Name {
		if !strings.EqualFold(u.Name, t.Name) {
			if _, ok = a.TagList[strings.ToLower(t.Name)]; ok {
				for i := 1; ; i++ {
					tName := fmt.Sprintf("%s-%d", t.Name, i)
					if _, ok = a.TagList[strings.ToLower(tName)]; !ok {
						t.Name = tName
						break
					}
				}
			}
		}
		_, err := a.renameTag.Exec(t.Name, t.ID)
		if err != nil {
			return errors.WithContext("error renaming tag: ", err)
		}
	}
	u.Name = t.Name
	*newName = u.Name
	return nil
}

func (a *assets) RemoveTag(id int, _ *struct{}) error {
	t, ok := a.Tags[id]
	if !ok {
		return ErrTagNotExist
	}
	_, err := a.removeTagFromAssetTags.Exec(id)
	if err == nil {
		_, err = a.removeTag.Exec(id)
	}
	if err != nil {
		return errors.WithContext("error removing tag: ", err)
	}
	for _, aid := range t.Assets {
		asset, ok := a.Assets[aid]
		if !ok {
			continue
		}
		for n, at := range asset.Tags {
			if at == id {
				asset.Tags = append(asset.Tags[:n], asset.Tags[n+1:]...)
				break
			}
		}
	}
	delete(a.Tags, id)
	delete(a.TagList, strings.ToLower(t.Name))
	return nil
}

func (a *assets) RenameAsset(asset *Asset, newName *string) error {
	u, ok := a.Assets[asset.ID]
	if !ok {
		return ErrTagNotExist
	}
	if u.Name != asset.Name {
		if !strings.EqualFold(u.Name, asset.Name) {
			if _, ok = a.AssetsList[strings.ToLower(asset.Name)]; ok {
				for i := 1; ; i++ {
					tName := fmt.Sprintf("%s-%d", asset.Name, i)
					if _, ok = a.AssetsList[strings.ToLower(tName)]; !ok {
						asset.Name = tName
						break
					}
				}
			}
		}
		_, err := a.renameAsset.Exec(asset.Name, asset.ID)
		if err != nil {
			return errors.WithContext("error renaming asset: ", err)
		}
	}
	u.Name = asset.Name
	*newName = u.Name
	return nil
}

func (a *assets) RemoveAsset(id int, _ *struct{}) error {
	u, ok := a.Assets[id]
	if !ok {
		return ErrAssetNotExist
	}
	_, err := a.removeAssetFromAssetTags.Exec(id)
	if err == nil {
		_, err = a.removeAsset.Exec(id)
	}
	if err != nil {
		return errors.WithContext("error removing asset: ", err)
	}
	for _, tid := range u.Tags {
		tag, ok := a.Tags[tid]
		if !ok {
			continue
		}
		for n, asset := range tag.Assets {
			if asset == id {
				tag.Assets = append(tag.Assets[:n], tag.Assets[n+1:]...)
				break
			}
		}
	}
	delete(a.Assets, id)
	delete(a.AssetsList, strings.ToLower(u.Name))
	os.Remove(filepath.Join(a.dir, fmt.Sprintf("%d.%s", u.ID, u.Ext)))
	//os.Remove(filepath.Join(a.dir, "thumbnails", fmt.Sprintf("%d.png", u.ID)))
	return nil
}

const (
	ErrTagExists     errors.Error = "tag exists"
	ErrTagNotExist   errors.Error = "tag doesn't exist"
	ErrAssetNotExist errors.Error = "asset doesn't exist"
)
