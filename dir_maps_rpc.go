package main

import "strings"

func (m *mapsDir) RPC(cd ConnData, method string, data []byte) (interface{}, error) {
	switch strings.TrimPrefix(method, "maps.") {
	case "getCurrentMap":
		return cd.CurrentMap, nil
	}
	return nil, ErrUnknownMethod
}
