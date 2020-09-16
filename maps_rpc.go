package battlemap

import (
	"bytes"
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
			if mp.Width == md.Width && mp.Height == md.Height {
				return false
			}
			mp.Width = md.Width
			mp.Height = md.Height
			mp.GridSize = md.GridSize
			mp.GridColour = md.GridColour
			mp.GridStroke = md.GridStroke
			m.socket.broadcastMapChange(cd, broadcastMapItemChange, data)
			return true
		})
	case "setLightColour":
		var c colour
		if err := json.Unmarshal(data, &c); err != nil {
			return nil, err
		}
		if err := m.updateMapData(cd.CurrentMap, func(mp *levelMap) bool {
			mp.Light = c
			m.socket.broadcastMapChange(cd, broadcastMapLightChange, data)
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
			m.socket.broadcastMapChange(cd, broadcastLightShift, data)
			return true
		}); err != nil {
			return nil, err
		}
		return nil, nil
	case "addWall":
		var wallAdd struct {
			Path string `json:"path"`
			*layerWall
		}
		wallAdd.layerWall = new(layerWall)
		if err := json.Unmarshal(data, &wallAdd); err != nil {
			return nil, err
		}
		if !validTokenLayer(wallAdd.Path) {
			return nil, ErrInvalidLayerPath
		}
		if err := m.updateMapLayer(cd.CurrentMap, wallAdd.Path, func(mp *levelMap, l *layer) bool {
			mp.lastWallID++
			l.Walls = append(l.Walls, mp.lastWallID)
			mp.Walls[mp.lastWallID] = wallAdd.layerWall
			m.socket.broadcastMapChange(cd, broadcastWallAdd, data)
			return true
		}); err != nil {
			return nil, err
		}
		return nil, nil
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
			m.socket.broadcastMapChange(cd, broadcastWallRemove, data)
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
			m.socket.broadcastMapChange(cd, broadcastLayerAdd, data)
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
			m.socket.broadcastMapChange(cd, broadcastLayerFolderAdd, data)
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
			m.socket.broadcastMapChange(cd, broadcastLayerRename, data)
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
			m.socket.broadcastMapChange(cd, broadcastLayerMove, data)
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
			m.socket.broadcastMapChange(cd, broadcastLayerShow, data)
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
			m.socket.broadcastMapChange(cd, broadcastLayerHide, data)
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
			m.socket.broadcastMapChange(cd, broadcastLayerMaskAdd, data)
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
			m.socket.broadcastMapChange(cd, broadcastLayerMaskRemove, data)
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
			m.socket.broadcastMapChange(cd, broadcastLayerRemove, data)
			return true
		})
		return nil, err
	case "addToken":
		var newToken struct {
			*layerToken
			Path string `json:"path"`
		}
		newToken.layerToken = new(layerToken)
		if err := json.Unmarshal(data, &newToken); err != nil {
			return nil, err
		}
		if !validTokenLayer(newToken.Path) {
			return nil, ErrInvalidLayerPath
		}
		if err := newToken.validate(); err != nil {
			return nil, err
		}
		tokenID := zeroJSON
		var e error
		if err := m.updateMapLayer(cd.CurrentMap, newToken.Path, func(mp *levelMap, l *layer) bool {
			if newToken.TokenType == tokenImage {
				var id uint64
				for key, data := range newToken.TokenData {
					if f := m.isLinkKey(key); f != nil {
						json.Unmarshal(data.Data, &id)
						f.setHiddenLink(id)
					}
				}
				m.images.setHiddenLink(newToken.Source)
			}
			mp.lastTokenID++
			l.Tokens = append(l.Tokens, mp.lastTokenID)
			mp.Tokens[mp.lastTokenID] = newToken.layerToken
			m.socket.broadcastMapChange(cd, broadcastTokenAdd, data)
			return true
		}); err != nil {
			return nil, err
		}
		return tokenID, e
	case "modifyTokenData":
		var modifyToken struct {
			id       uint64                  `json:"id"`
			Setting  map[string]keystoreData `json:"setting"`
			Removing []string                `json:"removing"`
		}
		if err := json.Unmarshal(data, &modifyToken); err != nil {
			return nil, err
		}
		return nil, m.updateMapsToken(cd.CurrentMap, modifyToken.id, func(_ *levelMap, tk *layerToken) bool {
			m.socket.broadcastAdminChange(broadcastTokenDataChange, data, cd.ID)
			data := strconv.AppendUint(append(data[:0], "{\"id\":"...), modifyToken.id, 10)
			data = append(data, ",\"setting\":{"...)
			changed := false
			first := true
			var id uint64
			for key, kd := range modifyToken.Setting {
				if f := m.isLinkKey(key); f != nil {
					if d, ok := tk.TokenData[key]; ok {
						if !bytes.Equal(kd.Data, d.Data) {
							json.Unmarshal(d.Data, &id)
							f.removeHiddenLink(id)
							json.Unmarshal(kd.Data, &id)
							f.setHiddenLink(id)
						}
					} else {
						json.Unmarshal(kd.Data, &id)
						f.setHiddenLink(id)
					}
				}
				if kd.User {
					if !first {
						data = append(data, ',')
					} else {
						first = false
					}
					data = append(append(append(data, "{\"user\":true,\"data\":"...), kd.Data...), '}')
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
					var id uint64
					json.Unmarshal(d.Data, &id)
					f.removeHiddenLink(id)
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
				data = append(data, ']')
				m.socket.broadcastMapChange(cd, broadcastTokenDataChange, data)
			}
			return changed
		})
	case "removeToken":
		var tokenID uint64
		if err := json.Unmarshal(data, &tokenID); err != nil {
			return nil, err
		}
		return nil, m.updateMapsToken(cd.CurrentMap, tokenID, func(mp *levelMap, tk *layerToken) bool {
			m.cleanupTokenRemove(mp, tk)
			delete(mp.Tokens, tokenID)
			tk.layer.removeToken(tokenID)
			m.socket.broadcastMapChange(cd, broadcastTokenRemove, data)
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
		return nil, m.updateMapsToken(cd.CurrentMap, setToken.ID, func(_ *levelMap, tk *layerToken) bool {
			if tk.X == setToken.X && tk.Y == setToken.Y && tk.Width == setToken.Width && tk.Height == setToken.Height && tk.Rotation == setToken.Rotation {
				return false
			}
			tk.X = setToken.X
			tk.Y = setToken.Y
			tk.Width = setToken.Width
			tk.Height = setToken.Height
			tk.Rotation = setToken.Rotation
			m.socket.broadcastMapChange(cd, broadcastTokenChange, data)
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
		return nil, m.updateMapsToken(cd.CurrentMap, flipToken.ID, func(_ *levelMap, tk *layerToken) bool {
			if tk.Flip == flipToken.Flip {
				return false
			}
			tk.Flip = flipToken.Flip
			m.socket.broadcastMapChange(cd, broadcastTokenFlip, data)
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
		return nil, m.updateMapsToken(cd.CurrentMap, flopToken.ID, func(_ *levelMap, tk *layerToken) bool {
			if tk.Flop == flopToken.Flop {
				return false
			}
			tk.Flop = flopToken.Flop
			m.socket.broadcastMapChange(cd, broadcastTokenFlop, data)
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
		return nil, m.updateMapsToken(cd.CurrentMap, snapToken.ID, func(mp *levelMap, tk *layerToken) bool {
			if tk.Snap == snapToken.Snap {
				return false
			}
			tk.Snap = snapToken.Snap
			m.socket.broadcastMapChange(cd, broadcastTokenSnap, data)
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
		return nil, m.updateMapsToken(cd.CurrentMap, lightToken.ID, func(_ *levelMap, tk *layerToken) bool {
			if tk.LightIntesity == lightToken.LightIntensity && tk.LightColour.R == lightToken.LightColour.R && tk.LightColour.G == lightToken.LightColour.G && tk.LightColour.B == lightToken.LightColour.B && tk.LightColour.A == lightToken.LightColour.A {
				return false
			}
			tk.LightIntesity = lightToken.LightIntensity
			tk.LightColour = lightToken.LightColour
			m.socket.broadcastMapChange(cd, broadcastTokenLightChange, data)
			return true
		})
	case "setTokenPattern":
		var patternToken uint64
		if err := json.Unmarshal(data, &patternToken); err != nil {
			return nil, err
		}
		return nil, m.updateMapsToken(cd.CurrentMap, patternToken, func(mp *levelMap, tk *layerToken) bool {
			if tk.PatternWidth > 0 || tk.TokenType != tokenImage {
				return false
			}
			tk.PatternWidth = tk.Width
			tk.PatternHeight = tk.Height
			m.socket.broadcastMapChange(cd, broadcastTokenSetPattern, data)
			return true

		})
	case "setTokenImage":
		var imageToken uint64
		if err := json.Unmarshal(data, &imageToken); err != nil {
			return nil, err
		}
		return nil, m.updateMapsToken(cd.CurrentMap, imageToken, func(mp *levelMap, tk *layerToken) bool {
			if tk.PatternWidth == 0 || tk.TokenType != tokenImage {
				return false
			}
			tk.PatternWidth = 0
			tk.PatternHeight = 0
			m.socket.broadcastMapChange(cd, broadcastTokenSetImage, data)
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
		return nil, m.updateMapsToken(cd.CurrentMap, tokenSource.ID, func(_ *levelMap, tk *layerToken) bool {
			if tk.TokenType != tokenImage {
				return false
			}
			tk.Source = tokenSource.Source
			m.socket.broadcastMapChange(cd, broadcastTokenSourceChange, data)
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
		return nil, m.updateMapsToken(cd.CurrentMap, tokenLayer.ID, func(mp *levelMap, tk *layerToken) bool {
			ml := getLayer(&mp.layer, tokenLayer.To)
			if ml == nil {
				return false
			}
			tk.layer.removeToken(tokenLayer.ID)
			ml.addToken(tk, tokenLayer.ID, uint(len(ml.Tokens)))
			m.socket.broadcastMapChange(cd, broadcastTokenMoveLayer, data)
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
		if e := m.updateMapsToken(cd.CurrentMap, tokenPos.ID, func(_ *levelMap, tk *layerToken) bool {
			if tokenPos.NewPos >= uint(len(tk.layer.Tokens)) {
				err = ErrInvalidTokenPos
				return false
			}
			tk.layer.removeToken(tokenPos.ID)
			tk.layer.addToken(tk, tokenPos.ID, tokenPos.NewPos)
			m.socket.broadcastMapChange(cd, broadcastTokenMovePos, data)
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
				if tk, ok := mp.Tokens[t]; ok {
					tk.X += layerShift.DX
					tk.Y += layerShift.DY
				}
			}
			for _, w := range l.Walls {
				if wall, ok := mp.Walls[w]; ok {
					wall.X1 += layerShift.DX
					wall.Y1 += layerShift.DY
					wall.X2 += layerShift.DX
					wall.Y2 += layerShift.DY
				}
			}
			m.socket.broadcastMapChange(cd, broadcastLayerShift, data)
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
