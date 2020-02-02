package battlemap

import (
	"encoding/json"
	"path"
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
	return newName, nil
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
	return newName, nil
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
	return "", nil
}

func (a *assetsDir) rpcAssetDelete(cd ConnData, data []byte) error {
	return nil
}

func (a *assetsDir) rpcFolderDelete(cd ConnData, data []byte) error {
	return nil
}

func (a *assetsDir) rpcLinkAsset(cd ConnData, data []byte) (string, error) {
	return "", nil
}
