package battlemap

import (
	"encoding/json"
	"net/http"
	"strconv"
	"strings"
	"sync"

	"golang.org/x/net/websocket"
	"vimagination.zapto.org/errors"
	"vimagination.zapto.org/keystore"
)

type socket struct {
	*Battlemap
	mu     sync.RWMutex
	conns  map[*conn]uint8
	nextID ID
}

func (s *socket) Init(b *Battlemap) error {
	s.Battlemap = b
	s.conns = make(map[*conn]uint8)
	return nil
}

func (s *socket) ServeConn(conn *websocket.Conn) {
	s.RunConn(conn, nil, 0xff)
}

type SocketHandler interface {
	RPCData(connData ConnData, method string, data []byte) (interface{}, error)
}

func (s *socket) RunConn(wconn *websocket.Conn, handler SocketHandler, mask uint8) {
	var cu keystore.Uint64
	s.config.Get("currentUserMap", &cu)
	isAdmin := s.auth.IsAdmin(wconn.Request())
	var (
		id ID
		c  conn
	)
	if handler == nil {
		handler = &c
	}
	s.mu.Lock()
	if isAdmin {
		s.nextID++
		id = s.nextID
	}
	s.conns[&c] = mask
	s.mu.Unlock()
	c = conn{
		Battlemap: s.Battlemap,
		rpc:       NewRPC(wconn, &c),
		handler:   handler,
		ConnData: ConnData{
			CurrentMap: uint64(cu),
			ID:         id,
		},
	}
	if isAdmin {
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

type conn struct {
	*Battlemap
	rpc     *RPC
	handler SocketHandler

	mu sync.RWMutex
	ConnData
}

type ID uint64

func SocketIDFromRequest(r *http.Request) ID {
	id, _ := strconv.ParseUint(r.Header.Get("X-ID"), 10, 0)
	return ID(id)
}

type ConnData struct {
	CurrentMap uint64
	ID         ID
}

func (c *conn) RPC(method string, data []byte) (interface{}, error) {
	c.mu.RLock()
	cd := c.ConnData
	c.mu.RUnlock()
	switch method {
	case "auth.loggedIn":
		return cd.ID > 0, nil
	case "conn.connID":
		return cd.ID, nil
	case "maps.getCurrentMap":
		return cd.CurrentMap, nil
	case "maps.setCurrentMap":
		if cd.ID == 0 {
			return nil, ErrUnknownMethod
		}
		if err := json.Unmarshal(data, &cd.CurrentMap); err != nil {
			return nil, err
		}
		c.mu.Lock()
		c.CurrentMap = cd.CurrentMap
		c.mu.Unlock()
		return nil, nil
	default:
		return c.handler.RPCData(cd, method, data)
	}
}

func (c *conn) RPCData(cd ConnData, method string, data []byte) (interface{}, error) {
	pos := strings.IndexByte(method, '.')
	submethod := method[pos+1:]
	method = method[:pos]
	switch method {
	case "auth":
		if cd.ID > 0 {
			switch submethod {
			case "logout":
				c.mu.Lock()
				c.ID = 0
				c.mu.Unlock()
				c.rpc.SendData(loggedOut)
				return nil, nil
			case "changePassword":
				var password string
				json.Unmarshal(data, &password)
				sessionData := c.auth.UpdatePasswordGetData(password, cd.ID)
				return sessionData, nil
			}
		} else if submethod == "login" {
			var password string
			json.Unmarshal(data, &password)
			sessionData := c.auth.LoginGetData(password)
			if len(sessionData) == 0 {
				return nil, ErrInvalidPassword
			}
			c.mu.Lock()
			c.socket.mu.Lock()
			c.socket.nextID++
			c.ID = c.socket.nextID
			c.socket.mu.Unlock()
			c.mu.Unlock()
			c.rpc.SendData(loggedIn)
			return sessionData, nil
		}
	case "assets":
		if cd.ID > 0 {
			return c.assets.RPCData(cd, submethod, data)
		}
	case "maps":
		if submethod == "getUserMap" {
			var currentUserMap keystore.Uint64
			c.config.Get("currentUserMap", &currentUserMap)
			return currentUserMap, nil
		} else if cd.ID > 0 {
			return c.maps.RPCData(cd, method, data)
		}
	case "characters":
		if cd.ID > 0 {
			return c.chars.RPCData(cd, submethod, data)
		}
	case "tokens":
		if cd.ID > 0 {
			return c.tokens.RPCData(cd, submethod, data)
		}
	}
	return nil, ErrUnknownMethod
}

var (
	loggedOut = []byte("{\"id\": -1, \"result\": {\"isAdmin\": false}}")
	loggedIn  = []byte("{\"id\": -1, \"result\": {\"isAdmin\": true}}")
)

const (
	ErrUnknownMethod   errors.Error = "unknown method"
	ErrInvalidPassword errors.Error = "invalid password"
)
