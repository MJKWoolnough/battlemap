package battlemap

import (
	"encoding/json"
	"errors"
	"net/http"
	"strconv"
	"strings"
	"sync"
	"sync/atomic"
	"time"

	"golang.org/x/net/websocket"
	"vimagination.zapto.org/jsonrpc"
	"vimagination.zapto.org/keystore"
)

type socket struct {
	*Battlemap
	mu     sync.RWMutex
	conns  map[*conn]struct{}
	nextID ID
}

func (s *socket) Init(b *Battlemap, _ links) error {
	s.Battlemap = b
	s.conns = make(map[*conn]struct{})
	return nil
}

func (s *socket) ServeConn(wconn *websocket.Conn) {
	var (
		cu keystore.Uint64
		c  conn
	)
	s.config.Get("currentUserMap", &cu)
	a := s.auth.AuthConn(wconn)
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
	c.rpc.Handle()
	s.mu.Lock()
	delete(s.conns, &c)
	s.mu.Unlock()
}

// AuthConn is the interface required to be implemented for a custom Auth
// module to handle websocket RPC connections.
//
// The RPC data method will receive all 'auth' methods called via RPC.
type AuthConn interface {
	IsAdmin() bool
	IsUser() bool
	RPCData(connData ConnData, method string, data json.RawMessage) (interface{}, error)
}

type conn struct {
	*Battlemap
	rpc *jsonrpc.Server

	ConnData
}

// ID is a unique connection ID for a websocket RPC connection
type ID uint64

// SocketIDFromRequest gets the connection ID (if available) from the HTTP
// headers. It returns zero if no ID is found.
func SocketIDFromRequest(r *http.Request) ID {
	id, _ := strconv.ParseUint(r.Header.Get("X-ID"), 10, 0)
	return ID(id)
}

// ConnData represents all of the data required to handle a websocket RPC
// connection.
type ConnData struct {
	CurrentMap uint64
	ID         ID
	AuthConn
}

func (c *conn) HandleRPC(method string, data json.RawMessage) (interface{}, error) {
	cd := ConnData{
		CurrentMap: atomic.LoadUint64(&c.CurrentMap),
		ID:         ID(atomic.LoadUint64((*uint64)(&c.ID))),
		AuthConn:   c.AuthConn,
	}
	switch method {
	case "conn.connID":
		return cd.ID, nil
	case "conn.ready":
		if c.IsAdmin() {
			c.rpc.Send(jsonrpc.Response{
				ID:     broadcastCurrentUserMap,
				Result: uint64(cd.CurrentMap),
			})
		} else {
			c.maps.mu.RLock()
			mapData := c.maps.maps[uint64(cd.CurrentMap)]
			c.maps.mu.RUnlock()
			c.rpc.Send(jsonrpc.Response{
				ID:     broadcastCurrentUserMapData,
				Result: json.RawMessage(mapData.UserJSON),
			})
		}
		return nil, nil
	case "conn.currentTime":
		return time.Now().Unix(), nil
	case "maps.setCurrentMap":
		if cd.IsAdmin() {
			if err := json.Unmarshal(data, &cd.CurrentMap); err != nil {
				return nil, err
			}
			atomic.StoreUint64(&c.CurrentMap, cd.CurrentMap)
			return nil, nil
		}
	case "maps.signalPosition":
		who := userAdmin
		if cd.IsAdmin() {
			who = userAny
		} else if !cd.IsUser() {
			break
		}
		c.socket.broadcastMapChange(cd, broadcastSignalPosition, data, who)
		return nil, nil
	case "maps.signalMovePosition":
		if cd.IsAdmin() {
			c.socket.broadcastMapChange(cd, broadcastSignalMovePosition, data, userNotAdmin)
			return nil, nil
		}
	case "broadcast":
		if cd.IsAdmin() || cd.IsUser() {
			cd.CurrentMap = 0
			c.socket.broadcastMapChange(cd, broadcastAny, data, userAny)
			return nil, nil
		}
	default:
		pos := strings.IndexByte(method, '.')
		if pos <= 0 {
			return nil, ErrUnknownMethod
		}
		if method[:pos] == "auth" {
			return cd.RPCData(cd, method[pos+1:], data)
		}
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
		case "characters":
			if cd.IsAdmin() || submethod == "get" {
				return c.chars.RPCData(cd, submethod, data)
			}
		case "music":
			if cd.IsAdmin() || submethod == "list" {
				return c.musicPacks.RPCData(cd, submethod, data)
			}
		case "maps":
			if submethod == "getUserMap" {
				var currentUserMap keystore.Uint64
				c.config.Get("currentUserMap", &currentUserMap)
				return currentUserMap, nil
			} else if cd.IsAdmin() {
				return c.maps.RPCData(cd, submethod, data)
			}
		case "plugins":
			if cd.IsAdmin() || submethod == "list" {
				return c.plugins.RPCData(cd, submethod, data)
			}
		}
	}
	return nil, ErrUnknownMethod
}

// Errors
var (
	ErrUnknownMethod   = errors.New("unknown method")
	ErrInvalidPassword = errors.New("invalid password")
)
