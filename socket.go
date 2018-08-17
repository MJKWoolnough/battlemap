package main

import (
	"encoding/json"
	"io"
	"net/http"
	"net/rpc"
	"net/rpc/jsonrpc"
	"sync"

	"golang.org/x/net/websocket"
	"vimagination.zapto.org/memio"
)

var Socket socket

type socket struct {
	quitMu sync.Mutex
	quit   chan struct{}
	server *rpc.Server

	admin, client websocket.Handler

	clientMu sync.Mutex
	clients  map[*websocket.Conn]chan []byte
}

func (s *socket) init() error {
	s.server = rpc.NewServer()
	s.server.RegisterName("Maps", &Maps)
	s.server.RegisterName("Assets", &Assets)
	s.quit = make(chan struct{})
	s.clients = make(map[*websocket.Conn]chan []byte)
	s.admin = websocket.Handler(s.adminConn)
	s.client = websocket.Handler(s.clientConn)
	return nil
}

func (s *socket) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	if Session.GetAdmin(r) {
		if r.Method == http.MethodPost {
			Assets.handleUpload(w, r)
		} else {
			s.admin.ServeHTTP(w, r)
		}
	} else {
		s.client.ServeHTTP(w, r)
	}
}

func (s *socket) adminConn(conn *websocket.Conn) {
	s.quitMu.Lock()
	close(s.quit)
	s.quit = make(chan struct{})
	myQuit := s.quit
	done := make(chan struct{})
	s.quitMu.Unlock()
	go func() {
		select {
		case <-myQuit:
			conn.WriteClose(4000)
		case <-done:
		}
	}()
	io.WriteString(conn, "{\"id\": -1, \"result\": true}")
	s.server.ServeCodec(jsonrpc.NewServerCodec(conn))
	close(done)
}

func (s *socket) clientConn(conn *websocket.Conn) {
	io.WriteString(conn, "{\"id\": -1, \"result\": false}")
	data := make(chan []byte, 1024)
	s.clientMu.Lock()
	s.clients[conn] = data
	s.clientMu.Unlock()
	// send loadMap with data
	for {
		if _, err := conn.Write(<-data); err != nil {
			conn.WriteClose(5000)
			break
		}
	}
	s.clientMu.Lock()
	delete(s.clients, conn)
	close(data)
	s.clientMu.Unlock()
}

func (s *socket) broadcast(v interface{}) {
	var buf memio.Buffer
	json.NewEncoder(&buf).Encode(v)
	s.clientMu.Lock()
	for _, c := range s.clients {
		c <- buf
	}
	s.clientMu.Unlock()
}
