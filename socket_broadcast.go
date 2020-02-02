package battlemap

import (
	"encoding/json"

	"vimagination.zapto.org/jsonrpc"
)

const (
	broadcastIsAdmin = -1 - iota
	broadcastCurrentUserMap
	broadcastMapAdd
	broadcastMapChange
	broadcastMapRename
	broadcastMapRemove
	broadcastMapOrderChange
	broadcastAssetAdd
	broadcastAssetChange
	broadcastAssetRemove
	broadcastTagAdd
	broadcastTagRemove
	broadcastTagChange
	broadcastCharacterAdd
	broadcastCharacterChange
	broadcastCharacterRemove
	broadcastTokenChange
	broadcastMaskChange
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

func (s *socket) BroadcastAssetsAdd(ft fileType, added []idName, except ID) {

}

func (s *socket) BroadcastFolderAdd(ft fileType, dir string, except ID) {

}

func (s *socket) BroadcastAssetMove(ft fileType, am assetMove, except ID) {

}

func (s *socket) BroadcastFolderMove(ft fileType, am folderMove, except ID) {

}

func (s *socket) BroadcastAssetRemove(ft fileType, asset string, except ID) {

}

func (s *socket) BroadcastFolderRemove(ft fileType, folder string, except ID) {

}

func (s *socket) BroadcastAssetLink(ft fileType, link assetLink, except ID) {

}

func (s *socket) BroadcastMapAdd(mp *Map, except ID) {
	s.broadcastAdminChange(broadcastMapAdd, mp, except)
}

func (s *socket) BroadcastMapRename(mp *Map, except ID) {
	s.broadcastAdminChange(broadcastMapRename, mp, except)
}

func (s *socket) BroadcastMapRemove(mID uint64, except ID) {
	s.broadcastAdminChange(broadcastMapRemove, mID, except)
}

func (s *socket) BroadcastMapOrderChange(maps Maps, except ID) {
	//s.broadcastAdminChange(broadcastMapOrderChange, MapOrder(maps), except)
}

func (s *socket) BroadcastCharacterAdd(char map[string]string, except ID) {
	s.broadcastAdminChange(broadcastCharacterAdd, char, except)
}

func (s *socket) BroadcastCharacterChange(char map[string]string, except ID) {
	s.broadcastAdminChange(broadcastCharacterChange, char, except)
}

func (s *socket) BroadcastCharacterRemove(cID uint64, except ID) {
	s.broadcastAdminChange(broadcastCharacterRemove, cID, except)
}

func (s *socket) BroadcastMaskChange(cID uint64, except ID) {

}

func (s *socket) BroadcastMapChange(m *Map, except ID) {

}

func (s *socket) broadcastMapChange(mID uint64, id uint64, data interface{}, except ID) {
	dat, _ := json.Marshal(jsonrpc.Response{
		ID:     int(id),
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

func (s *socket) broadcastAdminChange(id int64, data interface{}, except ID) {
	dat, _ := json.Marshal(jsonrpc.Response{
		ID:     int(id),
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
