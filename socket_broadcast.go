package battlemap

import (
	"encoding/json"
)

const (
	broadcastIsAdmin = -1 - iota
	broadcastCurrentUserMap
	broadcastCurrentUserMapData

	broadcastImageItemAdd
	broadcastAudioItemAdd
	broadcastCharacterItemAdd
	broadcastMapItemAdd

	broadcastImageItemMove
	broadcastAudioItemMove
	broadcastCharacterItemMove
	broadcastMapItemMove

	broadcastImageItemRemove
	broadcastAudioItemRemove
	broadcastCharacterItemRemove
	broadcastMapItemRemove

	broadcastImageItemLink
	broadcastAudioItemLink
	broadcastCharacterItemLink
	broadcastMapItemLink

	broadcastImageFolderAdd
	broadcastAudioFolderAdd
	broadcastCharacterFolderAdd
	broadcastMapFolderAdd

	broadcastImageFolderMove
	broadcastAudioFolderMove
	broadcastCharacterFolderMove
	broadcastMapFolderMove

	broadcastImageFolderRemove
	broadcastAudioFolderRemove
	broadcastCharacterFolderRemove
	broadcastMapFolderRemove

	broadcastCharacterItemChange
	broadcastMapItemChange

	broadcastLayerAdd
	broadcastLayerFolderAdd
	broadcastLayerMove
	broadcastLayerRename
	broadcastLayerRemove

	broadcastMapLightChange

	broadcastMapInitiative

	broadcastLayerShow
	broadcastLayerHide
	broadcastLayerMaskAdd
	broadcastLayerMaskChange
	broadcastLayerMaskRemove

	broadcastTokenAdd
	broadcastTokenRemove
	broadcastTokenMoveLayer
	broadcastTokenMovePos
	broadcastTokenSetToken
	broadcastTokenSetImage
	broadcastTokenSetPattern
	broadcastTokenChange
	broadcastTokenFlip
	broadcastTokenFlop
	broadcastTokenSnap
	broadcastTokenSourceChange
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

const broadcastStart = "{\"id\": -0,\"result\":"

func buildBroadcast(id int, data json.RawMessage) []byte {
	l := len(broadcastStart) + len(data) + 1
	dat := make([]byte, l)
	copy(dat, broadcastStart)
	copy(dat[len(broadcastStart):], data)
	id = -id
	if id > 9 {
		dat[6] = '-'
		dat[7] = byte('0' + id/10)
	}
	dat[8] = byte('0' + id%10)
	dat[l-1] = '}'
	return dat
}

func (s *socket) SetCurrentUserMap(currentUserMap uint64, data, mData json.RawMessage, except ID) {
	dat := buildBroadcast(broadcastCurrentUserMap, data)
	mdat := buildBroadcast(broadcastCurrentUserMapData, mData)
	s.mu.RLock()
	for c := range s.conns {
		c.mu.Lock()
		id := c.ID
		if c.IsAdmin() {
			if except != id {
				go c.rpc.SendData(dat)
			}
		} else {
			c.CurrentMap = currentUserMap
			go c.rpc.SendData(mdat)
		}
		c.mu.Unlock()
	}
	s.mu.RUnlock()
}

func (s *socket) broadcastMapChange(cd ConnData, id int, data json.RawMessage) {
	dat := buildBroadcast(id, data)
	s.mu.RLock()
	for c := range s.conns {
		c.mu.RLock()
		id := c.ID
		currentMap := c.CurrentMap
		c.mu.RUnlock()
		if currentMap == cd.CurrentMap && id != cd.ID {
			go c.rpc.SendData(dat)
		}
	}
	s.mu.RUnlock()
}

func (s *socket) broadcastAdminChange(id int, data json.RawMessage, except ID) {
	dat := buildBroadcast(id, data)
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

type idName struct {
	ID   uint64 `json:"id"`
	Name string `json:"name"`
}
