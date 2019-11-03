package battlemap

import "encoding/json"

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

const (
	SocketConfig uint8 = iota + 1
	SocketAssets
	SocketMaps
	SocketMap
	SocketCharacters
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
	data, _ := json.Marshal(RPCResponse{
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
	for c, m := range s.conns {
		c.mu.RLock()
		id := c.ID
		c.mu.RUnlock()
		if m&SocketMaps > 0 && except != id {
			go c.rpc.SendData(data)
		}
	}
	s.mu.RUnlock()
}

func (s *socket) BroadcastAssetsAdd(assets Assets, except ID) {
	s.broadcastAdminChange(SocketAssets, broadcastAssetAdd, assets, except)
}

func (s *socket) BroadcastAssetChange(as *Asset, except ID) {
	s.broadcastAdminChange(SocketAssets, broadcastAssetChange, as, except)
}

func (s *socket) BroadcastAssetRemove(id uint64, except ID) {
	s.broadcastAdminChange(SocketAssets, broadcastAssetRemove, id, except)
}

func (s *socket) BroadcastTagsAdd(tags Tags, except ID) {
	s.broadcastAdminChange(SocketAssets, broadcastTagAdd, tags, except)
}

func (s *socket) BroadcastTagsChange(tags Tags, except ID) {
	s.broadcastAdminChange(SocketAssets, broadcastTagChange, tags, except)
}

func (s *socket) BroadcastMapAdd(mp *Map, except ID) {
	s.broadcastAdminChange(SocketMaps, broadcastMapAdd, mp, except)
}

func (s *socket) BroadcastMapRename(mp *Map, except ID) {
	s.broadcastAdminChange(SocketMaps, broadcastMapRename, mp, except)
}

func (s *socket) BroadcastMapRemove(mID uint64, except ID) {
	s.broadcastAdminChange(SocketMaps, broadcastMapRemove, mID, except)
}

func (s *socket) BroadcastMapOrderChange(maps Maps, except ID) {
	//s.broadcastAdminChange(SocketMaps, broadcastMapOrderChange, MapOrder(maps), except)
}

func (s *socket) BroadcastCharacterAdd(char map[string]string, except ID) {
	s.broadcastAdminChange(SocketCharacters, broadcastCharacterAdd, char, except)
}

func (s *socket) BroadcastCharacterChange(char map[string]string, except ID) {
	s.broadcastAdminChange(SocketCharacters, broadcastCharacterChange, char, except)
}

func (s *socket) BroadcastCharacterRemove(cID uint64, except ID) {
	s.broadcastAdminChange(SocketCharacters, broadcastCharacterRemove, cID, except)
}

func (s *socket) BroadcastMaskChange(cID uint64, except ID) {

}

func (s *socket) BroadcastMapChange(m *Map, except ID) {

}

func (s *socket) BroadcastTagRemove(tags []uint64, except ID) {

}

func (s *socket) broadcastMapChange(mID uint64, id uint64, data interface{}, except ID) {
	dat, _ := json.Marshal(RPCResponse{
		ID:     int(id),
		Result: data,
	})
	s.mu.RLock()
	for c, m := range s.conns {
		c.mu.RLock()
		id := c.ID
		currentMap := c.CurrentMap
		c.mu.RUnlock()
		if currentMap == mID && id != except && m&SocketMap > 0 {
			go c.rpc.SendData(dat)
		}
	}
	s.mu.RUnlock()
}

func (s *socket) broadcastAdminChange(socket uint8, id int64, data interface{}, except ID) {
	dat, _ := json.Marshal(RPCResponse{
		ID:     int(id),
		Result: data,
	})
	s.mu.RLock()
	for c, m := range s.conns {
		c.mu.RLock()
		id := c.ID
		c.mu.RUnlock()
		if id > 0 && id != except && m&socket > 0 {
			go c.rpc.SendData(dat)
		}
	}
	s.mu.RUnlock()
}
