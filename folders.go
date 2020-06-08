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

func (f *folder) WriteTo(w io.Writer) (int64, error) {
	lw := byteio.StickyLittleEndianWriter{Writer: w}
	f.WriteToX(&lw)
	return lw.Count, lw.Err
}

func (f *folder) ReadFrom(r io.Reader) (int64, error) {
	lr := byteio.StickyLittleEndianReader{Reader: r}
	f.ReadFromX(&lr)
	return lr.Count, lr.Err
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

	mu      sync.RWMutex
	lastID  uint64
	root    *folder
	hidden  *folder
	links   map[uint64]uint64
	json    memio.Buffer
	cleanup func(*Battlemap, uint64)
}

func (f *folders) Init(b *Battlemap, store *keystore.FileStore, cleanup func(*Battlemap, uint64)) error {
	f.Battlemap = b
	f.FileStore = store
	f.root = newFolder()
	if err := f.Get(folderMetadata, f.root); err != nil && os.IsNotExist(err) {
		return fmt.Errorf("error getting asset data: %w", err)
	}
	f.links = make(map[uint64]uint64)
	f.processFolder(f.root)
	keys := f.Keys()
	var gft getFileType
	for _, k := range keys {
		if k == folderMetadata {
			continue
		}
		f.Get(k, &gft)
		if gft.Type != f.fileType {
			continue
		}
		if !strings.HasPrefix(k, "0") {
			n, err := strconv.ParseUint(k, 10, 64)
			if err == nil {
				if _, ok := f.links[n]; !ok {
					addItemTo(f.root.Items, k, n)
					f.links[n] = 1
				}
				continue
			}
		}
		if f.Rename(k, strconv.FormatUint(f.lastID, 10)) == nil {
			f.lastID++
			addItemTo(f.root.Items, k, f.lastID)
			f.links[f.lastID] = 1
		}
	}
	if h, ok := f.root.Folders[""]; ok {
		f.hidden = h
	} else {
		f.hidden = newFolder()
		f.root.Folders[""] = f.hidden
	}
	if len(keys) > 0 {
		f.Set(folderMetadata, f.root)
	}
	if cleanup == nil {
		f.cleanup = noopClean
	} else {
		f.cleanup = cleanup
	}
	return f.encodeJSON()
}

func addItemTo(items map[string]uint64, name string, id uint64) string {
	if _, ok := items[name]; !ok {
		items[name] = id
		return name
	}
	n := make([]byte, len(name)+32)
	m := n[len(name)+1 : len(name)+1]
	copy(n, name)
	n[len(name)] = '.'
	for i := uint64(0); ; i++ {
		p := len(strconv.AppendUint(m, i, 10))
		if _, ok := items[string(n[:len(name)+1+p])]; !ok {
			name := string(n[:len(name)+1+p])
			items[name] = id
			return name
		}
	}
}

func addFolderTo(folders map[string]*folder, name string, f *folder) string {
	if _, ok := folders[name]; !ok {
		folders[name] = f
		return name
	}
	n := make([]byte, len(name)+32)
	m := n[len(name)+1 : len(name)+1]
	copy(n, name)
	n[len(name)] = '.'
	for i := uint64(0); ; i++ {
		p := len(strconv.AppendUint(m, i, 10))
		if _, ok := folders[string(n[:len(name)+1+p])]; !ok {
			name := string(n[:len(name)+1+p])
			folders[name] = f
			return name
		}
	}
}

func (f *folders) processFolder(fd *folder) {
	for _, g := range fd.Folders {
		f.processFolder(g)
	}
	for name, is := range fd.Items {
		if is == 0 || !f.Exists(strconv.FormatUint(is, 10)) {
			delete(fd.Items, name)
		}
		if is > f.lastID {
			f.lastID = is
		}
		il, _ := f.links[is]
		f.links[is] = il + 1
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
	f.Set(folderMetadata, f.root)
	f.json = memio.Buffer{}
	f.encodeJSON()
}

func (f *folders) encodeJSON() error {
	delete(f.root.Folders, "")
	err := json.NewEncoder(&f.json).Encode(f.root)
	f.root.Folders[""] = f.hidden
	return err
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

func (f *folders) RPCData(cd ConnData, method string, data []byte) (interface{}, error) {
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
		case "link":
			return f.linkItem(cd, data)
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

func (f *folders) folderCreate(cd ConnData, data []byte) (string, error) {
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

func (f *folders) itemMove(cd ConnData, data []byte) (string, error) {
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

func (f *folders) folderMove(cd ConnData, data []byte) (string, error) {
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

func (f *folders) itemDelete(cd ConnData, data []byte) error {
	var item string
	if err := json.Unmarshal(data, &item); err != nil {
		return err
	}
	f.mu.Lock()
	defer f.mu.Unlock()
	parent, oldName, iid := f.getFolderItem(item)
	if parent == nil || iid == 0 {
		return ErrItemNotFound
	}
	delete(parent.Items, oldName)
	f.unlink(iid)
	f.saveFolders()
	f.socket.broadcastAdminChange(f.getBroadcastID(broadcastImageItemRemove), data, cd.ID)
	return nil
}

func (f *folders) unlink(iid uint64) {
	links := f.links[iid]
	if links == 0 {
		return
	} else if links == 1 {
		delete(f.links, iid)
		f.cleanup(f.Battlemap, iid)
		f.Remove(strconv.FormatUint(iid, 10))
	} else {
		f.links[iid] = links - 1
	}
}

func (f *folders) folderDelete(cd ConnData, data []byte) error {
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
	walkFolders(fd, func(items map[string]uint64) bool {
		for _, iid := range items {
			f.unlink(iid)
		}
		return false
	})
	f.saveFolders()
	f.socket.broadcastAdminChange(f.getBroadcastID(broadcastImageFolderRemove), data, cd.ID)
	return nil
}

func (f *folders) linkItem(cd ConnData, data []byte) (string, error) {
	var link idName
	if err := json.Unmarshal(data, &link); err != nil {
		return "", err
	}
	f.mu.Lock()
	defer f.mu.Unlock()
	if _, ok := f.links[link.ID]; !ok {
		return "", ErrItemNotFound
	}
	parent, name, _ := f.getFolderItem(link.Name)
	if parent == nil {
		return "", ErrFolderNotFound
	}
	if name == "" {
		name = strconv.FormatUint(link.ID, 10)
	}
	newName := addItemTo(parent.Items, name, link.ID)
	f.saveFolders()
	link.Name = link.Name[:len(link.Name)-len(name)] + newName
	f.socket.broadcastAdminChange(f.getBroadcastID(broadcastImageItemLink), data, cd.ID)
	return link.Name, nil
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

func (f *folders) setHiddenLink(id uint64) error {
	f.mu.Lock()
	defer f.mu.Unlock()
	count := f.links[id]
	if count == 0 {
		return ErrItemNotFound
	}
	idStr := strconv.FormatUint(id, 10)
	folder, ok := f.hidden.Folders[idStr]
	if !ok {
		folder = newFolder()
		f.hidden.Folders[idStr] = folder
	}
	addItemTo(folder.Items, " ", id)
	f.links[id] = count + 1
	f.saveFolders()
	return nil
}

func (f *folders) removeHiddenLink(id uint64) error {
	f.mu.Lock()
	defer f.mu.Unlock()
	count := f.links[id]
	if count == 0 {
		return ErrItemNotFound
	}
	idStr := strconv.FormatUint(id, 10)
	folder, ok := f.hidden.Folders[idStr]
	if !ok {
		return ErrFolderNotFound
	}
	for key := range folder.Items {
		delete(folder.Items, key)
		break
	}
	if len(folder.Items) == 0 {
		delete(f.hidden.Folders, idStr)
	}
	f.unlink(id)
	f.saveFolders()
	return nil
}

func noopClean(_ *Battlemap, _ uint64) {}

const folderMetadata = "folders"

// Errors
var (
	ErrItemNotFound   = errors.New("item not found")
	ErrFolderNotFound = errors.New("folder not found")
)
