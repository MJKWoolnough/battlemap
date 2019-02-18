package main

import (
	"encoding/json"
	"strings"
	"sync"

	"golang.org/x/net/websocket"
	"vimagination.zapto.org/errors"
	"vimagination.zapto.org/keystore"
)

type socket struct {
	mu    sync.RWMutex
	conns map[*conn]uint8
}

func (s *socket) Init() error {
	s.conns = make(map[*conn]uint8)
	return nil
}

func (s *socket) ServeConn(conn *websocket.Conn) {
	s.RunConn(conn, nil, 0xff)
}

func (s *socket) RunConn(wconn *websocket.Conn, handler RPCHandler, mask uint8) {
	var cu keystore.Uint
	Config.Get("currentUserMap", &cu)
	c := conn{
		isAdmin:    Auth.IsAdmin(wconn.Request()),
		currentMap: CurrentMap(cu),
	}
	if handler == nil {
		handler = &c
	}
	c.rpc = NewRPC(wconn, handler)
	s.mu.Lock()
	s.conns[&c] = mask
	s.mu.Unlock()
	if c.isAdmin {
		c.rpc.SendData(loggedIn)
	} else {
		c.rpc.SendData(loggedOut)
	}
	if mask&SocketMaps > 0 {
		c.rpc.Send(RPCResponse{
			ID:     -2,
			Result: uint(cu),
		})
	}
	c.rpc.Handle()
	s.mu.Lock()
	delete(s.conns, &c)
	s.mu.Unlock()
}

func (s *socket) SetCurrentUserMap(currentUserMap CurrentMap) {
	data, _ := json.Marshal(RPCResponse{
		ID:     -2,
		Result: uint(currentUserMap),
	})
	s.mu.RLock()
	for c := range s.conns {
		c.mu.Lock()
		if !c.isAdmin {
			c.currentMap = currentUserMap
		}
		c.mu.Unlock()
	}
	s.mu.RUnlock()
	s.Broadcast(SocketMaps, data)
}

func (s *socket) Broadcast(mask uint8, data []byte) {
	s.mu.RLock()
	for c, m := range s.conns {
		if mask&m > 0 {
			go c.rpc.SendData(data)
		}
	}
	s.mu.RUnlock()
}

func (s *socket) KickAdmins() {
	s.mu.RLock()
	for c := range s.conns {
		c.mu.RLock()
		isAdmin := c.isAdmin
		c.mu.RUnlock()
		if isAdmin {
			go c.kickAdmin()
		}
	}
	s.mu.RUnlock()
}

type conn struct {
	rpc *RPC

	mu         sync.RWMutex
	currentMap CurrentMap
	isAdmin    bool
}

func (c *conn) RPC(method string, data []byte) (interface{}, error) {
	pos := strings.IndexByte(method, '.')
	submethod := method[pos+1:]
	method = method[:pos]
	c.mu.RLock()
	isAdmin := c.isAdmin
	currentMap := c.currentMap
	c.mu.RUnlock()
	switch method {
	case "auth":
		if submethod == "loggedin" {
			return isAdmin, nil
		} else if isAdmin {
			switch submethod {
			case "logout":
				c.mu.Lock()
				c.isAdmin = false
				c.mu.Unlock()
				c.rpc.SendData(loggedOut)
				return nil, nil
			case "changePassword":
				var password string
				json.Unmarshal(data, &password)
				c.mu.Lock()
				c.isAdmin = false
				c.mu.Unlock()
				sessionData := Auth.UpdatePasswordGetData(password)
				c.mu.Lock()
				c.isAdmin = true
				c.mu.Unlock()
				return sessionData, nil
			}
		} else if submethod == "login" {
			var password string
			json.Unmarshal(data, &password)
			sessionData := Auth.LoginGetData(password)
			if len(sessionData) == 0 {
				return nil, ErrInvalidPassword
			}
			c.mu.Lock()
			c.isAdmin = true
			c.mu.Unlock()
			c.rpc.SendData(loggedIn)
			return sessionData, nil
		}
	case "assets":
		if isAdmin {
			return AssetsDir.RPC(submethod, data)
		}
	case "maps":
		if submethod == "getUserMap" {
			var currentUserMap keystore.Uint64
			Config.Get("currentUserMap", &currentUserMap)
			return uint(currentUserMap), nil
		} else if isAdmin {
			return currentMap.RPC(method, data)
		}
	case "characters":
		if isAdmin {
			return CharsDir.RPC(submethod, data)
		}
	case "tokens":
		if isAdmin {
			return TokensDir.RPC(submethod, data)
		}
	}
	return nil, ErrUnknownMethod
}

func (c *conn) kickAdmin() {
	c.mu.Lock()
	c.isAdmin = false
	c.mu.Unlock()
	c.rpc.SendData(loggedOut)
}

var Socket socket

var (
	loggedOut = []byte("{\"id\": -1, \"result\": {\"isAdmin\": false}}")
	loggedIn  = []byte("{\"id\": -1, \"result\": {\"isAdmin\": true}}")
)

const (
	SocketConfig uint8 = iota + 1
	SocketAssets
	SocketMaps
	SocketKeystore
)

const (
	ErrUnknownMethod   errors.Error = "unknown method"
	ErrInvalidPassword errors.Error = "invalid password"
)
