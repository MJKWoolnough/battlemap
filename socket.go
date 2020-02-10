package battlemap

import (
	"encoding/json"
	"net/http"
	"strconv"
	"strings"
	"sync"

	"golang.org/x/net/websocket"
	"vimagination.zapto.org/errors"
	"vimagination.zapto.org/jsonrpc"
	"vimagination.zapto.org/keystore"
)

type socket struct {
	*Battlemap
	mu     sync.RWMutex
	conns  map[*conn]struct{}
	nextID ID
}

func (s *socket) Init(b *Battlemap) error {
	s.Battlemap = b
	s.conns = make(map[*conn]struct{})
	return nil
}

func (s *socket) ServeConn(wconn *websocket.Conn) {
	var cu keystore.Uint64
	s.config.Get("currentUserMap", &cu)
	a := s.auth.AuthConn(wconn)
	var c conn
	s.mu.Lock()
	s.nextID++
	id := s.nextID
	s.conns[&c] = struct{}{}
	s.mu.Unlock()
	c = conn{
		Battlemap: s.Battlemap,
		rpc:       jsonrpc.New(wconn, &c),
		ConnData: ConnData{
			CurrentMap: uint64(cu),
			ID:         id,
			AuthConn:   a,
		},
	}
	c.rpc.Send(jsonrpc.Response{
		ID:     -2,
		Result: cu,
	})
	c.rpc.Handle()
	s.mu.Lock()
	delete(s.conns, &c)
	s.mu.Unlock()
}

type AuthConn interface {
	IsAdmin() bool
	RPCData(connData ConnData, method string, data []byte) (interface{}, error)
}

type conn struct {
	*Battlemap
	rpc *jsonrpc.Server

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
	AuthConn
}

func (c *conn) HandleRPC(method string, data []byte) (interface{}, error) {
	c.mu.RLock()
	cd := c.ConnData
	c.mu.RUnlock()
	pos := strings.IndexByte(method, '.')
	if method[:pos] == "auth" {
		return cd.RPCData(cd, method[pos+1:], data)
	}
	switch method {
	case "conn.connID":
		return cd.ID, nil
	case "maps.setCurrentMap":
		if !cd.IsAdmin() {
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
		submethod := method[pos+1:]
		method = method[:pos]
		switch method {
		case "imageAssets":
			if cd.IsAdmin() {
				return c.images.RPCData(cd, submethod, data)
			}
		case "audioAssets":
			if cd.IsAdmin() {
				return c.sounds.RPCData(cd, submethod, data)
			}
		case "maps":
			if submethod == "getUserMap" {
				var currentUserMap keystore.Uint64
				c.config.Get("currentUserMap", &currentUserMap)
				return currentUserMap, nil
			} else if cd.IsAdmin() {
				return c.maps.RPCData(cd, submethod, data)
			}
		case "characters":
			if cd.IsAdmin() {
				return c.chars.RPCData(cd, submethod, data)
			}
		case "tokens":
			if cd.IsAdmin() {
				return c.tokens.RPCData(cd, submethod, data)
			}
		}
	}
	return nil, ErrUnknownMethod
}

const (
	ErrUnknownMethod   errors.Error = "unknown method"
	ErrInvalidPassword errors.Error = "invalid password"
)
