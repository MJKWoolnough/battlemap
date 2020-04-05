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
		m.Battlemap.socket.SetCurrentUserMap(uint64(userMap), cd.ID)
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
			return true
		}); err != nil {
			return nil, err
		}
		m.socket.broadcastMapChange(cd.CurrentMap, broadcastMapItemChange, md, cd.ID)
		return nil, nil
	case "setLight":
		var c colour
		if err := json.Unmarshal(data, &c); err != nil {
			return nil, err
		}
		if err := m.updateMapLayer(cd.CurrentMap, "/Light", func(_ *levelMap, l *layer) bool {
			l.Mask = c.ToRGBA()
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
			return true
		})
		return name, err
	case "addLayerFolder":
		var path string
		if err := json.Unmarshal(data, &path); err != nil {
			return nil, err
		}
		parent, name := splitAfterLastSlash(path)
		err := m.updateMapLayer(cd.CurrentMap, parent, func(m *levelMap, l *layer) bool {
			name = uniqueLayer(m.layers, name)
			l.Layers = append(l.Layers, &layer{
				Name:     name,
				IsFolder: true,
			})
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
		err := m.updateMapLayer(cd.CurrentMap, rename.Path, func(m *levelMap, l *layer) bool {
			if l.Name == rename.Name {
				return false
			}
			delete(m.layers, l.Name)
			rename.Name = uniqueLayer(m.layers, rename.Name)
			l.Name = rename.Name
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
			return true
		})
		return nil, err
	case "addToken":
		var token struct {
			*token
			Path string `json:"path"`
		}
		if err := json.Unmarshal(data, &token); err != nil {
			return nil, err
		}
		if err := m.updateMapLayer(cd.CurrentMap, token.Path, func(mp *levelMap, l *layer) bool {
			l.Tokens = append(l.Tokens, token.token)
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
		return nil, m.updateMapLayer(cd.CurrentMap, tokenPos.Path, func(mp *levelMap, l *layer) bool {
			l.removeToken(tokenPos.Pos)
			return true
		})
	case "moveToken":
		var moveToken struct {
			Path string `json:"path"`
			Pos  uint   `json:"pos"`
			X    int64  `json:"x"`
			Y    int64  `json:"y"`
		}
		if err := json.Unmarshal(data, &moveToken); err != nil {
			return nil, err
		}
		return nil, m.updateMapsLayerToken(cd.CurrentMap, moveToken.Path, moveToken.Pos, func(_ *levelMap, _ *layer, tk *token) bool {
			if tk.X == moveToken.X && tk.Y == moveToken.Y {
				return false
			}
			tk.X = moveToken.X
			tk.Y = moveToken.Y
			return true
		})
	case "resizeToken":
		var resizeToken struct {
			Path   string `json:"path"`
			Pos    uint   `json:"pos"`
			Width  int64  `json:"width"`
			Height int64  `json:"height"`
		}
		if err := json.Unmarshal(data, &resizeToken); err != nil {
			return nil, err
		}
		return nil, m.updateMapsLayerToken(cd.CurrentMap, resizeToken.Path, resizeToken.Pos, func(_ *levelMap, _ *layer, tk *token) bool {
			if resizeToken.Width < 0 {
				tk.X += int64(tk.Width) + resizeToken.Width
				resizeToken.Width *= -1
			}
			if resizeToken.Height < 0 {
				tk.Y += int64(tk.Height) + resizeToken.Height
				resizeToken.Height *= -1
			}
			if tk.Width == uint64(resizeToken.Width) && tk.Height == uint64(resizeToken.Height) {
				return false
			}
			tk.Width = uint64(resizeToken.Width)
			tk.Height = uint64(resizeToken.Height)
			return true
		})
	case "rotateToken":
		var rotateToken struct {
			Path     string `json:"path"`
			Pos      uint   `json:"pos"`
			Rotation uint8  `json:"rotation"`
		}
		if err := json.Unmarshal(data, &rotateToken); err != nil {
			return nil, err
		}
		return nil, m.updateMapsLayerToken(cd.CurrentMap, rotateToken.Path, rotateToken.Pos, func(_ *levelMap, _ *layer, tk *token) bool {
			if tk.Rotation == rotateToken.Rotation {
				return false
			}
			tk.Rotation = rotateToken.Rotation
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
		return nil, m.updateMapsLayerToken(cd.CurrentMap, flipToken.Path, flipToken.Pos, func(_ *levelMap, _ *layer, tk *token) bool {
			if tk.Flip == flipToken.Flip {
				return false
			}
			tk.Flip = flipToken.Flip
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
		if len(flopToken.Path) == 0 {
			return nil, ErrInvalidLayerPath
		}
		return nil, m.updateMapsLayerToken(cd.CurrentMap, flopToken.Path, flopToken.Pos, func(_ *levelMap, _ *layer, tk *token) bool {
			if tk.Flop == flopToken.Flop {
				return false
			}
			tk.Flop = flopToken.Flop
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
		return nil, m.updateMapsLayerToken(cd.CurrentMap, tokenSource.Path, tokenSource.Pos, func(_ *levelMap, _ *layer, tk *token) bool {
			if tk.TokenType != tokenImage || tk.Source == tokenSource.Source {
				return false
			}
			tk.Source = tokenSource.Source
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
		if len(tokenLayer.From) == 0 || len(tokenLayer.To) == 0 {
			return nil, ErrInvalidLayerPath
		}
		return nil, m.updateMapsLayerToken(cd.CurrentMap, tokenLayer.From, tokenLayer.FromPos, func(mp *levelMap, l *layer, tk *token) bool {
			m := getLayer(&mp.layer, tokenLayer.To)
			if m == nil {
				return false
			}
			l.removeToken(tokenLayer.FromPos)
			m.addToken(tk, tokenLayer.ToPos)
			return true
		})
	case "setTokenTop":
		var tokenTop struct {
			Path string `json:"path"`
			Pos  uint   `json:"pos"`
		}
		if err := json.Unmarshal(data, &tokenTop); err != nil {
			return nil, err
		}
		return nil, m.updateMapsLayerToken(cd.CurrentMap, tokenTop.Path, tokenTop.Pos, func(_ *levelMap, l *layer, tk *token) bool {
			l.removeToken(tokenTop.Pos)
			l.addToken(tk, uint(len(l.Tokens)))
			return true
		})
	case "setTokenBottom":
		var tokenBottom struct {
			Path string `json:"path"`
			Pos  uint   `json:"pos"`
		}
		if err := json.Unmarshal(data, &tokenBottom); err != nil {
			return nil, err
		}
		return nil, m.updateMapsLayerToken(cd.CurrentMap, tokenBottom.Path, tokenBottom.Pos, func(_ *levelMap, l *layer, tk *token) bool {
			l.removeToken(tokenBottom.Pos)
			l.addToken(tk, 0)
			return true
		})
	case "setInitiative":
		var initiative [][2]uint64
		if err := json.Unmarshal(data, &initiative); err != nil {
			return nil, err
		}
		return nil, m.updateMapData(cd.CurrentMap, func(mp *levelMap) bool {
			mp.Initiative = initiative
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
)
