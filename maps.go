package main

import (
	"database/sql"
	"encoding/json"
	"io"
	"net/rpc"
	"net/rpc/jsonrpc"
	"sync"

	"golang.org/x/net/websocket"
	"vimagination.zapto.org/memio"
)

var Maps maps

type maps struct {
	server *rpc.Server

	quitMu sync.Mutex
	quit   chan struct{}

	clientMu sync.Mutex
	clients  map[*websocket.Conn]chan []byte
}

func (m *maps) init(db *sql.DB) error {
	m.quit = make(chan struct{})
	m.clients = make(map[*websocket.Conn]chan []byte)
	m.server = rpc.NewServer()
	m.server.Register(m)
	return nil
}

func (m *maps) handleConn(conn *websocket.Conn) {
	if Session.GetAdmin(conn.Request()) {
		m.quitMu.Lock()
		close(m.quit)
		m.quit = make(chan struct{})
		myQuit := m.quit
		done := make(chan struct{})
		m.quitMu.Unlock()
		go func() {
			select {
			case <-myQuit:
				conn.WriteClose(4000)
			case <-done:
			}
		}()
		io.WriteString(conn, "{\"Admin\": true}")
		m.server.ServeCodec(jsonrpc.NewServerCodec(conn))
		close(done)
	} else {
		io.WriteString(conn, "{\"Admin\": false}")
		data := make(chan []byte, 1024)
		m.clientMu.Lock()
		m.clients[conn] = data
		m.clientMu.Unlock()
		// send loadMap with data
		for {
			if _, err := conn.Write(<-data); err != nil {
				conn.WriteClose(5000)
				break
			}
		}
		m.clientMu.Lock()
		delete(m.clients, conn)
		close(data)
		m.clientMu.Unlock()
	}
}

func (m *maps) broadcast(v interface{}) {
	var buf memio.Buffer
	json.NewEncoder(&buf).Encode(v)
	m.clientMu.Lock()
	for _, c := range m.clients {
		c <- buf
	}
	m.clientMu.Unlock()
}
