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
	case "getMapDetails":
		var id uint64
		if err := json.Unmarshal(data, &id); err != nil {
			return nil, err
		}
		m.mu.RLock()
		defer m.mu.RUnlock()
		mp, ok := m.maps[id]
		if !ok {
			return nil, ErrUnknownMap
		}
		var (
			sqWidth  uint64 = 10
			sqColour colour
			sqStroke uint64 = 1
		)
		for _, p := range mp.Patterns {
			if p.ID == "gridPattern" {
				sqWidth = p.Width
				sqColour = p.Path.Stroke
				sqStroke = p.Path.StrokeWidth
				break
			}
		}
		return mapDetails{
			Name:          mp.Name,
			Width:         mp.Width,
			Height:        mp.Height,
			SquaresWidth:  sqWidth,
			SquaresColour: sqColour,
			SquaresStroke: sqStroke,
		}, nil
	case "setMapDetails":
		var md mapDetails
		if err := json.Unmarshal(data, &md); err != nil {
			return nil, err
		}
		if md.Width == 0 || md.Height == 0 {
			return nil, ErrInvalidData
		}
		if err := m.updateMapData(md.ID, func(mp *levelMap) bool {
			unchanged := mp.Width == md.Width && mp.Height == md.Height && mp.Name == md.Name
			mp.Name = md.Name
			mp.Width = md.Width
			mp.Height = md.Height
			for n := range mp.Patterns {
				p := &mp.Patterns[n]
				if p.ID == "gridPattern" {
					if p.Path == nil {
						mp.Patterns[n] = genGridPattern(md.SquaresWidth, md.SquaresColour, md.SquaresStroke)
					} else {
						if p.Width == md.SquaresWidth && p.Height == md.SquaresWidth && p.Path.Stroke == md.SquaresColour && p.Path.StrokeWidth == md.SquaresWidth {
							return !unchanged
						}
						p.Width = md.SquaresWidth
						p.Height = md.SquaresWidth
						p.Path.Path = genGridPath(md.SquaresWidth)
						p.Path.Stroke = md.SquaresColour
						p.Path.StrokeWidth = md.SquaresWidth
					}
					return true
				}
			}
			mp.Patterns = append(mp.Patterns, genGridPattern(md.SquaresWidth, md.SquaresColour, md.SquaresStroke))
			return true
		}); err != nil {
			return nil, err
		}
		m.socket.broadcastMapChange(md.ID, broadcastMapItemChange, md, cd.ID)
		return nil, nil
	case "addLayer":
		var name string
		if err := json.Unmarshal(data, &name); err != nil {
			return nil, err
		}
		m.updateMapData(cd.CurrentMap, func(mp *levelMap) bool {
			mp.Children = append(mp.Children, &layer{
				Name: name,
			})
			return true
		})
		return name, nil
	case "renameLayer":
		var rename struct {
			Path []uint `json:"path"`
			Name string `json:"name"`
		}
		if err := json.Unmarshal(data, &rename); err != nil {
			return nil, err
		}
		if len(rename.Path) == 0 {
			return nil, ErrInvalidLayerPath
		}
		return nil, m.updateMapLayer(cd.CurrentMap, rename.Path, func(_ *levelMap, l *layer) bool {
			if l.Name == rename.Name {
				return false
			}
			l.Name = rename.Name
			return true
		})
	case "moveLayer":
		var moveLayer struct {
			From     []uint `json:"from"`
			To       []uint `json:"to"`
			Position uint   `json:"position"`
		}
		err := json.Unmarshal(data, &moveLayer)
		if err != nil {
			return nil, err
		}
		if len(moveLayer.From) == 0 || len(moveLayer.To) == 0 {
			return nil, ErrInvalidLayerPath
		}
		err = m.updateMapData(cd.CurrentMap, func(mp *levelMap) bool {
			op, l := getParentLayer(&mp.layer, moveLayer.From)
			if l == nil {
				err = ErrUnknownLayer
				return false
			}
			np, _ := getParentLayer(&mp.layer, moveLayer.To)
			if np == nil {
				err = ErrUnknownLayer
				return false
			}
			op.removeLayer(moveLayer.From[len(moveLayer.From)-1])
			np.addLayer(l, moveLayer.Position)
			return false
		})
		return moveLayer.To, err
	case "showLayer":
		var path []uint
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
		var path []uint
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
			Path []uint `json:"path"`
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
		var path []uint
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
		var path []uint
		err := json.Unmarshal(data, &path)
		if err != nil {
			return nil, err
		}
		if len(path) == 0 {
			return nil, ErrInvalidLayerPath
		}
		err = m.updateMapData(cd.CurrentMap, func(mp *levelMap) bool {
			p, l := getParentLayer(&mp.layer, path)
			if l != nil {
				p.removeLayer(path[len(path)-1])
				return true
			}
			return false
		})
		return nil, err
	case "addToken":
		var token struct {
			*token
			Path []uint `json:"path"`
		}
		if len(token.Path) == 0 {
			return nil, ErrInvalidLayerPath
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
		var path []uint
		if err := json.Unmarshal(data, &path); err != nil {
			return nil, err
		}
		if len(path) == 0 {
			return nil, ErrInvalidLayerPath
		}
		return nil, m.updateMapData(cd.CurrentMap, func(mp *levelMap) bool {
			p, t := getParentToken(&mp.layer, path)
			if t != nil {
				p.removeToken(path[len(path)-1])
				return true
			}
			return false
		})
	case "moveToken":
		var moveToken struct {
			Path []uint `json:"path"`
			X    int64  `json:"x"`
			Y    int64  `json:"y"`
		}
		if err := json.Unmarshal(data, &moveToken); err != nil {
			return nil, err
		}
		if len(moveToken.Path) == 0 {
			return nil, ErrInvalidLayerPath
		}
		return nil, m.updateMapsLayerToken(cd.CurrentMap, moveToken.Path, func(_ *levelMap, _ *layer, tk *token) bool {
			if tk.X == moveToken.X && tk.Y == moveToken.Y {
				return false
			}
			tk.X = moveToken.X
			tk.Y = moveToken.Y
			return true
		})
	case "resizeToken":
		var resizeToken struct {
			Path   []uint `json:"path"`
			Width  int64  `json:"width"`
			Height int64  `json:"height"`
		}
		if err := json.Unmarshal(data, &resizeToken); err != nil {
			return nil, err
		}
		if len(resizeToken.Path) == 0 {
			return nil, ErrInvalidLayerPath
		}
		return nil, m.updateMapsLayerToken(cd.CurrentMap, resizeToken.Path, func(_ *levelMap, _ *layer, tk *token) bool {
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
			Path     []uint `json:"path"`
			Rotation uint8  `json:"rotation"`
		}
		if err := json.Unmarshal(data, &rotateToken); err != nil {
			return nil, err
		}
		if len(rotateToken.Path) == 0 {
			return nil, ErrInvalidLayerPath
		}
		return nil, m.updateMapsLayerToken(cd.CurrentMap, rotateToken.Path, func(_ *levelMap, _ *layer, tk *token) bool {
			if tk.Rotation == rotateToken.Rotation {
				return false
			}
			tk.Rotation = rotateToken.Rotation
			return true
		})
	case "flipToken":
		var flipToken struct {
			Path []uint `json:"path"`
			Flip bool   `json:"flip"`
		}
		if err := json.Unmarshal(data, &flipToken); err != nil {
			return nil, err
		}
		if len(flipToken.Path) == 0 {
			return nil, ErrInvalidLayerPath
		}
		return nil, m.updateMapsLayerToken(cd.CurrentMap, flipToken.Path, func(_ *levelMap, _ *layer, tk *token) bool {
			if tk.Flip == flipToken.Flip {
				return false
			}
			tk.Flip = flipToken.Flip
			return true
		})
	case "flopToken":
		var flopToken struct {
			Path []uint `json:"path"`
			Flop bool   `json:"flop"`
		}
		if err := json.Unmarshal(data, &flopToken); err != nil {
			return nil, err
		}
		if len(flopToken.Path) == 0 {
			return nil, ErrInvalidLayerPath
		}
		return nil, m.updateMapsLayerToken(cd.CurrentMap, flopToken.Path, func(_ *levelMap, _ *layer, tk *token) bool {
			if tk.Flop == flopToken.Flop {
				return false
			}
			tk.Flop = flopToken.Flop
			return true
		})
	case "setTokenPattern":
		var path []uint
		if err := json.Unmarshal(data, &path); err != nil {
			return nil, err
		}
		if len(path) == 0 {
			return nil, ErrInvalidLayerPath
		}
		return nil, m.updateMapsLayerToken(cd.CurrentMap, path, func(mp *levelMap, _ *layer, tk *token) bool {
			if tk.TokenType != tokenImage {
				return false
			}
			idStr := "url(#Pattern_" + strconv.FormatUint(tk.ID, 10) + ")"
			mp.Patterns = append(mp.Patterns, pattern{
				ID:     strings.TrimSuffix(strings.TrimPrefix(idStr, "url(#"), ")"),
				Width:  tk.Width,
				Height: tk.Height,
				Image: &token{
					Source:    tk.Source,
					Width:     tk.Width,
					Height:    tk.Height,
					TokenType: tokenImage,
				},
			})
			tk.TokenType = tokenPattern
			tk.Source = idStr
			return true

		})
	case "setTokenImage":
		var path []uint
		if err := json.Unmarshal(data, &path); err != nil {
			return nil, err
		}
		if len(path) == 0 {
			return nil, ErrInvalidLayerPath
		}
		return nil, m.updateMapsLayerToken(cd.CurrentMap, path, func(mp *levelMap, _ *layer, tk *token) bool {
			if tk.TokenType != tokenPattern {
				return false
			}
			tk.TokenType = tokenImage
			tk.Source = mp.Patterns.Remove(strings.TrimSuffix(strings.TrimPrefix(tk.Source, "url(#"), ")"))
			return true
		})
	case "setTokenSource":
		var tokenSource struct {
			Path   []uint `json:"path"`
			Source string `json:"source"`
		}
		if err := json.Unmarshal(data, &tokenSource); err != nil {
			return nil, err
		}
		if len(tokenSource.Path) == 0 {
			return nil, ErrInvalidLayerPath
		}
		return nil, m.updateMapsLayerToken(cd.CurrentMap, tokenSource.Path, func(_ *levelMap, _ *layer, tk *token) bool {
			if tk.TokenType != tokenImage || tk.Source == tokenSource.Source {
				return false
			}
			tk.Source = tokenSource.Source
			return true
		})
	case "setTokenLayer":
		var tokenLayer struct {
			From []uint `json:"from"`
			To   []uint `json:"to"`
		}
		if err := json.Unmarshal(data, &tokenLayer); err != nil {
			return nil, err
		}
		if len(tokenLayer.From) == 0 || len(tokenLayer.To) == 0 {
			return nil, ErrInvalidLayerPath
		}
		return nil, m.updateMapsLayerToken(cd.CurrentMap, tokenLayer.From, func(mp *levelMap, l *layer, tk *token) bool {
			m := getLayer(&mp.layer, tokenLayer.To[:len(tokenLayer.To)-1])
			if m == nil {
				return false
			}
			l.removeToken(tokenLayer.From[len(tokenLayer.From)-1])
			m.addToken(tk, tokenLayer.To[len(tokenLayer.To)-1])
			return true
		})
	case "setTokenTop":
		var path []uint
		if err := json.Unmarshal(data, &path); err != nil {
			return nil, err
		}
		if len(path) == 0 {
			return nil, ErrInvalidLayerPath
		}
		return nil, m.updateMapsLayerToken(cd.CurrentMap, path, func(_ *levelMap, l *layer, tk *token) bool {
			l.removeToken(path[len(path)-1])
			l.addToken(tk, uint(len(l.Tokens)))
			return true
		})
	case "setTokenBottom":
		var path []uint
		if err := json.Unmarshal(data, &path); err != nil {
			return nil, err
		}
		if len(path) == 0 {
			return nil, ErrInvalidLayerPath
		}
		return nil, m.updateMapsLayerToken(cd.CurrentMap, path, func(_ *levelMap, l *layer, tk *token) bool {
			l.removeToken(path[len(path)-1])
			l.addToken(tk, 0)
			return true
		})
	case "setInitiative":
		var initiative initiative
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
