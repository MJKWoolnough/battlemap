package main

import (
	"crypto/rand"
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

type SocketHandler interface {
	RPC(connData ConnData, method string, data []byte) (interface{}, error)
}

func (s *socket) RunConn(wconn *websocket.Conn, handler SocketHandler, mask uint8) {
	var cu keystore.Uint64
	Config.Get("currentUserMap", &cu)
	c := conn{
		ConnData: ConnData{
			IsAdmin:    Auth.IsAdmin(wconn.Request()),
			CurrentMap: uint64(cu),
		},
	}
	rand.Read(c.ID[:])
	if handler == nil {
		handler = &c
	}
	c.rpc = NewRPC(wconn, RPCHandlerFunc(func(method string, data []byte) (interface{}, error) {
		c.mu.RLock()
		cd := c.ConnData
		c.mu.RUnlock()
		switch method {
		case "auth.loggedIn":
			return cd.IsAdmin, nil
		case "conn.connID":
			return cd.ID[:], nil
		case "maps.getCurrentMap":
			return cd.CurrentMap, nil
		default:
			return handler.RPC(cd, method, data)
		}
	}))
	s.mu.Lock()
	s.conns[&c] = mask
	s.mu.Unlock()
	if c.IsAdmin {
		c.rpc.SendData(loggedIn)
	} else {
		c.rpc.SendData(loggedOut)
	}
	if mask&SocketMaps > 0 {
		c.rpc.Send(RPCResponse{
			ID:     -2,
			Result: cu,
		})
	}
	c.rpc.Handle()
	s.mu.Lock()
	delete(s.conns, &c)
	s.mu.Unlock()
}

func (s *socket) SetCurrentUserMap(currentUserMap uint64) {
	data, _ := json.Marshal(RPCResponse{
		ID:     -2,
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
		isAdmin := c.IsAdmin
		c.mu.RUnlock()
		if isAdmin {
			go c.kickAdmin()
		}
	}
	s.mu.RUnlock()
}

type conn struct {
	rpc *RPC

	mu sync.RWMutex
	ConnData
}

type ConnData struct {
	CurrentMap uint64
	IsAdmin    bool

	ID [64]byte
}

func (c *conn) RPC(cd ConnData, method string, data []byte) (interface{}, error) {
	pos := strings.IndexByte(method, '.')
	submethod := method[pos+1:]
	method = method[:pos]
	switch method {
	case "auth":
		if cd.IsAdmin {
			switch submethod {
			case "logout":
				c.mu.Lock()
				c.IsAdmin = false
				c.mu.Unlock()
				c.rpc.SendData(loggedOut)
				return nil, nil
			case "changePassword":
				var password string
				json.Unmarshal(data, &password)
				c.mu.Lock()
				c.IsAdmin = false
				c.mu.Unlock()
				sessionData := Auth.UpdatePasswordGetData(password)
				c.mu.Lock()
				c.IsAdmin = true
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
			c.IsAdmin = true
			c.mu.Unlock()
			c.rpc.SendData(loggedIn)
			return sessionData, nil
		}
	case "assets":
		if cd.IsAdmin {
			return AssetsDir.RPC(cd, submethod, data)
		}
	case "maps":
		if submethod == "getUserMap" {
			var currentUserMap keystore.Uint64
			Config.Get("currentUserMap", &currentUserMap)
			return currentUserMap, nil
		} else if cd.IsAdmin {
			return MapsDir.RPC(cd, method, data)
		}
	case "characters":
		if cd.IsAdmin {
			return CharsDir.RPC(cd, submethod, data)
		}
	case "tokens":
		if cd.IsAdmin {
			return TokensDir.RPC(cd, submethod, data)
		}
	}
	return nil, ErrUnknownMethod
}

func (c *conn) kickAdmin() {
	c.mu.Lock()
	c.IsAdmin = false
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
