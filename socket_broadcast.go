package battlemap

import (
	"encoding/json"

	"vimagination.zapto.org/jsonrpc"
)

const (
	broadcastIsAdmin = -1 - iota
	broadcastCurrentUserMap

	broadcastImageFolderAdd
	broadcastAudioFolderAdd
	broadcastCharacterFolderAdd
	broadcastImageFolderMove
	broadcastAudioFolderMove
	broadcastCharacterFolderMove
	broadcastImageFolderRemove
	broadcastAudioFolderRemove
	broadcastCharacterFolderRemove
	broadcastImageItemAdd
	broadcastAudioItemAdd
	broadcastCharacterItemAdd
	broadcastImageItemMove
	broadcastAudioItemMove
	broadcastCharacterItemMove
	broadcastImageItemLink
	broadcastAudioItemLink
	broadcastCharacterItemLink
	broadcastImageItemRemove
	broadcastAudioItemRemove
	broadcastCharacterItemRemove
	broadcastCharacterItemChange

	broadcastMapAdd
	broadcastLayerAdd
	broadcastMapRename
	broadcastLayerRename
	broadcastMapRemove
	broadcastLayerRemove
	broadcastMapOrderChange
	broadcastLayerOrderChange

	broadcastMapDimensionsChange
	broadcastMapGridChange
	broadcastMapLightChange

	broadcastMapInitiative

	broadcastLayerShow
	broadcastLayerHide
	broadcaseLayerMaskAdd
	broadcastLayerMaskChange
	broadcastLayerMaskRemove
	broadcastLayerTokenOrder

	broadcastTokenAdd
	broadcastTokenRemove
	broadcastTokenMove
	broadcastTokenResize
	broadcastTokenRotate
	broadcastTokenSetToken
	broadcastTokenSetImage
	broadcastTokenSetPattern
)

func (s *socket) KickAdmins(except ID) {
	s.mu.RLock()
	for c := range s.conns {
		c.mu.RLock()
		id := c.ID
		c.mu.RUnlock()
		if id > 0 && id != except {
			go c.kickAdmin()
		}
	}
	s.mu.RUnlock()
}
func (c *conn) kickAdmin() {
	c.mu.Lock()
	c.ID = 0
	c.mu.Unlock()
	c.rpc.SendData(loggedOut)
}

func (s *socket) SetCurrentUserMap(currentUserMap uint64, except ID) {
	data, _ := json.Marshal(jsonrpc.Response{
		ID:     broadcastCurrentUserMap,
		Result: currentUserMap,
	})
	s.mu.RLock()
	for c := range s.conns {
		c.mu.Lock()
		if c.ID == 0 {
			c.CurrentMap = currentUserMap
		}
		c.mu.Unlock()
	}
	for c := range s.conns {
		c.mu.RLock()
		id := c.ID
		c.mu.RUnlock()
		if except != id {
			go c.rpc.SendData(data)
		}
	}
	s.mu.RUnlock()
}

func (s *socket) broadcastMapChange(mID uint64, id int, data interface{}, except ID) {
	dat, _ := json.Marshal(jsonrpc.Response{
		ID:     id,
		Result: data,
	})
	s.mu.RLock()
	for c := range s.conns {
		c.mu.RLock()
		id := c.ID
		currentMap := c.CurrentMap
		c.mu.RUnlock()
		if currentMap == mID && id != except {
			go c.rpc.SendData(dat)
		}
	}
	s.mu.RUnlock()
}

func (s *socket) broadcastAdminChange(id int, data interface{}, except ID) {
	dat, _ := json.Marshal(jsonrpc.Response{
		ID:     id,
		Result: data,
	})
	s.mu.RLock()
	for c := range s.conns {
		c.mu.RLock()
		id := c.ID
		c.mu.RUnlock()
		if id > 0 && id != except {
			go c.rpc.SendData(dat)
		}
	}
	s.mu.RUnlock()
}
