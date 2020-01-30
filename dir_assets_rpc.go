package battlemap

import (
	"encoding/json"

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
		case "assetRename":
			return a.rpcAssetRename(cd, data)
		case "assetDelete":
			return nil, a.rpcAssetDelete(cd, data)
		case "assetMove":
			return a.rpcAssetMove(cd, data)
		case "assetLink":
			return a.rpcAssetLink(cd, data)
		case "folderCreate":
			return a.rpcFolderCreate(cd, data)
		case "folderMove":
			return a.rpcFolderMove(cd, data)
		case "folderDelete":
			return nil, a.rpcFolderDelete(cd, data)
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

func (a *assetsDir) rpcAssetRename(cd ConnData, data []byte) (string, error) {
	return "", nil
}

func (a *assetsDir) rpcAssetDelete(cd ConnData, data []byte) error {
	return nil
}

func (a *assetsDir) rpcAssetMove(cd ConnData, data []byte) (string, error) {
	return "", nil
}

func (a *assetsDir) rpcAssetLink(cd ConnData, data []byte) (string, error) {
	return "", nil
}

func (a *assetsDir) rpcFolderCreate(cd ConnData, data []byte) (string, error) {
	return "", nil
}

func (a *assetsDir) rpcFolderMove(cd ConnData, data []byte) (string, error) {
	return "", nil
}

func (a *assetsDir) rpcFolderDelete(cd ConnData, data []byte) error {
	return nil
}
