package battlemap

import (
	"encoding/json"
	"path"
	"strconv"
	"strings"

	"golang.org/x/net/websocket"
)

func (a *assetsDir) WebSocket(conn *websocket.Conn) {
	a.socket.RunConn(conn, a, SocketAssets)
}

func (a *assetsDir) RPCData(cd ConnData, method string, data []byte) (interface{}, error) {
	if cd.IsAdmin() {
		switch method {
		case "list":
			return a.rpcList(), nil
		case "createFolder":
			return a.rpcFolderCreate(cd, data)
		case "moveAsset":
			return a.rpcAssetMove(cd, data)
		case "moveFolder":
			return a.rpcFolderMove(cd, data)
		case "deleteAsset":
			return nil, a.rpcAssetDelete(cd, data)
		case "deleteFolder":
			return nil, a.rpcFolderDelete(cd, data)
		case "link":
			return a.rpcLinkAsset(cd, data)
		}
	}
	return nil, ErrUnknownMethod
}

func (a *assetsDir) rpcList() json.RawMessage {
	a.assetMu.RLock()
	data := a.assetJSON
	a.assetMu.Unlock()
	return json.RawMessage(data)
}

func (a *assetsDir) rpcFolderCreate(cd ConnData, data []byte) (string, error) {
	var dir string
	if err := json.Unmarshal(data, &dir); err != nil {
		return "", err
	}
	a.assetMu.Lock()
	defer a.assetMu.Unlock()
	parent, name, _ := a.getParentFolder(dir)
	if parent == nil || name == "" {
		return "", ErrFolderNotFound
	}
	newName := addFolderTo(parent.Folders, name, new(folder))
	a.saveFolders()
	dir = dir[:len(dir)-len(name)] + newName
	a.socket.BroadcastFolderAdd(a.fileType, dir, cd.ID)
	return dir, nil
}

func (a *assetsDir) rpcAssetMove(cd ConnData, data []byte) (string, error) {
	var assetMove struct {
		Path, NewPath string
	}
	if err := json.Unmarshal(data, &assetMove); err != nil {
		return "", err
	}
	a.assetMu.Lock()
	defer a.assetMu.Unlock()
	oldParent, oldName, aid := a.getFolderAsset(assetMove.Path)
	if oldParent == nil || aid == 0 {
		return "", ErrAssetNotFound
	}
	var (
		newParent *folder
		newName   string
	)
	if strings.HasSuffix(assetMove.NewPath, "/") {
		newParent = a.getFolder(strings.TrimRight(assetMove.NewPath, "/"))
		newName = oldName
	} else {
		path, file := path.Split(assetMove.NewPath)
		newName = file
		assetMove.NewPath = strings.TrimRight(path, "/")
		newParent = a.getFolder(assetMove.NewPath)
	}
	delete(oldParent.Assets, oldName)
	newName = addAssetTo(newParent.Assets, newName, aid)
	a.saveFolders()
	assetMove.NewPath += "/" + newName
	a.socket.BroadcastAssetRename(a.fileType, assetMove, cd.ID)
	return assetMove.NewPath, nil
}

func (a *assetsDir) rpcFolderMove(cd ConnData, data []byte) (string, error) {
	var folderMove struct {
		Path, NewPath string
	}
	if err := json.Unmarshal(data, &folderMove); err != nil {
		return "", err
	}
	a.assetMu.Lock()
	defer a.assetMu.Unlock()
	oldParent, oldName, f := a.getParentFolder(folderMove.Path)
	if oldParent == nil || f == nil {
		return "", ErrFolderNotFound
	}
	var (
		newParent *folder
		newName   string
	)
	if strings.HasSuffix(folderMove.NewPath, "/") {
		newParent = a.getFolder(strings.TrimRight(folderMove.NewPath, "/"))
		newName = oldName
	} else {
		path, file := path.Split(folderMove.NewPath)
		newName = file
		folderMove.NewPath = strings.TrimRight(path, "/")
		newParent = a.getFolder(folderMove.NewPath)
	}
	delete(oldParent.Folders, oldName)
	newName = addFolderTo(newParent.Folders, newName, f)
	a.saveFolders()
	folderMove.NewPath += "/" + newName
	a.socket.BroadcastFolderMove(a.fileType, folderMove, cd.ID)
	return folderMove.NewPath, nil
}

func (a *assetsDir) rpcAssetDelete(cd ConnData, data []byte) error {
	var asset string
	if err := json.Unmarshal(data, &asset); err != nil {
		return err
	}
	a.assetMu.Lock()
	defer a.assetMu.Unlock()
	parent, oldName, aid := a.getFolderAsset(asset)
	if parent == nil || aid == 0 {
		return ErrAssetNotFound
	}
	delete(parent.Assets, oldName)
	a.unlink(aid)
	a.saveFolders()
	a.socket.BroadcastAssetRemove(a.fileType, aid, cd.ID)
	return nil
}

func (a *assetsDir) unlink(aid uint64) {
	links := a.assetLinks[aid] - 1
	if links == 0 {
		delete(a.assetLinks, aid)
		a.assetStore.Remove(strconv.FormatUint(aid, 10))
	} else {
		a.assetLinks[aid] = links
	}
}

func (a *assetsDir) rpcFolderDelete(cd ConnData, data []byte) error {
	var folder string
	if err := json.Unmarshal(data, &folder); err != nil {
		return err
	}
	a.assetMu.Lock()
	defer a.assetMu.Unlock()
	parent, oldName, f := a.getParentFolder(folder)
	if parent == nil || f == nil {
		return ErrFolderNotFound
	}
	delete(parent.Folders, oldName)
	walkFolders(f, func(assets map[string]uint64) {
		for _, aid := range assets {
			a.unlink(aid)
		}
	})
	a.saveFolders()
	a.socket.BroadcastFolderRemove(a.fileType, folder, cd.ID)
	return nil
}

func (a *assetsDir) rpcLinkAsset(cd ConnData, data []byte) (string, error) {
	var link struct {
		ID   uint64 `json:"id"`
		Path string `json:"path"`
	}
	if err := json.Unmarshal(data, &link); err != nil {
		return "", err
	}
	a.assetMu.Lock()
	defer a.assetMu.Unlock()
	if _, ok := a.assetLinks[link.ID]; !ok {
		return "", ErrAssetNotFound
	}
	parent, name, _ := a.getFolderAsset(link.Path)
	if parent == nil {
		return "", ErrFolderNotFound
	}
	if name == "" {
		name = strconv.FormatUint(link.ID, 10)
	}
	newName := addAssetTo(parent.Assets, name, link.ID)
	a.saveFolders()
	link.Path = link.Path[:len(link.Path)-len(name)] + newName
	a.socket.BroadcastAssetLink(a.fileType, link, cd.ID)
	return link.Path, nil
}
