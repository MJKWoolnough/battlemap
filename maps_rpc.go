package battlemap

import (
	"bytes"
	"encoding/json"
	"errors"

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
			wall
		}
		if err := json.Unmarshal(data, &wallAdd); err != nil {
			return nil, err
		}
		if err := m.updateMapLayer(cd.CurrentMap, wallAdd.Path, func(_ *levelMap, l *layer) bool {
			l.Walls = append(l.Walls, wallAdd.wall)
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
		if rename.Path == "/Grid" || rename.Path == "/Light" {
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
		if (moveLayer.From == "/Grid" || moveLayer.From == "/Light") && moveLayer.To != "/" {
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
		if path == "/Grid" || path == "/Light" {
			return nil, ErrUnknownLayer
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
			*token
			Path string `json:"path"`
		}
		newToken.token = new(token)
		if err := json.Unmarshal(data, &newToken); err != nil {
			return nil, err
		}
		if newToken.Path == "/Grid" || newToken.Path == "/Light" {
			return nil, ErrInvalidLayerPath
		}
		if err := newToken.validate(); err != nil {
			return nil, err
		}
		tokenID := zeroJSON
		var e error
		if err := m.updateMapLayer(cd.CurrentMap, newToken.Path, func(mp *levelMap, l *layer) bool {
			if newToken.TokenType == tokenImage {
				if newToken.TokenData != nil && !bytes.Equal(newToken.TokenData, zeroJSON) {
					if newToken.TokenData, e = m.tokens.cloneData(newToken.TokenData, true); e != nil {
						return false
					}
					tokenID = newToken.TokenData
					data = json.RawMessage(newToken.appendTo(data[:0]))
				}
				m.images.setHiddenLink(newToken.Source)
			}
			l.Tokens = append(l.Tokens, newToken.token)
			m.socket.broadcastMapChange(cd, broadcastTokenAdd, data)
			return true
		}); err != nil {
			return nil, err
		}
		return tokenID, e
	case "removeToken":
		var tokenPos struct {
			Path string `json:"path"`
			Pos  uint   `json:"pos"`
		}
		if err := json.Unmarshal(data, &tokenPos); err != nil {
			return nil, err
		}
		if tokenPos.Path == "/Grid" || tokenPos.Path == "/Light" {
			return nil, ErrInvalidLayerPath
		}
		return nil, m.updateMapsLayerToken(cd.CurrentMap, tokenPos.Path, tokenPos.Pos, func(mp *levelMap, l *layer, tk *token) bool {
			m.cleanupTokenRemove(mp, l, tk)
			l.removeToken(tokenPos.Pos)
			m.socket.broadcastMapChange(cd, broadcastTokenRemove, data)
			return true
		})
	case "setToken":
		var setToken struct {
			Path     string `json:"path"`
			Pos      uint   `json:"pos"`
			X        int64  `json:"x"`
			Y        int64  `json:"y"`
			Width    uint64 `json:"width"`
			Height   uint64 `json:"height"`
			Rotation uint8  `json:"rotation"`
		}
		if err := json.Unmarshal(data, &setToken); err != nil {
			return nil, err
		}
		if setToken.Path == "/Grid" || setToken.Path == "/Light" {
			return nil, ErrInvalidLayerPath
		}
		return nil, m.updateMapsLayerToken(cd.CurrentMap, setToken.Path, setToken.Pos, func(_ *levelMap, _ *layer, tk *token) bool {
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
			Path string `json:"path"`
			Pos  uint   `json:"pos"`
			Flip bool   `json:"flip"`
		}
		if err := json.Unmarshal(data, &flipToken); err != nil {
			return nil, err
		}
		if flipToken.Path == "/Grid" || flipToken.Path == "/Light" {
			return nil, ErrInvalidLayerPath
		}
		return nil, m.updateMapsLayerToken(cd.CurrentMap, flipToken.Path, flipToken.Pos, func(_ *levelMap, _ *layer, tk *token) bool {
			if tk.Flip == flipToken.Flip {
				return false
			}
			tk.Flip = flipToken.Flip
			m.socket.broadcastMapChange(cd, broadcastTokenFlip, data)
			return true
		})
	case "flopToken":
		var flopToken struct {
			Path string `json:"path"`
			Pos  uint   `json:"pos"`
			Flop bool   `json:"flop"`
		}
		if err := json.Unmarshal(data, &flopToken); err != nil {
			return nil, err
		}
		if flopToken.Path == "/Grid" || flopToken.Path == "/Light" {
			return nil, ErrInvalidLayerPath
		}
		return nil, m.updateMapsLayerToken(cd.CurrentMap, flopToken.Path, flopToken.Pos, func(_ *levelMap, _ *layer, tk *token) bool {
			if tk.Flop == flopToken.Flop {
				return false
			}
			tk.Flop = flopToken.Flop
			m.socket.broadcastMapChange(cd, broadcastTokenFlop, data)
			return true
		})
	case "setTokenSnap":
		var snapToken struct {
			Path string `json:"path"`
			Pos  uint   `json:"pos"`
			Snap bool   `json:"snap"`
		}
		if err := json.Unmarshal(data, &snapToken); err != nil {
			return nil, err
		}
		if snapToken.Path == "/Grid" || snapToken.Path == "/Light" {
			return nil, ErrInvalidLayerPath
		}
		return nil, m.updateMapsLayerToken(cd.CurrentMap, snapToken.Path, snapToken.Pos, func(mp *levelMap, _ *layer, tk *token) bool {
			if tk.Snap == snapToken.Snap {
				return false
			}
			tk.Snap = snapToken.Snap
			m.socket.broadcastMapChange(cd, broadcastTokenSnap, data)
			return true
		})
	case "setTokenPattern":
		var patternToken struct {
			Path string `json:"path"`
			Pos  uint   `json:"pos"`
		}
		if err := json.Unmarshal(data, &patternToken); err != nil {
			return nil, err
		}
		if patternToken.Path == "/Grid" || patternToken.Path == "/Light" {
			return nil, ErrInvalidLayerPath
		}
		return nil, m.updateMapsLayerToken(cd.CurrentMap, patternToken.Path, patternToken.Pos, func(mp *levelMap, _ *layer, tk *token) bool {
			if tk.PatternWidth > 0 || tk.TokenType != tokenImage {
				return false
			}
			tk.PatternWidth = tk.Width
			tk.PatternHeight = tk.Height
			m.socket.broadcastMapChange(cd, broadcastTokenSetPattern, data)
			return true

		})
	case "setTokenImage":
		var imageToken struct {
			Path string `json:"path"`
			Pos  uint   `json:"pos"`
		}
		if err := json.Unmarshal(data, &imageToken); err != nil {
			return nil, err
		}
		if imageToken.Path == "/Grid" || imageToken.Path == "/Light" {
			return nil, ErrInvalidLayerPath
		}
		return nil, m.updateMapsLayerToken(cd.CurrentMap, imageToken.Path, imageToken.Pos, func(mp *levelMap, _ *layer, tk *token) bool {
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
			Path   string `json:"path"`
			Pos    uint   `json:"pos"`
			Source uint64 `json:"src"`
		}
		if err := json.Unmarshal(data, &tokenSource); err != nil {
			return nil, err
		}
		if tokenSource.Path == "/Grid" || tokenSource.Path == "/Light" {
			return nil, ErrInvalidLayerPath
		}
		return nil, m.updateMapsLayerToken(cd.CurrentMap, tokenSource.Path, tokenSource.Pos, func(_ *levelMap, _ *layer, tk *token) bool {
			if tk.TokenType != tokenImage {
				return false
			}
			tk.Source = tokenSource.Source
			m.socket.broadcastMapChange(cd, broadcastTokenSourceChange, data)
			return true
		})
	case "setTokenLayer":
		var tokenLayer struct {
			From string `json:"from"`
			To   string `json:"to"`
			Pos  uint   `json:"pos"`
		}
		if err := json.Unmarshal(data, &tokenLayer); err != nil {
			return nil, err
		}
		if len(tokenLayer.From) == 0 || len(tokenLayer.To) == 0 || tokenLayer.From == "/Grid" || tokenLayer.From == "/Light" || tokenLayer.To == "/Grid" || tokenLayer.To == "/Light" {
			return nil, ErrInvalidLayerPath
		}
		return nil, m.updateMapsLayerToken(cd.CurrentMap, tokenLayer.From, tokenLayer.Pos, func(mp *levelMap, l *layer, tk *token) bool {
			ml := getLayer(&mp.layer, tokenLayer.To)
			if ml == nil {
				return false
			}
			l.removeToken(tokenLayer.Pos)
			ml.addToken(tk, uint(len(ml.Tokens)))
			m.socket.broadcastMapChange(cd, broadcastTokenMoveLayer, data)
			return true
		})
	case "setTokenPos":
		var tokenPos struct {
			Path   string `json:"path"`
			Pos    uint   `json:"pos"`
			NewPos uint   `json:"newPos"`
		}
		var err error
		if err = json.Unmarshal(data, &tokenPos); err != nil {
			return nil, err
		}
		if e := m.updateMapsLayerToken(cd.CurrentMap, tokenPos.Path, tokenPos.Pos, func(_ *levelMap, l *layer, tk *token) bool {
			if tokenPos.NewPos >= uint(len(l.Tokens)) {
				err = ErrInvalidTokenPos
				return false
			}
			l.removeToken(tokenPos.Pos)
			l.addToken(tk, tokenPos.NewPos)
			m.socket.broadcastMapChange(cd, broadcastTokenMovePos, data)
			return true
		}); e != nil {
			return nil, e
		}
		return nil, err
	case "setAsToken":
		var tokenPos struct {
			Path string `json:"path"`
			Pos  uint   `json:"pos"`
		}
		var rm json.RawMessage
		if err := json.Unmarshal(data, &tokenPos); err != nil {
			return nil, err
		}
		if err := m.updateMapsLayerToken(cd.CurrentMap, tokenPos.Path, tokenPos.Pos, func(_ *levelMap, l *layer, tk *token) bool {
			if tk.TokenType != tokenImage {
				return false
			}
			tk.TokenData = m.tokens.createFromID()
			if cap(data) >= len(rm)+len(data)+6 {
				data = data[:len(data)-1]
			} else {
				data = append(make(json.RawMessage, 0, len(rm)+len(data)+6), data...)
			}
			m.socket.broadcastMapChange(cd, broadcastTokenSetData, append(append(append(data[:len(data)-1], ',', '"', 'i', 'd', '"', ':'), rm...), '}'))
			return true
		}); err != nil {
			return nil, err
		}
		return rm, nil
	case "unsetAsToken":
		var tokenPos struct {
			Path string `json:"path"`
			Pos  uint   `json:"pos"`
		}
		if err := json.Unmarshal(data, &tokenPos); err != nil {
			return nil, err
		}
		return nil, m.updateMapsLayerToken(cd.CurrentMap, tokenPos.Path, tokenPos.Pos, func(_ *levelMap, l *layer, tk *token) bool {
			if tk.TokenType != tokenImage {
				return false
			}
			if bytes.Equal(tk.TokenData, zeroJSON) {
				return false
			}
			m.tokens.itemDeleteString(string(tk.TokenData))
			tk.TokenData = zeroJSON
			m.socket.broadcastMapChange(cd, broadcastTokenUnsetData, data)
			return true
		})
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
		return nil, m.updateMapLayer(cd.CurrentMap, layerShift.Path, func(_ *levelMap, l *layer) bool {
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

// Errors
var (
	ErrInvalidData               = errors.New("invalid map data")
	ErrCurrentlySelected         = errors.New("cannot remove or rename currently selected map")
	ErrContainsCurrentlySelected = errors.New("cannot remove or rename as contains currently selected map")
	ErrInvalidLayerPath          = errors.New("invalid layer path")
	ErrInvalidTokenPos           = errors.New("invalid token pos")
)
