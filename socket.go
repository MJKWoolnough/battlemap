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

var RPC rpcs

type rpcs struct {
	quitMu sync.Mutex
	quit   chan struct{}

	clientMu sync.Mutex
	clients  map[*websocket.Conn]chan []byte
}

func (r *rpcs) Init(db *sql.DB) error {
	r.quit = make(chan struct{})
	r.clients = make(map[*websocket.Conn]chan []byte)
	rpc.Register(r)
}

func (r *rpcs) handleConn(conn *websocket.Conn) {
	if Session.GetAdmin(conn.Request()) {
		r.quitMu.Lock()
		close(r.quit)
		r.quit = make(chan struct{})
		myQuit := r.quit
		done := make(chan struct{})
		r.quitMu.Unlock()
		go func() {
			select {
			case <-myQuit:
				conn.WriteClose(4000)
			case <-done:
			}
		}()
		io.WriteString(conn, "{\"Admin\": true}")
		jsonrpc.ServeConn(conn)
		close(done)
	} else {
		io.WriteString(conn, "{\"Admin\": false}")
		data := make(chan []byte, 1024)
		r.clientMu.Lock()
		r.clients[conn] = data
		r.clientMu.Unlock()
		// send loadMap with data
		for {
			if _, err := conn.Write(<-data); err != nil {
				conn.WriteClose(5000)
				break
			}
		}
		r.clientMu.Lock()
		delete(r.clients, conn)
		close(data)
		r.clientMu.Unlock()
	}
}

func (r *rpcs) broadcast(v interface{}) {
	var buf memio.Buffer
	json.NewEncoder(&buf).Encode(v)
	r.clientMu.Lock()
	for _, c := range r.clients {
		c <- buf
	}
	r.clientMu.Unlock()
}
