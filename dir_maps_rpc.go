package main

import (
	"encoding/json"
	"strings"

	"golang.org/x/net/websocket"
	"vimagination.zapto.org/errors"
)

func (m *mapsDir) Websocket(conn *websocket.Conn) {
	Socket.RunConn(conn, m, SocketMaps)
}

func (m *mapsDir) RPC(cd ConnData, method string, data []byte) (interface{}, error) {
	if !cd.IsAdmin {
		return nil, ErrUnknownMethod
	}
	switch strings.TrimPrefix(method, "maps.") {
	case "setCurrentMap":
	case "new":
		var nm newMap
		json.Unmarshal(data, &nm)
		return m.newMap(nm)
	case "renameMap":
		var nn struct {
			ID   uint64 `json:"id"`
			Name string `json:"name"`
		}
		json.Unmarshal(data, &nn)
		if nn.Name == "" {
			return nil, ErrInvalidData
		}
		m.updateMapData(nn.ID, func(mp *Map) bool {
			if mp.Name == nn.Name {
				return false
			}
			mp.Name = nn.Name
			return true
		})
		return nil, nil
	case "changeMapDimensions":
		var md struct {
			ID     uint64 `json:"id"`
			Width  uint64 `json:"width"`
			Height uint64 `json:"height"`
		}
		json.Unmarshal(data, &md)
		if md.Width == 0 || md.Height == 0 {
			return nil, ErrInvalidData
		}
		m.updateMapData(md.ID, func(mp *Map) bool {
			if mp.Width == md.Width && mp.Height == md.Height {
				return false
			}
			mp.Width = md.Width
			mp.Height = md.Height
			return true
		})
		return nil, nil
	case "changeGrid":
		var ng struct {
			ID            uint64 `json:"id"`
			SquaresWidth  uint64 `json:"squaresWidth"`
			SquaresColour Colour `json:"squaresColour"`
			SquaresStroke uint64 `json:"squaresStoke"`
		}
		json.Unmarshal(data, &ng)
		m.updateMapData(ng.ID, func(mp *Map) bool {
			for n := range mp.Patterns {
				p := &mp.Patterns[n]
				if p.ID == "gridPattern" {
					if p.Path == nil {
						mp.Patterns[n] = genGridPattern(ng.SquaresWidth, ng.SquaresColour, ng.SquaresStroke)
					} else {
						if p.Width == ng.SquaresWidth && p.Height == ng.SquaresWidth && p.Path.Stroke == ng.SquaresColour && p.Path.StrokeWidth == ng.SquaresWidth {
							return false
						}
						p.Width = ng.SquaresWidth
						p.Height = ng.SquaresWidth
						p.Path.Path = genGridPath(ng.SquaresWidth)
						p.Path.Stroke = ng.SquaresColour
						p.Path.StrokeWidth = ng.SquaresWidth
					}
					return true
				}
			}
			mp.Patterns = append(mp.Patterns, genGridPattern(ng.SquaresWidth, ng.SquaresColour, ng.SquaresStroke))
			return true
		})
	default:
		return currentMap(cd.CurrentMap).RPC(cd, method, data)
	}
	return nil, ErrUnknownMethod
}

type currentMap uint64

func (c currentMap) Websocket(conn *websocket.Conn) {
	Socket.RunConn(conn, c, SocketMaps)
}

func (c currentMap) RPC(cd ConnData, method string, data []byte) (interface{}, error) {
	if !cd.IsAdmin {
		return nil, ErrUnknownMethod
	}
	switch strings.TrimPrefix(method, "maps.") {
	}
	return nil, ErrUnknownMethod
}

const (
	ErrInvalidData errors.Error = "invalid map data"
)
