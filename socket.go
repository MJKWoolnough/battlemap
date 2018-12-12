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

func (s *socket) Init(types ...interface{}) error {
	s.admins = make(userMap)
	s.users = make(userMap)
	s.server = rpc.NewServer()
	for _, t := range types {
		err := s.server.Register(t)
		if err != nil {
			return errors.WithContext("error registering RPC type: ", err)
		}
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
