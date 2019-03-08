package main

import "encoding/json"

const (
	broadcastIsAdmin = -1 - iota
	broadcastCurrentUserMap
	broadcastMapChange
	broadcastAssetChange
	broadcastCharChange
	broadcastTokenChange
)

func (s *socket) KickAdmins(except ID) {
	s.mu.RLock()
	for c := range s.conns {
		c.mu.RLock()
		isAdmin := c.IsAdmin
		c.mu.RUnlock()
		if isAdmin {
			if except != c.ID {
				go c.kickAdmin()
			}
		}
	}
	s.mu.RUnlock()
}
func (c *conn) kickAdmin() {
	c.mu.Lock()
	c.IsAdmin = false
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
		if !c.IsAdmin {
			c.CurrentMap = currentUserMap
		}
		c.mu.Unlock()
	}
	for c, m := range s.conns {
		if m&SocketMaps > 0 && except != c.ID {
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
		if c.ID == except || m&SocketMaps == 0 {
			continue
		}
		c.mu.RLock()
		currentMap := c.CurrentMap
		c.mu.RUnlock()
		if currentMap == mapID {
			go c.rpc.SendData(data)
		}
	}
	s.mu.RUnlock()
}

func (s *socket) BroadcastAssetChange(change interface{}, except ID) {
	data, _ := json.Marshal(RPCResponse{
		ID:     broadcastAssetChange,
		Result: change,
	})
	s.mu.RLock()
	for c, m := range s.conns {
		if c.ID == except || m&SocketMaps == 0 {
			continue
		}
		c.mu.RLock()
		isAdmin := c.IsAdmin
		c.mu.RUnlock()
		if isAdmin {
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
		if c.ID == except || m&SocketMaps == 0 {
			continue
		}
		c.mu.RLock()
		isAdmin := c.IsAdmin
		currentMap := c.CurrentMap
		c.mu.RUnlock()
		if isAdmin && currentMap == mapID {
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
		if c.ID == except || m&SocketCharacters == 0 {
			continue
		}
		c.mu.RLock()
		isAdmin := c.IsAdmin
		c.mu.RUnlock()
		if isAdmin {
			go c.rpc.SendData(data)
		}
	}
	s.mu.RUnlock()
}
