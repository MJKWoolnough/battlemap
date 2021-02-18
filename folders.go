package battlemap

import (
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"os"
	"path"
	"strconv"
	"strings"
	"sync"

	"vimagination.zapto.org/byteio"
	"vimagination.zapto.org/keystore"
	"vimagination.zapto.org/memio"
)

type folder struct {
	Folders map[string]*folder `json:"folders"`
	Items   map[string]uint64  `json:"items"`
}

func newFolder() *folder {
	return &folder{
		Folders: make(map[string]*folder),
		Items:   make(map[string]uint64),
	}
}

func (f *folder) WriteToX(lw *byteio.StickyLittleEndianWriter) {
	lw.WriteUint64(uint64(len(f.Folders)))
	for name, fd := range f.Folders {
		lw.WriteStringX(name)
		fd.WriteToX(lw)
	}
	lw.WriteUint64(uint64(len(f.Items)))
	for name, iid := range f.Items {
		lw.WriteStringX(name)
		lw.WriteUint64(iid)
	}
}

func (f *folder) ReadFromX(lr *byteio.StickyLittleEndianReader) {
	fl := lr.ReadUint64()
	f.Folders = make(map[string]*folder, fl)
	for i := uint64(0); i < fl; i++ {
		fd := newFolder()
		name := lr.ReadStringX()
		fd.ReadFromX(lr)
		f.Folders[name] = fd
	}
	il := lr.ReadUint64()
	f.Items = make(map[string]uint64, il)
	for i := uint64(0); i < il; i++ {
		name := lr.ReadStringX()
		f.Items[name] = lr.ReadUint64()
	}
}

type folders struct {
	*Battlemap
	*keystore.FileStore
	fileType

	mu     sync.RWMutex
	lastID uint64
	root   *folder
	json   memio.Buffer
}

func (f *folders) Init(b *Battlemap, store *keystore.FileStore, l linkManager) error {
	f.Battlemap = b
	f.FileStore = store
	f.root = newFolder()
	if err := f.Get(folderMetadata, f); err != nil && os.IsNotExist(err) {
		return fmt.Errorf("error getting asset data: %w", err)
	}
	f.processFolder(f.root, l)
	return f.encodeJSON()
}

func (f *folders) cleanup(l linkManager) {
	for _, key := range f.Keys() {
		id, err := strconv.ParseUint(key, 10, 64)
		if err != nil {
			continue
		}
		if _, ok := l[id]; !ok {
			f.Remove(key)
		}
	}
}

func (f *folders) WriteTo(w io.Writer) (int64, error) {
	lw := byteio.StickyLittleEndianWriter{Writer: w}
	f.root.WriteToX(&lw)
	return lw.Count, lw.Err
}

func (f *folders) ReadFrom(r io.Reader) (int64, error) {
	lr := byteio.StickyLittleEndianReader{Reader: r}
	f.root.ReadFromX(&lr)
	return lr.Count, lr.Err
}

func addItemTo(items map[string]uint64, name string, id uint64) string {
	return uniqueName(name, func(name string) bool {
		if _, ok := items[name]; !ok {
			items[name] = id
			return true
		}
		return false
	})
}

func addFolderTo(folders map[string]*folder, name string, f *folder) string {
	return uniqueName(name, func(name string) bool {
		if _, ok := folders[name]; !ok {
			folders[name] = f
			return true
		}
		return false
	})
}

func (f *folders) processFolder(fd *folder, l linkManager) {
	for _, g := range fd.Folders {
		f.processFolder(g, l)
	}
	for name, is := range fd.Items {
		if is == 0 || !f.Exists(strconv.FormatUint(is, 10)) {
			delete(fd.Items, name)
		} else {
			l.setLink(is)
		}
		if is > f.lastID {
			f.lastID = is
		}
	}
}

func (f *folders) getFolder(path string) *folder {
	d := f.root
	for _, p := range strings.Split(path, "/") {
		if p == "" {
			continue
		}
		e, ok := d.Folders[p]
		if !ok {
			return nil
		}
		d = e
	}
	return d
}

func splitAfterLastSlash(p string) (string, string) {
	lastSlash := strings.LastIndexByte(p, '/')
	if lastSlash >= 0 {
		return p[:lastSlash], p[lastSlash+1:]
	}
	return "", p
}

func (f *folders) getParentFolder(p string) (parent *folder, name string, fd *folder) {
	parentStr, name := splitAfterLastSlash(path.Clean(strings.TrimRight(p, "/")))
	if parentStr != "" {
		parent = f.getFolder(parentStr)
		if parent == nil {
			return nil, "", nil
		}
	} else {
		parent = f.root
	}
	fd, _ = parent.Folders[name]
	return parent, name, fd
}

func (f *folders) getFolderItem(p string) (parent *folder, name string, iid uint64) {
	dir, file := path.Split(p)
	parent = f.getFolder(path.Clean(dir))
	if parent == nil {
		return nil, "", 0
	}
	iid, _ = parent.Items[file]
	return parent, file, iid
}

func (f *folders) exists(p string) bool {
	f.mu.RLock()
	dir, file := path.Split(p)
	folder := f.getFolder(path.Clean(dir))
	if folder == nil {
		return false
	} else if file == "" {
		return true
	}
	_, ok := folder.Items[file]
	f.mu.RUnlock()
	return ok
}

func (f *folders) saveFolders() {
	f.Set(folderMetadata, f)
	f.encodeJSON()
}

func (f *folders) encodeJSON() error {
	f.json = memio.Buffer{}
	return json.NewEncoder(&f.json).Encode(f.root)
}

func walkFolders(f *folder, fn func(map[string]uint64) bool) bool {
	if fn(f.Items) {
		return true
	}
	for _, f := range f.Folders {
		if walkFolders(f, fn) {
			return true
		}
	}
	return false
}

func (f *folders) RPCData(cd ConnData, method string, data json.RawMessage) (interface{}, error) {
	if cd.IsAdmin() {
		switch method {
		case "list":
			return f.list(), nil
		case "createFolder":
			return f.folderCreate(cd, data)
		case "move":
			return f.itemMove(cd, data)
		case "moveFolder":
			return f.folderMove(cd, data)
		case "remove":
			return nil, f.itemDelete(cd, data)
		case "removeFolder":
			return nil, f.folderDelete(cd, data)
		case "copy":
			return f.copyItem(cd, data)
		}
	}
	return nil, ErrUnknownMethod
}

func (f *folders) list() json.RawMessage {
	f.mu.RLock()
	data := f.json
	f.mu.RUnlock()
	return json.RawMessage(data)
}

func (f *folders) folderCreate(cd ConnData, data json.RawMessage) (string, error) {
	var dir string
	if err := json.Unmarshal(data, &dir); err != nil {
		return "", err
	}
	f.mu.Lock()
	defer f.mu.Unlock()
	parent, name, _ := f.getParentFolder(dir)
	if parent == nil || name == "" {
		return "", ErrFolderNotFound
	}
	newName := addFolderTo(parent.Folders, name, newFolder())
	f.saveFolders()
	dir = dir[:len(dir)-len(name)] + newName
	f.socket.broadcastAdminChange(f.getBroadcastID(broadcastImageFolderAdd), data, cd.ID)
	return dir, nil
}

type fromTo struct {
	From string `json:"from"`
	To   string `json:"to"`
}

func (f *folders) itemMove(cd ConnData, data json.RawMessage) (string, error) {
	var itemMove fromTo
	if err := json.Unmarshal(data, &itemMove); err != nil {
		return "", err
	}
	f.mu.Lock()
	defer f.mu.Unlock()
	oldParent, oldName, iid := f.getFolderItem(itemMove.From)
	if oldParent == nil || iid == 0 {
		return "", ErrItemNotFound
	}
	var (
		newParent *folder
		newName   string
	)
	if strings.HasSuffix(itemMove.To, "/") {
		newParent = f.getFolder(strings.TrimRight(itemMove.To, "/"))
		newName = oldName
	} else {
		path, file := path.Split(itemMove.To)
		newName = file
		itemMove.To = strings.TrimRight(path, "/")
		newParent = f.getFolder(itemMove.To)
	}
	delete(oldParent.Items, oldName)
	newName = addItemTo(newParent.Items, newName, iid)
	f.saveFolders()
	itemMove.To += "/" + newName
	f.socket.broadcastAdminChange(f.getBroadcastID(broadcastImageItemMove), data, cd.ID)
	return itemMove.To, nil
}

func (f *folders) folderMove(cd ConnData, data json.RawMessage) (string, error) {
	var folderMove fromTo
	if err := json.Unmarshal(data, &folderMove); err != nil {
		return "", err
	}
	f.mu.Lock()
	defer f.mu.Unlock()
	oldParent, oldName, fd := f.getParentFolder(folderMove.From)
	if oldParent == nil || f == nil {
		return "", ErrFolderNotFound
	}
	var (
		newParent *folder
		newName   string
	)
	if strings.HasSuffix(folderMove.To, "/") {
		newParent = f.getFolder(strings.TrimRight(folderMove.To, "/"))
		newName = oldName
	} else {
		path, file := path.Split(folderMove.To)
		newName = file
		folderMove.To = strings.TrimRight(path, "/")
		newParent = f.getFolder(folderMove.To)
	}
	delete(oldParent.Folders, oldName)
	newName = addFolderTo(newParent.Folders, newName, fd)
	f.saveFolders()
	folderMove.To += "/" + newName
	f.socket.broadcastAdminChange(f.getBroadcastID(broadcastImageFolderMove), data, cd.ID)
	return folderMove.To, nil
}

func (f *folders) itemDelete(cd ConnData, data json.RawMessage) error {
	var item string
	if err := json.Unmarshal(data, &item); err != nil {
		return err
	}
	f.socket.broadcastAdminChange(f.getBroadcastID(broadcastImageItemRemove), data, cd.ID)
	return f.itemDeleteString(item)
}

func (f *folders) itemDeleteString(item string) error {
	f.mu.Lock()
	defer f.mu.Unlock()
	parent, oldName, iid := f.getFolderItem(item)
	if parent == nil || iid == 0 {
		return ErrItemNotFound
	}
	delete(parent.Items, oldName)
	f.saveFolders()
	return nil
}

func (f *folders) folderDelete(cd ConnData, data json.RawMessage) error {
	var folder string
	if err := json.Unmarshal(data, &folder); err != nil {
		return err
	}
	f.mu.Lock()
	defer f.mu.Unlock()
	parent, oldName, fd := f.getParentFolder(folder)
	if parent == nil || fd == nil {
		return ErrFolderNotFound
	}
	delete(parent.Folders, oldName)
	f.saveFolders()
	f.socket.broadcastAdminChange(f.getBroadcastID(broadcastImageFolderRemove), data, cd.ID)
	return nil
}

func (f *folders) copyItem(cd ConnData, data json.RawMessage) (interface{}, error) {
	var ip struct {
		ID   uint64 `json:"id"`
		Path string `json:"path"`
	}
	if err := json.Unmarshal(data, &ip); err != nil {
		return "", err
	}
	f.mu.Lock()
	parent, name, _ := f.getFolderItem(ip.Path)
	if parent == nil {
		f.mu.Unlock()
		return "", ErrFolderNotFound
	}
	if name == "" {
		name = strconv.FormatUint(ip.ID, 10)
	}
	newName := addItemTo(parent.Items, name, ip.ID)
	f.saveFolders()
	f.mu.Unlock()
	ip.Path = ip.Path[:len(ip.Path)-len(name)] + newName
	data = append(appendString(append(strconv.AppendUint(append(strconv.AppendUint(append(data[:0], "{\"oldID\":"...), ip.ID, 10), ",\"newID\":"...), ip.ID, 10), ",\"path\":"...), ip.Path), '}')
	f.socket.broadcastAdminChange(f.getBroadcastID(broadcastImageItemCopy), data, cd.ID)
	data = append(appendString(append(strconv.AppendUint(append(data[:0], "{\"id\":"...), ip.ID, 10), ",\"path\":"...), ip.Path), '}')
	return data, nil
}

func (f *folders) getBroadcastID(base int) int {
	switch f.fileType {
	case fileTypeAudio:
		return base - 1
	case fileTypeCharacter:
		return base - 2
	case fileTypeMap:
		return base - 3
	}
	return base
}

const folderMetadata = "folders"

// Errors
var (
	ErrItemNotFound   = errors.New("item not found")
	ErrFolderNotFound = errors.New("folder not found")
)
