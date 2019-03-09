package main

import (
	"encoding/json"
	"os"
	"strings"

	"golang.org/x/net/websocket"
)

func (a *assetsDir) WebSocket(conn *websocket.Conn) {
	Socket.RunConn(conn, a, SocketAssets)
}

func (a *assetsDir) RPC(cd ConnData, method string, data []byte) (interface{}, error) {
	if cd.IsAdmin {
		switch strings.TrimPrefix(method, "assets.") {
		case "deleteAsset":
			return a.rpcDeleteAsset(data, cd)
		case "renameAsset":
			return a.rpcRenameAsset(data, cd)
		case "addTagsToAsset":
			return a.rpcAddTagsToAsset(data, cd)
		case "removeTagsFromAsset":
			return a.rpcRemoveTagsFromAsset(data, cd)
		case "getAssets":
			return a.rpcGetAssets(data)
		case "addTag":
			return a.rpcAddTag(data, cd)
		case "deleteTag":
			return a.rpcDeleteTag(data, cd)
		case "renameTag":
			return a.rpcRenameTag(data, cd)
		case "getTags":
			return a.rpcGetTags(data)
		}
	}
	return nil, ErrUnknownMethod
}

func (a *assetsDir) rpcDeleteAsset(data []byte, cd ConnData) (interface{}, error) {
	var id uint64
	if err := json.Unmarshal(data, &id); err != nil {
		return nil, err
	}
	a.assetMu.Lock()
	var err error
	if asset, ok := a.assets[id]; ok {
		err = a.deleteAsset(asset)
		if err == nil {
			var fs os.FileInfo
			fs, err = a.assetStore.Stat("")
			if err == nil {
				a.genAssetsHandler(fs.ModTime())
			}
		}
		Socket.BroadcastAssetRemove(id, cd.ID)
	} else {
		err = ErrUnknownAsset
	}
	a.assetMu.Unlock()
	return id, err
}

func (a *assetsDir) rpcRenameAsset(data []byte, cd ConnData) (interface{}, error) {
	var idName struct {
		ID   uint64 `json:"id"`
		Name string `json:"name"`
	}
	if err := json.Unmarshal(data, &idName); err != nil {
		return nil, err
	}
	a.assetMu.Lock()
	asset, ok := a.assets[idName.ID]
	if ok {
		if a.renameAsset(asset, idName.Name) {
			a.writeAsset(idName.ID, true)
			Socket.BroadcastAssetChange(asset, cd.ID)
		}
	}
	newName := asset.Name
	a.assetMu.Unlock()
	if !ok {
		return nil, ErrUnknownAsset
	}
	return newName, nil
}

func (a *assetsDir) rpcAddTagsToAsset(data []byte, cd ConnData) (interface{}, error) {
	var idTags struct {
		ID   uint64   `json:"id"`
		Tags []uint64 `json:"tags"`
	}
	if err := json.Unmarshal(data, &idTags); err != nil {
		return nil, err
	}
	a.assetMu.Lock()
	a.tagMu.Lock()
	asset, ok := a.assets[idTags.ID]
	var change bool
	if ok {
		change = a.addTagsToAsset(asset, idTags.Tags...)
		if change {
			a.writeAsset(idTags.ID, true)
			Socket.BroadcastAssetChange(asset, cd.ID)
		}
	}
	a.tagMu.Unlock()
	a.assetMu.Unlock()
	if !ok {
		return nil, ErrUnknownAsset
	}
	return change, nil
}

func (a *assetsDir) rpcRemoveTagsFromAsset(data []byte, cd ConnData) (interface{}, error) {
	var idTags struct {
		ID   uint64   `json:"id"`
		Tags []uint64 `json:"tags"`
	}
	if err := json.Unmarshal(data, &idTags); err != nil {
		return nil, err
	}
	a.assetMu.Lock()
	a.tagMu.Lock()
	asset, ok := a.assets[idTags.ID]
	var change bool
	if ok {
		change = a.removeTagsFromAsset(asset, idTags.Tags...)
		if change {
			a.writeAsset(idTags.ID, true)
			Socket.BroadcastAssetChange(asset, cd.ID)
		}
	}
	a.tagMu.Unlock()
	a.assetMu.Unlock()
	if !ok {
		return nil, ErrUnknownAsset
	}
	return change, nil
}

func (a *assetsDir) rpcGetAssets(_ []byte) (interface{}, error) {
	a.assetHandlerMu.RLock()
	ret := a.assetJSON
	a.assetHandlerMu.RUnlock()
	return ret, nil
}

func (a *assetsDir) rpcAddTag(data []byte, cd ConnData) (interface{}, error) {
	var tagName string
	if err := json.Unmarshal(data, &tagName); err != nil {
		return nil, err
	}
	a.tagMu.Lock()
	tag := a.addTag(tagName)
	a.writeTags()
	a.tagMu.Unlock()
	Socket.BroadcastTagAdda(Tags{tag.ID: tag}, cd.ID)
	return tag.ID, nil
}

func (a *assetsDir) rpcDeleteTag(data []byte, cd ConnData) (interface{}, error) {
	var id uint64
	err := json.Unmarshal(data, &id)
	if err != nil {
		return nil, err
	}
	a.assetMu.Lock() // must lock in this order
	a.tagMu.Lock()
	tag, ok := a.tags[id]
	if ok {
		if a.deleteTags(tag) {
			Socket.BroadcastTagRemove([]uint64{id}, cd.ID)
		}
		a.assetMu.Unlock()
		a.writeTags()
	} else {
		a.assetMu.Unlock()
	}
	a.tagMu.Unlock()
	if !ok {
		return nil, ErrUnknownTag
	}
	return id, nil
}

func (a *assetsDir) rpcRenameTag(data []byte, cd ConnData) (interface{}, error) {
	var idName struct {
		ID   uint64 `json:"id"`
		Name string `json:"name"`
	}
	if err := json.Unmarshal(data, &idName); err != nil {
		return nil, err
	}
	a.tagMu.Lock()
	tag, ok := a.tags[idName.ID]
	if ok {
		if a.renameTag(tag, idName.Name) {
			a.writeTags()
			Socket.BroadcastTagAdd(Tags{tag.ID: tag}, cd.ID)
		}
	}
	newName := tag.Name
	a.tagMu.Unlock()
	if !ok {
		return nil, ErrUnknownTag
	}
	return newName, nil
}

func (a *assetsDir) rpcGetTags(_ []byte) (interface{}, error) {
	a.tagHandlerMu.RLock()
	ret := a.tagJSON
	a.tagHandlerMu.RUnlock()
	return ret, nil
}
