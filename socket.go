package main

import (
	"net"
	"sync"

	"golang.org/x/net/websocket"
)

var (
	quitMu sync.Mutex
	quit   = make(chan struct{})
)

func handleConn(conn *websocket.Conn) {
	if Session.GetAdmin(conn.Request()) {
		quitMu.Lock()
		close(quit)
		quit = make(chan struct{})
		myQuit := quit
		done := make(chan struct{})
		quitMu.Unlock()
		go func() {
			select {
			case <-myQuit:
				conn.WriteClose(4000)
			case <-done:
			}
		}()
		adminSession(conn)
		close(done)
	} else {
		userSession(conn)
	}
}

func adminSession(conn net.Conn) {

}

func userSession(conn net.Conn) {

}
