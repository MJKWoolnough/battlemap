package main

import "encoding/json"

const (
	broadcastIsAdmin = -1 - iota
	broadcastCurrentUserMap
	broadcastMapChange
	broadcastAssetAdd
	broadcastAssetChange
	broadcastAssetRemove
	broadcastTagAdd
	broadcastTagRemove
	broadcastCharChange
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

func (s *socket) BroadcastMapChange(mapID uint64, change interface{}, except ID) {
	data, _ := json.Marshal(RPCResponse{
		ID:     broadcastMapChange,
		Result: change,
	})
	s.mu.RLock()
	for c, m := range s.conns {
		c.mu.RLock()
		id := c.ID
		currentMap := c.CurrentMap
		c.mu.RUnlock()
		if id != except && m&SocketMaps > 0 && currentMap == mapID {
			go c.rpc.SendData(data)
		}
	}
	s.mu.RUnlock()
}

func (s *socket) BroadcastAssetAdd(change Assets, except ID) {
	s.broadcastAssetChange(broadcastAssetAdd, change, except)
}

func (s *socket) BroadcastAssetChange(asset *Asset, except ID) {
	s.broadcastAssetChange(broadcastAssetChange, asset, except)
}

func (s *socket) BroadcastAssetRemove(assetID uint64, except ID) {
	s.broadcastAssetChange(broadcastAssetRemove, assetID, except)
}

func (s *socket) BroadcastTagAdd(tags Tags, except ID) {
	s.broadcastAssetChange(broadcastTagAdd, tags, except)
}

func (s *socket) BroadcastTagRemove(tags []uint64, except ID) {
	s.broadcastAssetChange(broadcastTagRemove, tags, except)
}

func (s *socket) broadcastAssetChange(id int, change interface{}, except ID) {
	data, _ := json.Marshal(RPCResponse{
		ID:     id,
		Result: change,
	})
	s.mu.RLock()
	for c, m := range s.conns {
		c.mu.RLock()
		id := c.ID
		c.mu.RUnlock()
		if id != except && m&SocketMaps > 0 && id > 0 {
			go c.rpc.SendData(data)
		}
	}
	s.mu.RUnlock()
}

func (s *socket) BroadcastTokenChange(mapID uint64, change interface{}, except ID) {
	data, _ := json.Marshal(RPCResponse{
		ID:     broadcastTokenChange,
		Result: change,
	})
	s.mu.RLock()
	for c, m := range s.conns {
		c.mu.RLock()
		id := c.ID
		currentMap := c.CurrentMap
		c.mu.RUnlock()
		if id != except && m&SocketMaps > 0 && currentMap == mapID {
			go c.rpc.SendData(data)
		}
	}
	s.mu.RUnlock()
}

func (s *socket) BroadcastCharChange(change interface{}, except ID) {
	data, _ := json.Marshal(RPCResponse{
		ID:     broadcastCharChange,
		Result: change,
	})
	s.mu.RLock()
	for c, m := range s.conns {
		c.mu.RLock()
		id := c.ID
		c.mu.RUnlock()
		if id > 0 && id != except && m&SocketCharacters > 0 {
			go c.rpc.SendData(data)
		}
	}
	s.mu.RUnlock()
}

func (s *socket) BroadcastMaskChange(id uint64, except ID) {
	data, _ := json.Marshal(RPCResponse{
		ID:     BroadcastMaskChange,
		Result: id,
	})
	s.mu.RLock()
	for c, m := range s.conns {
		c.mu.RLock()
		id := c.ID
		c.mu.RUnlock()
		if id > 0 && id != except && m&SocketMaps > 0 {
			go c.rpc.SendData(data)
		}
	}
	s.mu.RUnlock()
}
