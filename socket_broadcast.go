package main

import "encoding/json"

const (
	broadcastIsAdmin = -1 - iota
	broadcastCurrentUserMap
)

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
	s.mu.RUnlock()
	s.Broadcast(SocketMaps, data, except)
}

func (s *socket) Broadcast(mask uint8, data []byte, except ID) {
	s.mu.RLock()
	for c, m := range s.conns {
		if mask&m > 0 && except != c.ID {
			go c.rpc.SendData(data)
		}
	}
	s.mu.RUnlock()
}

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
