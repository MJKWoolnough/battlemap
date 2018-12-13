package main

import (
	"fmt"
	"io"
	"net"
	"net/rpc"
	"sync"

	"golang.org/x/net/websocket"
	"vimagination.zapto.org/errors"
)

type userMap map[string]*websocket.Conn

type socket struct {
	server *rpc.Server

	userMu        sync.Mutex
	admins, users userMap
}

func (s *socket) Init() error {
	s.admins = make(userMap)
	s.users = make(userMap)
	s.server = rpc.NewServer()
	err := s.server.Register(&Config)
	if err != nil {
		return errors.WithContext("error registering RPC type: ", err)
	}
	return nil
}

func (s *socket) ServeConn(conn *websocket.Conn) {
	r := conn.Request()
	admin := Auth.IsAdmin(r)
	var list userMap
	if admin {
		_, err := io.WriteString(conn, "{\"id\": -1, \"result\": {\"admin\": true}}")
		if err != nil {
			return
		}
		list = s.admins
	} else {
		Config.RLock()
		currentMap := Config.CurrentUserMap
		Config.RUnlock()
		_, err := fmt.Fprintf(conn, "{\"id\": -1, \"result\": {\"admin\": false, \"map\": %d]}", currentMap)
		if err != nil {
			return
		}
		list = s.users
	}
	s.userMu.Lock()
	list[r.RemoteAddr] = conn
	s.userMu.Unlock()
	if admin {
		s.server.ServeConn(conn)
	} else {
		var (
			buf [1]byte
			err error
		)
		for {
			_, err = conn.Read(buf[:])
			if ne := err.(net.Error); ne.Temporary() || ne.Timeout() {
				continue
			}
			break
		}
	}
	s.userMu.Lock()
	delete(list, r.RemoteAddr)
	s.userMu.Unlock()
}

func (s *socket) Broadcast(data []byte, requireAdmin bool) {
	s.userMu.Lock()
	for _, c := range s.admins {
		go c.Write(data)
	}
	if !requireAdmin {
		for _, c := range s.users {
			go c.Write(data)
		}
	}
	s.userMu.Unlock()
}

func (s *socket) KickAdmins() {
	s.userMu.Lock()
	for _, c := range s.admins {
		go c.WriteClose(4000)
	}
	s.userMu.Unlock()
}

var Socket socket

func (c *config) GetAdminMap(_ struct{}, id *uint) error {
	c.RLock()
	*id = Config.CurrentAdminMap
	c.RUnlock()
	return nil
}

func (c *config) GetUserMap(_ struct{}, id *uint) error {
	c.RLock()
	*id = Config.CurrentUserMap
	c.RUnlock()
	return nil
}

func (c *config) SetAdminMap(id uint, _ *struct{}) error {
	Config.Lock()
	Config.CurrentAdminMap = id
	Config.Unlock()
	return nil
}

func (c *config) SetUserMap(id uint, _ *struct{}) error {
	Config.Lock()
	Config.CurrentUserMap = id
	Config.Unlock()
	return nil
}
