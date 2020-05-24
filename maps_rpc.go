package battlemap

import (
	"encoding/json"
	"errors"
	"strconv"
	"strings"

	"vimagination.zapto.org/keystore"
)

func (m *mapsDir) RPCData(cd ConnData, method string, data []byte) (interface{}, error) {
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
		if _, ok := m.links[uint64(userMap)]; !ok {
			return nil, ErrUnknownMap
		}
		m.Battlemap.config.Set("currentUserMap", &userMap)
		m.Battlemap.socket.SetCurrentUserMap(uint64(userMap), data, cd.ID)
		return nil, nil
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
		if err := m.updateMapData(cd.CurrentMap, func(mp *levelMap) bool {
			if mp.Width == md.Width && mp.Height == md.Height {
				return false
			}
			mp.Width = md.Width
			mp.Height = md.Height
			mp.Patterns["gridPattern"] = genGridPattern(md.SquaresWidth, md.SquaresColour, md.SquaresStroke)
			m.socket.broadcastMapChange(cd, broadcastMapItemChange, data)
			return true
		}); err != nil {
			return nil, err
		}
		return nil, nil
	case "setLightColour":
		var c colour
		if err := json.Unmarshal(data, &c); err != nil {
			return nil, err
		}
		if err := m.updateMapLayer(cd.CurrentMap, "/Light", func(_ *levelMap, l *layer) bool {
			l.Tokens[0].Source = c.ToRGBA()
			m.socket.broadcastMapChange(cd, broadcastMapLightChange, data)
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
			name = uniqueLayer(mp.layers, name)
			mp.Layers = append(mp.Layers, &layer{
				Name: name,
			})
			mp.layers[name] = struct{}{}
			m.socket.broadcastMapChange(cd, broadcastLayerAdd, data)
			return true
		})
		return name, err
	case "addLayerFolder":
		var path string
		if err := json.Unmarshal(data, &path); err != nil {
			return nil, err
		}
		parent, name := splitAfterLastSlash(path)
		err := m.updateMapLayer(cd.CurrentMap, parent, func(lm *levelMap, l *layer) bool {
			name = uniqueLayer(lm.layers, name)
			l.Layers = append(l.Layers, &layer{
				Name:     name,
				IsFolder: true,
			})
			m.socket.broadcastMapChange(cd, broadcastLayerFolderAdd, data)
			return true
		})
		return name, err
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
			rename.Name = uniqueLayer(lm.layers, rename.Name)
			l.Name = rename.Name
			m.socket.broadcastMapChange(cd, broadcastLayerRename, data)
			return true
		})
		return rename.Name, err
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
			if np == nil || !np.IsFolder {
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
		return moveLayer.To, err
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
			mask := "/masks/" + strconv.FormatUint(addMask.Mask, 10)
			if l.Mask == mask {
				return false
			}
			l.Mask = mask
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
			if l.Mask == "" {
				return false
			}
			l.Mask = ""
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
		if err := m.updateMapLayer(cd.CurrentMap, newToken.Path, func(mp *levelMap, l *layer) bool {
			l.Tokens = append(l.Tokens, newToken.token)
			m.socket.broadcastMapChange(cd, broadcastTokenAdd, data)
			return true
		}); err != nil {
			return nil, err
		}
		return nil, nil
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
		return nil, m.updateMapLayer(cd.CurrentMap, tokenPos.Path, func(mp *levelMap, l *layer) bool {
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
			if tk.TokenType != tokenImage {
				return false
			}
			var (
				num    uint64
				idName string
			)
			for {
				idName = "Pattern_" + strconv.FormatUint(num, 10)
				if _, ok := mp.Patterns[idName]; !ok {
					break
				}
				num++
			}
			idStr := "url(#" + idName + ")"
			mp.Patterns[idName] = &pattern{
				ID:     idName,
				Width:  tk.Width,
				Height: tk.Height,
				Image: &token{
					Source:    tk.Source,
					Width:     tk.Width,
					Height:    tk.Height,
					TokenType: tokenImage,
				},
			}
			tk.TokenType = tokenPattern
			tk.Source = idStr
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
			if tk.TokenType != tokenPattern {
				return false
			}
			tk.TokenType = tokenImage
			id := strings.TrimSuffix(strings.TrimPrefix(tk.Source, "url(#"), ")")
			if p, ok := mp.Patterns[id]; ok {
				delete(mp.Patterns, id)
				tk.Source = p.Image.Source
			}
			m.socket.broadcastMapChange(cd, broadcastTokenSetImage, data)
			return true
		})
	case "setTokenSource":
		var tokenSource struct {
			Path   string `json:"path"`
			Pos    uint   `json:"pos"`
			Source string `json:"source"`
		}
		if err := json.Unmarshal(data, &tokenSource); err != nil {
			return nil, err
		}
		if tokenSource.Path == "/Grid" || tokenSource.Path == "/Light" {
			return nil, ErrInvalidLayerPath
		}
		return nil, m.updateMapsLayerToken(cd.CurrentMap, tokenSource.Path, tokenSource.Pos, func(_ *levelMap, _ *layer, tk *token) bool {
			if tk.TokenType != tokenImage || tk.Source == tokenSource.Source {
				return false
			}
			tk.Source = tokenSource.Source
			m.socket.broadcastMapChange(cd, broadcastTokenSourceChange, data)
			return true
		})
	case "setTokenLayer":
		var tokenLayer struct {
			From    string `json:"from"`
			FromPos uint   `json:"fromPos"`
			To      string `json:"to"`
			ToPos   uint   `json:"toPos"`
		}
		if err := json.Unmarshal(data, &tokenLayer); err != nil {
			return nil, err
		}
		if len(tokenLayer.From) == 0 || len(tokenLayer.To) == 0 || tokenLayer.From == "/Grid" || tokenLayer.From == "/Light" || tokenLayer.To == "/Grid" || tokenLayer.To == "/Light" {
			return nil, ErrInvalidLayerPath
		}
		return nil, m.updateMapsLayerToken(cd.CurrentMap, tokenLayer.From, tokenLayer.FromPos, func(mp *levelMap, l *layer, tk *token) bool {
			m := getLayer(&mp.layer, tokenLayer.To)
			if m == nil {
				return false
			}
			l.removeToken(tokenLayer.FromPos)
			m.addToken(tk, tokenLayer.ToPos)
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
			m.socket.broadcastMapChange(cd, broadcastTokenSourceChange, data)
			return true
		}); e != nil {
			return nil, e
		}
		return nil, err
	case "setInitiative":
		var initiative [][2]uint64
		if err := json.Unmarshal(data, &initiative); err != nil {
			return nil, err
		}
		return nil, m.updateMapData(cd.CurrentMap, func(mp *levelMap) bool {
			mp.Initiative = initiative
			m.socket.broadcastMapChange(cd, broadcastMapInitiative, data)
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
