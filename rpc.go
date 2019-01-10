package main

import (
	"encoding/json"
	"net"
	"sync"

	"vimagination.zapto.org/errors"
)

type rpcRequest struct {
	Method string          `json:"method"`
	Params json.RawMessage `json:"params"`
	ID     int             `json:"id"`
}

type RPCResponse struct {
	ID     int         `json:"id"`
	Result interface{} `json:"result"`
	Error  string      `json:"error"`
}

// RPC handler takes a method name and a byte slice representing JSON encoded
// data and should return data OR an error
type RPCHandler func(string, []byte) (interface{}, error)

type RPC struct {
	handler RPCHandler
	decoder *json.Decoder

	encoderLock sync.Mutex
	encoder     *json.Encoder
}

func NewRPC(conn net.Conn, handler RPCHandler) *RPC {
	return &RPC{
		handler: handler,
		decoder: json.NewDecoder(conn),
		encoder: json.NewEncoder(conn),
	}
}

func (r *RPC) Handle() error {
	for {
		var req rpcRequest
		if err := r.decoder.Decode(&req); err != nil {
			return errors.WithContext("error decoding JSON request: ", err)
		}
		go r.handleRequest(req)
	}
}

func (r *RPC) handleRequest(req rpcRequest) {
	resp := RPCResponse{ID: req.ID}
	var err error
	resp.Result, err = r.handler(req.Method, req.Params)
	if err != nil {
		resp.Error = err.Error()
	}
	r.Send(resp)
}

func (r *RPC) Send(resp RPCResponse) {
	r.encoderLock.Lock()
	r.encoder.Encode(resp)
	r.encoderLock.Unlock()
}
