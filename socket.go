package main

import (
	"strings"
	"sync"

	"golang.org/x/net/websocket"
	"vimagination.zapto.org/errors"
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
	Config.Lock()
	currentMap := Config.CurrentUserMap
	Config.Unlock()
	c := conn{
		isAdmin:    Auth.IsAdmin(wconn.Request()),
		currentMap: currentMap,
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
			Result: currentMap,
		})
	}
	c.rpc.Handle()
	s.mu.Lock()
	delete(s.conns, &c)
	s.mu.Unlock()
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
		go c.kickAdmin()

	}
	s.mu.RUnlock()
}

type conn struct {
	rpc *RPC

	mu         sync.RWMutex
	currentMap uint
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
		if isAdmin {
			if submethod == "logout" {
				c.mu.Lock()
				c.isAdmin = false
				c.mu.Unlock()
				return loggedOut, nil
			}
		} else if submethod == "login" {

		}
	case "config":
	case "assets":
		if isAdmin {
			return AssetsDir.RPC(submethod, data)
		}
	case "maps":
		_ = currentMap
	case "characters":
	}
	return nil, ErrUnknownMethod
}

func (c *conn) kickAdmin() {
	c.mu.RLock()
	isAdmin := c.isAdmin
	c.mu.RUnlock()
	if isAdmin {
		c.mu.Lock()
		c.isAdmin = false
		c.mu.Unlock()
		c.rpc.SendData(adminKick)
	}
}

var Socket socket

var (
	loggedOut = []byte("{\"isAdmin\": false}")
	loggedIn  = []byte("{\"isAdmin\": true}")
	adminKick = []byte("{\"id\": -1, \"result\": {\"isAdmin\": false}}")
)

const (
	SocketConfig uint8 = iota + 1
	SocketAssets
	SocketMaps
	SocketCharacters
)

const (
	ErrUnknownMethod errors.Error = "unknown method"
)
