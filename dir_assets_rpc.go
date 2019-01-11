package main

import (
	"encoding/json"
	"os"
	"strings"

	"golang.org/x/net/websocket"
)

func (a *assetsDir) WebSocket(conn *websocket.Conn) {
	NewRPC(conn, a.RPC).Handle()
}

func (a *assetsDir) RPC(method string, data []byte) (interface{}, error) {
	switch strings.TrimPrefix(method, "assets.") {
	case "deleteAsset":
		var id uint
		if err := json.Unmarshal(data, &id); err != nil {
			return nil, err
		}
		a.assetMu.Lock()
		var err error
		if asset, ok := a.assets[id]; ok {
			err = a.deleteAsset(asset)
			if err == nil {
				var fs os.FileInfo
				fs, err = os.Stat(a.location)
				if err == nil {
					a.genAssetsHandler(fs.ModTime())
				}
			}
		} else {
			err = ErrUnknownAsset
		}
		a.assetMu.Lock()
		return id, err
	case "renameAsset":
		var idName struct {
			ID   uint   `json:"id"`
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
			}
		}
		newName := asset.Name
		a.assetMu.Unlock()
		if !ok {
			return nil, ErrUnknownAsset
		}

		return newName, nil
	case "addTagsToAsset":
		var idTags struct {
			ID   uint   `json:"id"`
			Tags []uint `json:"tags"`
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
			}
		}
		a.tagMu.Unlock()
		a.assetMu.Unlock()
		if !ok {
			return nil, ErrUnknownAsset
		}
		return change, nil
	case "removeTagsFromAsset":
		var idTags struct {
			ID   uint   `json:"id"`
			Tags []uint `json:"tags"`
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
			}
		}
		a.tagMu.Unlock()
		a.assetMu.Unlock()
		if !ok {
			return nil, ErrUnknownAsset
		}
		return change, nil
	case "getAssets":
		a.assetHandlerMu.RLock()
		ret := a.assetJSON
		a.assetHandlerMu.RUnlock()
		return ret, nil
	case "addTag":
		var tagName string
		if err := json.Unmarshal(data, &tagName); err != nil {
			return nil, err
		}
		a.tagMu.Lock()
		tag := a.addTag(tagName)
		a.writeTags()
		a.tagMu.Unlock()
		return tag.ID, nil
	case "deleteTag":
		var id uint
		err := json.Unmarshal(data, &id)
		if err != nil {
			return nil, err
		}
		a.assetMu.Lock() // must lock in this order
		a.tagMu.Lock()
		tag, ok := a.tags[id]
		if ok {
			a.deleteTags(tag)
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
	case "renameTag":
		var idName struct {
			ID   uint   `json:"id"`
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
			}
		}
		newName := tag.Name
		a.tagMu.Unlock()
		if !ok {
			return nil, ErrUnknownTag
		}
		return newName, nil
	case "getTags":
		a.tagHandlerMu.RLock()
		ret := a.tagJSON
		a.tagHandlerMu.RUnlock()
		return ret, nil
	}
	return nil, ErrUnknownEndpoint
}
