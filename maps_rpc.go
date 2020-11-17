package battlemap

import (
	"encoding/json"
	"errors"
	"strconv"

	"vimagination.zapto.org/keystore"
)

func (m *mapsDir) RPCData(cd ConnData, method string, data json.RawMessage) (interface{}, error) {
	switch method {
	case "list":
		m.mu.RLock()
		j := m.json
		m.mu.RUnlock()
		return json.RawMessage(j), nil
	case "setUserMap":
		var userMap keystore.Uint64
		if err := json.Unmarshal(data, &userMap); err != nil {
			return nil, err
		}
		m.mu.RLock()
		defer m.mu.RUnlock()
		mp, ok := m.maps[uint64(userMap)]
		if !ok {
			return nil, ErrUnknownMap
		}
		m.Battlemap.config.Set("currentUserMap", &userMap)
		m.Battlemap.socket.SetCurrentUserMap(uint64(userMap), data, json.RawMessage(mp.JSON), cd.ID)
		return nil, nil
	case "getMapData":
		var mapID uint64
		if err := json.Unmarshal(data, &mapID); err != nil {
			return nil, err
		}
		m.mu.RLock()
		defer m.mu.RUnlock()
		mp, ok := m.maps[mapID]
		if !ok {
			return nil, ErrUnknownMap
		}
		return json.RawMessage(mp.JSON), nil
	case "new":
		var nm mapDetails
		if err := json.Unmarshal(data, &nm); err != nil {
			return nil, err
		}
		return m.newMap(nm, cd.ID)
	case "setMapDetails":
		var md struct {
			mapDimensions
			mapGrid
		}
		if err := json.Unmarshal(data, &md); err != nil {
			return nil, err
		}
		if md.Width == 0 || md.Height == 0 {
			return nil, ErrInvalidData
		}
		return nil, m.updateMapData(cd.CurrentMap, func(mp *levelMap) bool {
			if mp.Width == md.Width && mp.Height == md.Height && mp.GridSize == md.GridSize && mp.GridColour == md.GridColour && mp.GridStroke == md.GridStroke {
				return false
			}
			mp.Width = md.Width
			mp.Height = md.Height
			mp.GridSize = md.GridSize
			mp.GridColour = md.GridColour
			mp.GridStroke = md.GridStroke
			m.socket.broadcastMapChange(cd, broadcastMapItemChange, data, userAny)
			return true
		})
	case "setData":
		var sd struct {
			Key  string          `json:"key"`
			Data json.RawMessage `json:"data"`
		}
		if err := json.Unmarshal(data, &sd); err != nil {
			return nil, err
		}
		return nil, m.updateMapData(cd.CurrentMap, func(mp *levelMap) bool {
			mp.Data[sd.Key] = sd.Data
			m.socket.broadcastMapChange(cd, broadcastMapDataSet, data, userAny)
			return true
		})
	case "removeData":
		var rd string
		if err := json.Unmarshal(data, &rd); err != nil {
			return nil, err
		}
		return nil, m.updateMapData(cd.CurrentMap, func(mp *levelMap) bool {
			delete(mp.Data, rd)
			m.socket.broadcastMapChange(cd, broadcastMapDataRemove, data, userAny)
			return true
		})
	case "setLightColour":
		var c colour
		if err := json.Unmarshal(data, &c); err != nil {
			return nil, err
		}
		if err := m.updateMapData(cd.CurrentMap, func(mp *levelMap) bool {
			mp.Light = c
			m.socket.broadcastMapChange(cd, broadcastMapLightChange, data, userAny)
			return true
		}); err != nil {
			return nil, err
		}
		return nil, nil
	case "shiftLight":
		var pos struct {
			X uint64 `json:"x"`
			Y uint64 `json:"y"`
		}
		if err := json.Unmarshal(data, &pos); err != nil {
			return nil, err
		}
		if err := m.updateMapData(cd.CurrentMap, func(mp *levelMap) bool {
			if mp.LightX == pos.X && mp.LightY == pos.Y {
				return false
			}
			mp.LightX = pos.X
			mp.LightY = pos.Y
			m.socket.broadcastMapChange(cd, broadcastLightShift, data, userAny)
			return true
		}); err != nil {
			return nil, err
		}
		return nil, nil
	case "addWall":
		var wallAdd struct {
			Path string `json:"path"`
			*wall
		}
		wallAdd.wall = new(wall)
		if err := json.Unmarshal(data, &wallAdd); err != nil {
			return nil, err
		}
		if !validTokenLayer(wallAdd.Path) {
			return nil, ErrInvalidLayerPath
		}
		if err := m.updateMapLayer(cd.CurrentMap, wallAdd.Path, func(mp *levelMap, l *layer) bool {
			mp.lastWallID++
			wallAdd.wall.ID = mp.lastWallID
			l.Walls = append(l.Walls, wallAdd.wall)
			mp.walls[mp.lastWallID] = layerWall{l, wallAdd.wall}
			m.socket.broadcastMapChange(cd, broadcastWallAdd, append(strconv.AppendUint(append(data[:len(data)-1], ",\"id\":"...), mp.lastTokenID, 10), '}'), userAny)
			return true
		}); err != nil {
			return nil, err
		}
		return wallAdd.ID, nil
	case "removeWall":
		var wallRemove struct {
			Path string `json:"path"`
			Pos  uint   `json:"pos"`
		}
		if err := json.Unmarshal(data, &wallRemove); err != nil {
			return nil, err
		}
		if err := m.updateMapLayer(cd.CurrentMap, wallRemove.Path, func(_ *levelMap, l *layer) bool {
			if wallRemove.Pos > uint(len(l.Walls)) {
				return false
			}
			l.Walls = append(l.Walls[:wallRemove.Pos], l.Walls[wallRemove.Pos+1:]...)
			m.socket.broadcastMapChange(cd, broadcastWallRemove, data, userAny)
			return true
		}); err != nil {
			return nil, err
		}
		return nil, nil
	case "addLayer":
		var name string
		if err := json.Unmarshal(data, &name); err != nil {
			return nil, err
		}
		err := m.updateMapData(cd.CurrentMap, func(mp *levelMap) bool {
			newName := uniqueLayer(mp.layers, name)
			if newName != name {
				name = newName
				data = appendString(data[:0], name)
			}
			mp.Layers = append(mp.Layers, &layer{Name: name})
			mp.layers[name] = struct{}{}
			m.socket.broadcastMapChange(cd, broadcastLayerAdd, data, userAny)
			return true
		})
		return data, err
	case "addLayerFolder":
		var path string
		if err := json.Unmarshal(data, &path); err != nil {
			return nil, err
		}
		parent, name := splitAfterLastSlash(path)
		err := m.updateMapLayer(cd.CurrentMap, parent, func(lm *levelMap, l *layer) bool {
			newName := uniqueLayer(lm.layers, name)
			if newName != name {
				name = newName
				path = parent + "/" + name
				data = appendString(data[:0], path)
			}
			l.Layers = append(l.Layers, &layer{
				Name:   name,
				Layers: []*layer{},
			})
			m.socket.broadcastMapChange(cd, broadcastLayerFolderAdd, data, userAny)
			return true
		})
		return data, err
	case "renameLayer":
		var rename struct {
			Path string `json:"path"`
			Name string `json:"name"`
		}
		if err := json.Unmarshal(data, &rename); err != nil {
			return nil, err
		}
		if !validTokenLayer(rename.Path) {
			return nil, ErrInvalidLayerPath
		}
		err := m.updateMapLayer(cd.CurrentMap, rename.Path, func(lm *levelMap, l *layer) bool {
			if l.Name == rename.Name {
				return false
			}
			delete(lm.layers, l.Name)
			l.Name = uniqueLayer(lm.layers, rename.Name)
			if l.Name != rename.Name {
				rename.Name = l.Name
				data = append(appendString(append(appendString(append(data[:0], "{\"path\":"...), rename.Path), ",\"name\":"...), rename.Name), '}')
			}
			m.socket.broadcastMapChange(cd, broadcastLayerRename, data, userAny)
			return true
		})
		return data, err
	case "moveLayer":
		var moveLayer struct {
			From     string `json:"from"`
			To       string `json:"to"`
			Position uint   `json:"position"`
		}
		err := json.Unmarshal(data, &moveLayer)
		if err != nil {
			return nil, err
		}
		if !validTokenLayer(moveLayer.From) && moveLayer.To != "/" {
			return nil, ErrInvalidLayerPath
		}
		if e := m.updateMapData(cd.CurrentMap, func(mp *levelMap) bool {
			op, l := getParentLayer(&mp.layer, moveLayer.From)
			if l == nil {
				err = ErrUnknownLayer
				return false
			}
			np := getLayer(&mp.layer, moveLayer.To)
			if np == nil || np.Layers == nil {
				err = ErrUnknownLayer
				return false
			}
			op.removeLayer(l.Name)
			np.addLayer(l, moveLayer.Position)
			m.socket.broadcastMapChange(cd, broadcastLayerMove, data, userAny)
			return true
		}); e != nil {
			return nil, e
		}
		return nil, err
	case "showLayer":
		var path string
		if err := json.Unmarshal(data, &path); err != nil {
			return nil, err
		}
		if len(path) == 0 {
			return nil, ErrInvalidLayerPath
		}
		return nil, m.updateMapLayer(cd.CurrentMap, path, func(_ *levelMap, l *layer) bool {
			if !l.Hidden {
				return false
			}
			l.Hidden = false
			m.socket.broadcastMapChange(cd, broadcastLayerShow, data, userAny)
			return true
		})
	case "hideLayer":
		var path string
		if err := json.Unmarshal(data, &path); err != nil {
			return nil, err
		}
		if len(path) == 0 {
			return nil, ErrInvalidLayerPath
		}
		return nil, m.updateMapLayer(cd.CurrentMap, path, func(_ *levelMap, l *layer) bool {
			if l.Hidden {
				return false
			}
			l.Hidden = true
			m.socket.broadcastMapChange(cd, broadcastLayerHide, data, userAny)
			return true
		})
	case "addMask":
		var addMask struct {
			Path string `json:"path"`
			Mask uint64 `json:"mask"`
		}
		if err := json.Unmarshal(data, &addMask); err != nil {
			return nil, err
		}
		if len(addMask.Path) == 0 {
			return nil, ErrInvalidLayerPath
		}
		return nil, m.updateMapLayer(cd.CurrentMap, addMask.Path, func(_ *levelMap, l *layer) bool {
			if l.Mask == addMask.Mask {
				return false
			}
			l.Mask = addMask.Mask
			m.socket.broadcastMapChange(cd, broadcastLayerMaskAdd, data, userAny)
			return true
		})
	case "removeMask":
		var path string
		if err := json.Unmarshal(data, &path); err != nil {
			return nil, err
		}
		if len(path) == 0 {
			return nil, ErrInvalidLayerPath
		}
		return nil, m.updateMapLayer(cd.CurrentMap, path, func(_ *levelMap, l *layer) bool {
			if l.Mask == 0 {
				return false
			}
			l.Mask = 0
			m.socket.broadcastMapChange(cd, broadcastLayerMaskRemove, data, userAny)
			return true
		})
	case "removeLayer":
		var path string
		err := json.Unmarshal(data, &path)
		if err != nil {
			return nil, err
		}
		if !validTokenLayer(path) {
			return nil, ErrInvalidLayerPath
		}
		parent, name := splitAfterLastSlash(path)
		err = m.updateMapLayer(cd.CurrentMap, parent, func(mp *levelMap, l *layer) bool {
			l.removeLayer(name)
			delete(mp.layers, name)
			m.socket.broadcastMapChange(cd, broadcastLayerRemove, data, userAny)
			return true
		})
		return nil, err
	case "addToken":
		var newToken struct {
			*token
			Path string `json:"path"`
		}
		newToken.token = new(token)
		if err := json.Unmarshal(data, &newToken); err != nil {
			return nil, err
		}
		if !validTokenLayer(newToken.Path) {
			return nil, ErrInvalidLayerPath
		}
		if err := newToken.validate(); err != nil {
			return nil, err
		}
		if err := m.updateMapLayer(cd.CurrentMap, newToken.Path, func(mp *levelMap, l *layer) bool {
			if newToken.TokenType == tokenImage {
				for key, data := range newToken.TokenData {
					if f := m.isLinkKey(key); f != nil {
						f.setHiddenLinkJSON(nil, data.Data)
					}
				}
				m.images.setHiddenLink(0, newToken.Source)
			}
			mp.lastTokenID++
			newToken.token.ID = mp.lastTokenID
			l.Tokens = append(l.Tokens, newToken.token)
			mp.tokens[mp.lastTokenID] = layerToken{l, newToken.token}
			m.socket.broadcastMapChange(cd, broadcastTokenAdd, append(strconv.AppendUint(append(data[:len(data)-1], ",\"id\":"...), mp.lastTokenID, 10), '}'), userAny)
			return true
		}); err != nil {
			return nil, err
		}
		return newToken.ID, nil
	case "modifyTokenData":
		var modifyToken struct {
			ID       uint64                  `json:"id"`
			Setting  map[string]keystoreData `json:"setting"`
			Removing []string                `json:"removing"`
		}
		if err := json.Unmarshal(data, &modifyToken); err != nil {
			return nil, err
		}
		return nil, m.updateMapsLayerToken(cd.CurrentMap, modifyToken.ID, func(_ *levelMap, _ *layer, tk *token) bool {
			m.socket.broadcastMapChange(cd, broadcastTokenDataChange, data, userAdmin)
			data := strconv.AppendUint(append(data[:0], "{\"id\":"...), modifyToken.ID, 10)
			data = append(data, ",\"setting\":{"...)
			first := true
			var (
				changed     bool
				userRemoves []string
			)
			for key, kd := range modifyToken.Setting {
				if f := m.isLinkKey(key); f != nil {
					if d, ok := tk.TokenData[key]; ok {
						f.setHiddenLinkJSON(d.Data, kd.Data)
					} else {
						f.setHiddenLinkJSON(nil, kd.Data)
					}
				}
				if kd.User {
					if !first {
						data = append(data, ',')
					} else {
						first = false
					}
					data = append(append(append(data, "{\"user\":true,\"data\":"...), kd.Data...), '}')
				} else if td, ok := tk.TokenData[key]; ok && td.User {
					userRemoves = append(userRemoves, key)
				}
				tk.TokenData[key] = kd
				changed = true
			}
			data = append(data, "},\"removing\":["...)
			first = true
			for _, r := range modifyToken.Removing {
				d, ok := tk.TokenData[r]
				if !ok {
					continue
				}
				if f := m.isLinkKey(r); f != nil {
					f.setHiddenLinkJSON(d.Data, nil)
				}
				if tk.TokenData[r].User {
					if !first {
						data = append(data, ',')
					} else {
						first = false
					}
					data = appendString(data, r)
				}
				delete(tk.TokenData, r)
				changed = true
			}
			if changed {
				for _, key := range userRemoves {
					if !first {
						data = append(data, ',')
					} else {
						first = false
					}
					data = appendString(data, key)
				}
				data = append(data, ']')
				m.socket.broadcastMapChange(cd, broadcastTokenDataChange, data, userNotAdmin)
			}
			return changed
		})
	case "removeToken":
		var tokenID uint64
		if err := json.Unmarshal(data, &tokenID); err != nil {
			return nil, err
		}
		return nil, m.updateMapsLayerToken(cd.CurrentMap, tokenID, func(mp *levelMap, l *layer, tk *token) bool {
			m.cleanupTokenRemove(mp, tk)
			delete(mp.tokens, tokenID)
			l.removeToken(tokenID)
			m.socket.broadcastMapChange(cd, broadcastTokenRemove, data, userAny)
			return true
		})
	case "setTokenData":
		var setToken struct {
			ID             uint64  `json:"id"`
			X              *int64  `json:"x"`
			Y              *int64  `json:"y"`
			Width          *uint64 `json:"width"`
			Height         *uint64 `json:"height"`
			Rotation       *uint8  `json:"rotation"`
			Snap           *bool   `json:"snap"`
			LightColour    *colour `json:"lightColour"`
			LightIntensity *uint64 `json:"lightIntensity"`

			Source          *uint64                 `json:"src"`
			PatternWidth    *uint64                 `json:"patternWidth"`
			PatternHeight   *uint64                 `json:"patternHeight"`
			TokenData       map[string]keystoreData `json:"tokenData"`
			RemoveTokenData []string                `json:"removeTokenData"`
			Flip            *bool                   `json:"flip"`
			Flop            *bool                   `json:"flop"`

			IsEllipse   *bool   `json:"isEllipse"`
			Fill        *colour `json:"fill"`
			Stroke      *colour `json:"stroke"`
			StrokeWidth *uint8  `json:"strokeWidth"`

			Points []coords `json:"points"`
		}
		if err := json.Unmarshal(data, &setToken); err != nil {
			return nil, err
		}
		return nil, m.updateMapsLayerToken(cd.CurrentMap, setToken.ID, func(_ *levelMap, _ *layer, tk *token) bool {
			m.socket.broadcastMapChange(cd, broadcastTokenSet, data, userAdmin)
			data = strconv.AppendUint(append(data[:0], "{\"id\":"...), setToken.ID, 10)
			l := len(data)
			if setToken.X != nil && *setToken.X != tk.X {
				tk.X = *setToken.X
				data = strconv.AppendInt(append(data, ",\"x\":"...), tk.X, 10)
			}
			if setToken.Y != nil && *setToken.Y != tk.Y {
				tk.Y = *setToken.Y
				data = strconv.AppendInt(append(data, ",\"y\":"...), tk.Y, 10)
			}
			if setToken.Width != nil && *setToken.Width != tk.Width && *setToken.Width > 0 {
				tk.Width = *setToken.Width
				data = strconv.AppendUint(append(data, ",\"width\":"...), tk.Width, 10)
			}
			if setToken.Height != nil && *setToken.Height != tk.Height && *setToken.Height > 0 {
				tk.Height = *setToken.Height
				data = strconv.AppendUint(append(data, ",\"height\":"...), tk.Height, 10)
			}
			if setToken.Rotation != nil && *setToken.Rotation != tk.Rotation {
				tk.Rotation = *setToken.Rotation
				data = appendNum(append(data, ",\"rotation\":"...), tk.Rotation)
			}
			if setToken.Snap != nil && *setToken.Snap != tk.Snap {
				tk.Snap = *setToken.Snap
				data = strconv.AppendBool(append(data, ",\"snap\":"...), tk.Snap)
			}
			if setToken.LightColour != nil && *setToken.LightColour != tk.LightColour {
				tk.LightColour = *setToken.LightColour
				data = tk.LightColour.appendTo(append(data, ",\"lightColour\":"...))
			}
			if setToken.LightIntensity != nil && *setToken.LightIntensity != tk.LightIntensity {
				tk.LightIntensity = *setToken.LightIntensity
				data = strconv.AppendUint(append(data, ",\"lightIntensity\":"...), tk.LightIntensity, 10)
			}
			switch tk.TokenType {
			case tokenImage:
				if setToken.Source != nil && *setToken.Source != tk.Source {
					tk.Source = *setToken.Source
					data = strconv.AppendUint(append(data, ",\"src\":"...), tk.Source, 10)
				}
				if setToken.PatternWidth != nil && *setToken.PatternWidth != tk.PatternWidth {
					tk.PatternWidth = *setToken.PatternWidth
					data = strconv.AppendUint(append(data, ",\"patternWidth\":"...), tk.PatternWidth, 10)
				}
				if setToken.PatternHeight != nil && *setToken.PatternHeight != tk.PatternHeight {
					tk.PatternHeight = *setToken.PatternHeight
					data = strconv.AppendUint(append(data, ",\"patternHeight\":"...), tk.PatternHeight, 10)
				}
				if setToken.Flip != nil && *setToken.Flip != tk.Flip {
					tk.Flip = *setToken.Flip
					data = strconv.AppendBool(append(data, ",\"flip\":"...), tk.Flip)
				}
				if setToken.Flop != nil && *setToken.Flop != tk.Flop {
					tk.Flop = *setToken.Flop
					data = strconv.AppendBool(append(data, ",\"flip\":"...), tk.Flop)
				}
				if len(setToken.RemoveTokenData) > 0 {
					data = append(data, ",\"removeTokenData\":["...)
					first := true
					for _, r := range setToken.RemoveTokenData {
						delete(setToken.TokenData, r)
						if d, ok := tk.TokenData[r]; ok {
							if f := m.isLinkKey(r); f != nil {
								f.setHiddenLinkJSON(d.Data, nil)
							}
							if d.User {
								if first {
									first = false
								} else {
									data = append(data, ',')
								}
								data = appendString(data, r)
							}
							delete(tk.TokenData, r)
						}
					}
					data = append(data, ']')
				}
				if len(setToken.TokenData) > 0 {
					data = append(data, ",\"tokenData\":{"...)
					first := true
					for key, kd := range setToken.TokenData {
						if f := m.isLinkKey(key); f != nil {
							if d, ok := tk.TokenData[key]; ok {
								f.setHiddenLinkJSON(d.Data, kd.Data)
							} else {
								f.setHiddenLinkJSON(nil, kd.Data)
							}
						}
						if kd.User {
							if first {
								first = false
							} else {
								data = append(data, ',')
							}
							data = append(append(append(appendString(data, key), ":{\"user\":true,\"data\":"...), kd.Data...), '}')
						}
						tk.TokenData[key] = kd
					}
					data = append(data, '}')
				}
			case tokenDrawing:
				if setToken.Points != nil {
					tk.Points = setToken.Points
					data = append(data, ",\"points\":["...)
					for n, p := range tk.Points {
						if n > 0 {
							data = append(data, ',')
						}
						data = strconv.AppendInt(append(data, "{\"x\":"...), p.X, 10)
						data = strconv.AppendInt(append(data, ",\"y\":"...), p.Y, 10)
						data = append(data, '}')
					}
					data = append(data, ']')
				}
				fallthrough
			case tokenShape:
				if setToken.IsEllipse != nil && *setToken.IsEllipse != tk.IsEllipse {
					tk.IsEllipse = *setToken.IsEllipse
					data = strconv.AppendBool(append(data, ",\"isEllipse\":"...), tk.IsEllipse)
				}
				if setToken.Fill != nil && *setToken.Fill != tk.Fill {
					tk.Fill = *setToken.Fill
					data = tk.Fill.appendTo(append(data, ",\"fill\":"...))
				}
				if setToken.Stroke != nil && *setToken.Stroke != tk.Stroke {
					tk.Stroke = *setToken.Stroke
					data = tk.Stroke.appendTo(append(data, ",\"stroke\":"...))
				}
				if setToken.StrokeWidth != nil && *setToken.StrokeWidth != tk.StrokeWidth {
					tk.StrokeWidth = *setToken.StrokeWidth
					data = appendNum(append(data, ",\"strokeWidth\":"...), tk.StrokeWidth)
				}
			}
			if l == len(data) {
				return false
			}
			data = append(data, '}')
			m.socket.broadcastMapChange(cd, broadcastTokenSet, data, userNotAdmin)
			return true
		})
	case "setToken":
		var setToken struct {
			ID       uint64 `json:"id"`
			X        int64  `json:"x"`
			Y        int64  `json:"y"`
			Width    uint64 `json:"width"`
			Height   uint64 `json:"height"`
			Rotation uint8  `json:"rotation"`
		}
		if err := json.Unmarshal(data, &setToken); err != nil {
			return nil, err
		}
		return nil, m.updateMapsLayerToken(cd.CurrentMap, setToken.ID, func(_ *levelMap, _ *layer, tk *token) bool {
			if tk.X == setToken.X && tk.Y == setToken.Y && tk.Width == setToken.Width && tk.Height == setToken.Height && tk.Rotation == setToken.Rotation {
				return false
			}
			tk.X = setToken.X
			tk.Y = setToken.Y
			tk.Width = setToken.Width
			tk.Height = setToken.Height
			tk.Rotation = setToken.Rotation
			m.socket.broadcastMapChange(cd, broadcastTokenChange, data, userAny)
			return true
		})
	case "flipToken":
		var flipToken struct {
			ID   uint64 `json:"id"`
			Flip bool   `json:"flip"`
		}
		if err := json.Unmarshal(data, &flipToken); err != nil {
			return nil, err
		}
		return nil, m.updateMapsLayerToken(cd.CurrentMap, flipToken.ID, func(_ *levelMap, _ *layer, tk *token) bool {
			if tk.Flip == flipToken.Flip {
				return false
			}
			tk.Flip = flipToken.Flip
			m.socket.broadcastMapChange(cd, broadcastTokenFlip, data, userAny)
			return true
		})
	case "flopToken":
		var flopToken struct {
			ID   uint64 `json:"id"`
			Flop bool   `json:"flop"`
		}
		if err := json.Unmarshal(data, &flopToken); err != nil {
			return nil, err
		}
		return nil, m.updateMapsLayerToken(cd.CurrentMap, flopToken.ID, func(_ *levelMap, _ *layer, tk *token) bool {
			if tk.Flop == flopToken.Flop {
				return false
			}
			tk.Flop = flopToken.Flop
			m.socket.broadcastMapChange(cd, broadcastTokenFlop, data, userAny)
			return true
		})
	case "setTokenSnap":
		var snapToken struct {
			ID   uint64 `json:"id"`
			Snap bool   `json:"snap"`
		}
		if err := json.Unmarshal(data, &snapToken); err != nil {
			return nil, err
		}
		return nil, m.updateMapsLayerToken(cd.CurrentMap, snapToken.ID, func(mp *levelMap, _ *layer, tk *token) bool {
			if tk.Snap == snapToken.Snap {
				return false
			}
			tk.Snap = snapToken.Snap
			m.socket.broadcastMapChange(cd, broadcastTokenSnap, data, userAny)
			return true
		})
	case "setTokenLight":
		var lightToken struct {
			ID             uint64 `json:"id"`
			LightColour    colour `json:"lightcolour"`
			LightIntensity uint64 `json:"lightIntensity"`
		}
		if err := json.Unmarshal(data, &lightToken); err != nil {
			return nil, err
		}
		return nil, m.updateMapsLayerToken(cd.CurrentMap, lightToken.ID, func(_ *levelMap, _ *layer, tk *token) bool {
			if tk.LightIntensity == lightToken.LightIntensity && tk.LightColour.R == lightToken.LightColour.R && tk.LightColour.G == lightToken.LightColour.G && tk.LightColour.B == lightToken.LightColour.B && tk.LightColour.A == lightToken.LightColour.A {
				return false
			}
			tk.LightIntensity = lightToken.LightIntensity
			tk.LightColour = lightToken.LightColour
			m.socket.broadcastMapChange(cd, broadcastTokenLightChange, data, userAny)
			return true
		})
	case "setTokenPattern":
		var patternToken uint64
		if err := json.Unmarshal(data, &patternToken); err != nil {
			return nil, err
		}
		return nil, m.updateMapsLayerToken(cd.CurrentMap, patternToken, func(mp *levelMap, _ *layer, tk *token) bool {
			if tk.PatternWidth > 0 || tk.TokenType != tokenImage {
				return false
			}
			tk.PatternWidth = tk.Width
			tk.PatternHeight = tk.Height
			m.socket.broadcastMapChange(cd, broadcastTokenSetPattern, data, userAny)
			return true

		})
	case "setTokenImage":
		var imageToken uint64
		if err := json.Unmarshal(data, &imageToken); err != nil {
			return nil, err
		}
		return nil, m.updateMapsLayerToken(cd.CurrentMap, imageToken, func(mp *levelMap, _ *layer, tk *token) bool {
			if tk.PatternWidth == 0 || tk.TokenType != tokenImage {
				return false
			}
			tk.PatternWidth = 0
			tk.PatternHeight = 0
			m.socket.broadcastMapChange(cd, broadcastTokenSetImage, data, userAny)
			return true
		})
	case "setTokenSource":
		var tokenSource struct {
			ID     uint64 `json:"id"`
			Source uint64 `json:"src"`
		}
		if err := json.Unmarshal(data, &tokenSource); err != nil {
			return nil, err
		}
		return nil, m.updateMapsLayerToken(cd.CurrentMap, tokenSource.ID, func(_ *levelMap, _ *layer, tk *token) bool {
			if tk.TokenType != tokenImage {
				return false
			}
			tk.Source = tokenSource.Source
			m.socket.broadcastMapChange(cd, broadcastTokenSourceChange, data, userAny)
			return true
		})
	case "setTokenLayer":
		var tokenLayer struct {
			ID uint64 `jons:"id"`
			To string `json:"to"`
		}
		if err := json.Unmarshal(data, &tokenLayer); err != nil {
			return nil, err
		}
		if len(tokenLayer.To) == 0 || !validTokenLayer(tokenLayer.To) {
			return nil, ErrInvalidLayerPath
		}
		return nil, m.updateMapsLayerToken(cd.CurrentMap, tokenLayer.ID, func(mp *levelMap, l *layer, tk *token) bool {
			ml := getLayer(&mp.layer, tokenLayer.To)
			if ml == nil {
				return false
			}
			l.removeToken(tokenLayer.ID)
			ml.addToken(tk, uint(len(ml.Tokens)))
			m.socket.broadcastMapChange(cd, broadcastTokenMoveLayer, data, userAny)
			return true
		})
	case "setTokenPos":
		var tokenPos struct {
			ID     uint64 `json:"id"`
			NewPos uint   `json:"newPos"`
		}
		var err error
		if err = json.Unmarshal(data, &tokenPos); err != nil {
			return nil, err
		}
		if e := m.updateMapsLayerToken(cd.CurrentMap, tokenPos.ID, func(_ *levelMap, l *layer, tk *token) bool {
			if tokenPos.NewPos >= uint(len(l.Tokens)) {
				err = ErrInvalidTokenPos
				return false
			}
			l.removeToken(tokenPos.ID)
			l.addToken(tk, tokenPos.NewPos)
			m.socket.broadcastMapChange(cd, broadcastTokenMovePos, data, userAny)
			return true
		}); e != nil {
			return nil, e
		}
		return nil, err
	case "shiftLayer":
		var layerShift struct {
			Path string `json:"path"`
			DX   int64  `json:"dx"`
			DY   int64  `json:"dy"`
		}
		if err := json.Unmarshal(data, &layerShift); err != nil {
			return nil, err
		}
		if layerShift.DX == 0 && layerShift.DY == 0 {
			return nil, nil
		}
		return nil, m.updateMapLayer(cd.CurrentMap, layerShift.Path, func(mp *levelMap, l *layer) bool {
			for _, t := range l.Tokens {
				t.X += layerShift.DX
				t.Y += layerShift.DY
			}
			for _, w := range l.Walls {
				w.X1 += layerShift.DX
				w.Y1 += layerShift.DY
				w.X2 += layerShift.DX
				w.Y2 += layerShift.DY
			}
			m.socket.broadcastMapChange(cd, broadcastLayerShift, data, userAny)
			return true
		})
	case "remove":
		var (
			mapPath string
			cu      keystore.Uint64
		)
		if err := json.Unmarshal(data, &mapPath); err != nil {
			return nil, err
		}
		m.config.Get("currentUserMap", &cu)
		if _, _, id := m.getFolderItem(mapPath); id == uint64(cu) {
			return nil, ErrCurrentlySelected
		}
	case "rename":
		var (
			mapPath struct {
				From string `json:"from"`
			}
			cu keystore.Uint64
		)
		if err := json.Unmarshal(data, &mapPath); err != nil {
			return nil, err
		}
		m.config.Get("currentUserMap", &cu)
		if _, _, id := m.getFolderItem(mapPath.From); id == uint64(cu) || id == cd.CurrentMap {
			return nil, ErrCurrentlySelected
		}
	case "removeFolder":
		var (
			mapPath string
			cu      keystore.Uint64
		)
		if err := json.Unmarshal(data, &mapPath); err != nil {
			return nil, err
		}
		m.config.Get("currentUserMap", &cu)
		if f := m.getFolder(mapPath); f != nil {
			if walkFolders(f, func(items map[string]uint64) bool {
				for _, id := range items {
					if id == uint64(cu) || id == cd.CurrentMap {
						return true
					}
				}
				return false
			}) {
				return nil, ErrContainsCurrentlySelected
			}
		}
	case "renameFolder":
		var (
			mapPath struct {
				From string `json:"from"`
			}
			cu keystore.Uint64
		)
		if err := json.Unmarshal(data, &mapPath); err != nil {
			return nil, err
		}
		m.config.Get("currentUserMap", &cu)
		if f := m.getFolder(mapPath.From); f != nil {
			if walkFolders(f, func(items map[string]uint64) bool {
				for _, id := range items {
					if id == uint64(cu) || id == cd.CurrentMap {
						return true
					}
				}
				return false
			}) {
				return nil, ErrContainsCurrentlySelected
			}
		}
	case "link":
		return nil, ErrUnknownMethod
	}
	return m.folders.RPCData(cd, method, data)
}

func validTokenLayer(path string) bool {
	return path != "/Grid" && path != "Light"
}

// Errors
var (
	ErrInvalidData               = errors.New("invalid map data")
	ErrCurrentlySelected         = errors.New("cannot remove or rename currently selected map")
	ErrContainsCurrentlySelected = errors.New("cannot remove or rename as contains currently selected map")
	ErrInvalidLayerPath          = errors.New("invalid layer path")
	ErrInvalidTokenPos           = errors.New("invalid token pos")
)
