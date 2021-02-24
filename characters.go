package battlemap

import (
	"compress/gzip"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"path/filepath"
	"strconv"

	"vimagination.zapto.org/byteio"
	"vimagination.zapto.org/keystore"
)

type keystoreData struct {
	User bool            `json:"user"`
	Data json.RawMessage `json:"data"`
}

type characterData map[string]keystoreData

func (c characterData) ReadFrom(r io.Reader) (int64, error) {
	g, err := gzip.NewReader(r)
	if err != nil {
		return 0, err
	}
	br := byteio.StickyLittleEndianReader{Reader: g}
	l := br.ReadUint64()
	for i := uint64(0); i < l; i++ {
		key := br.ReadString64()
		user := br.ReadBool()
		data := br.ReadBytes64()
		c[key] = keystoreData{
			User: user,
			Data: data,
		}
	}
	return br.Count, br.Err
}

func (c characterData) WriteTo(w io.Writer) (int64, error) {
	g, err := gzip.NewWriterLevel(w, gzip.BestCompression)
	if err != nil {
		return 0, err
	}
	bw := byteio.StickyLittleEndianWriter{Writer: g}
	bw.WriteUint64(uint64(len(c)))
	for key, data := range c {
		bw.WriteString64(key)
		bw.WriteBool(data.User)
		bw.WriteBytes64(data.Data)
	}
	g.Close()
	return bw.Count, bw.Err
}

type charactersDir struct {
	folders
	Name string

	fileStore *keystore.FileStore

	data map[string]characterData
}

func (c *charactersDir) Init(b *Battlemap, links links) error {
	var location keystore.String
	err := b.config.Get("CharsDir", &location)
	if err != nil {
		return fmt.Errorf("error retrieving characters location: %w", err)
	}
	sp := filepath.Join(b.config.BaseDir, string(location))
	c.fileStore, err = keystore.NewFileStore(sp, sp, keystore.NoMangle)
	if err != nil {
		return fmt.Errorf("error creating characters keystore: %w", err)
	}
	c.fileType = fileTypeCharacter
	if err := c.folders.Init(b, c.fileStore, links.chars); err != nil {
		return fmt.Errorf("error parsing characters keystore folders: %w", err)
	}
	c.data = make(map[string]characterData)
	for id := range links.chars {
		idStr := strconv.FormatUint(id, 10)
		km := make(characterData)
		if err := c.fileStore.Get(idStr, km); err != nil {
			return err
		}
		for key, val := range km {
			if f := links.getLinkKey(key); f != nil {
				f.setJSONLinks(val.Data)
			}
		}
		c.data[idStr] = km
	}
	return nil
}

func (c *charactersDir) RPCData(cd ConnData, method string, data json.RawMessage) (interface{}, error) {
	switch method {
	case "create":
		return c.create(cd, data)
	case "modify":
		return nil, c.modify(cd, data)
	case "get":
		return c.get(cd, data)
	case "copy":
		return c.copy(cd, data)
	default:
		return c.folders.RPCData(cd, method, data)
	}
}

func (c *charactersDir) create(cd ConnData, data json.RawMessage) (json.RawMessage, error) {
	var nameData struct {
		Path string        `json:"path"`
		Data characterData `json:"data"`
	}
	if err := json.Unmarshal(data, &nameData); err != nil {
		return nil, err
	}
	if nameData.Data == nil {
		nameData.Data = make(characterData)
	}
	c.mu.Lock()
	c.lastID++
	kid := c.lastID
	nameData.Path = addItemTo(c.root.Items, nameData.Path, kid)
	c.saveFolders()
	strID := strconv.FormatUint(kid, 10)
	c.data[strID] = nameData.Data
	c.mu.Unlock()
	c.fileStore.Set(strID, nameData.Data)
	buf := append(appendString(append(append(append(json.RawMessage{}, "[{\"id\":"...), strID...), ",\"path\":"...), nameData.Path), '}', ']')
	c.socket.broadcastAdminChange(broadcastCharacterItemAdd, buf, cd.ID)
	return buf[1 : len(buf)-1], nil
}

func (c *charactersDir) modify(cd ConnData, data json.RawMessage) error {
	var m struct {
		ID       json.RawMessage         `json:"id"`
		Setting  map[string]keystoreData `json:"setting"`
		Removing []string                `json:"removing"`
	}
	if err := json.Unmarshal(data, &m); err != nil {
		return err
	}
	if len(m.Setting) == 0 && len(m.Removing) == 0 {
		return nil
	}
	c.mu.Lock()
	defer c.mu.Unlock()
	ms, ok := c.data[string(m.ID)]
	if !ok {
		return keystore.ErrUnknownKey
	}
	c.socket.broadcastAdminChange(broadcastCharacterDataChange, data, cd.ID)
	buf := append(append(data[:0], "{\"ID\":"...), m.ID...)
	buf = append(buf, ",\"setting\":{"...)
	var userRemoves []string
	for key, val := range m.Setting {
		if val.User {
			buf = append(append(append(appendString(append(buf, ','), key), ":{\"user\":true,\"data\":"...), val.Data...), '}')
		} else if mv, ok := ms[key]; ok && mv.User {
			userRemoves = append(userRemoves, key)
		}
		ms[key] = val
	}
	buf = append(buf, "},\"removing\":["...)
	first := true
	for _, key := range m.Removing {
		val, ok := ms[key]
		if !ok {
			continue
		}
		if val.User {
			if !first {
				buf = append(buf, ',')
			} else {
				first = false
			}
			buf = appendString(buf, key)
		}
		delete(ms, key)
	}
	for _, key := range userRemoves {
		if !first {
			buf = append(buf, ',')
		} else {
			first = false
		}
		buf = appendString(buf, key)
	}
	buf = append(buf, ']', '}')
	cd.CurrentMap = 0
	c.socket.broadcastMapChange(cd, broadcastCharacterDataChange, buf, userNotAdmin)
	return c.fileStore.Set(string(m.ID), ms)
}

func (c *charactersDir) get(cd ConnData, id json.RawMessage) (json.RawMessage, error) {
	c.mu.RLock()
	ms, ok := c.data[string(id)]
	if !ok {
		c.mu.RUnlock()
		return nil, keystore.ErrUnknownKey
	}
	var buf json.RawMessage
	for key, val := range ms {
		if cd.IsAdmin() || val.User {
			buf = append(append(append(strconv.AppendBool(append(appendString(append(buf, ','), key), ":{\"user\":"...), val.User), ",\"data\":"...), val.Data...), '}')
		}
	}
	c.mu.RUnlock()
	if len(buf) == 0 {
		buf = json.RawMessage{'{', '}'}
	} else {
		buf[0] = '{'
		buf = append(buf, '}')
	}
	return buf, nil
}

func (c *charactersDir) copy(cd ConnData, data json.RawMessage) (json.RawMessage, error) {
	var ip struct {
		ID   json.RawMessage `json:"id"`
		Path string          `json:"path"`
	}
	if err := json.Unmarshal(data, &ip); err != nil {
		return nil, err
	}
	c.mu.Lock()
	p, name, _ := c.getFolderItem(ip.Path)
	if p == nil {
		c.mu.Unlock()
		return nil, ErrFolderNotFound
	}
	ms, ok := c.data[string(ip.ID)]
	if !ok {
		c.mu.Unlock()
		return nil, keystore.ErrUnknownKey
	}
	d := make(characterData)
	for key, val := range ms {
		d[key] = val
	}
	c.lastID++
	kid := c.lastID
	strID := strconv.FormatUint(kid, 10)
	c.fileStore.Set(strID, d)
	newName := addItemTo(p.Items, name, kid)
	c.saveFolders()
	c.data[strID] = d
	c.mu.Unlock()
	ip.Path = ip.Path[:len(ip.Path)-len(name)] + newName
	data = append(appendString(append(strconv.AppendUint(append(append(append(data[:0], "{\"oldID\":"...), ip.ID...), ",\"newID\":"...), kid, 10), ",\"path\":"...), ip.Path), '}')
	c.socket.broadcastAdminChange(broadcastCharacterItemCopy, data, cd.ID)
	data = append(appendString(append(strconv.AppendUint(append(data[:0], "{\"id\":"...), kid, 10), ",\"path\":"...), ip.Path), '}')
	return data, nil
}

// Errors
var (
	ErrDuplicateKey = errors.New("duplicate key")
)
