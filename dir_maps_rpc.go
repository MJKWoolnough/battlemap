package battlemap

import (
	"encoding/json"
	"strconv"
	"strings"

	"vimagination.zapto.org/errors"
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
			sqColour Colour
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
		m.updateMapData(md.ID, func(mp *Map) bool {
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
		})
		return nil, nil
	case "moveMap":
		var moveMap struct {
			ID       uint64 `json:"id"`
			Position int    `json:"position"`
		}
		if err := json.Unmarshal(data, &moveMap); err != nil {
			return nil, err
		}
		return nil, m.updateMapData(moveMap.ID, func(mp *Map) bool {
			for _, mmp := range m.order.Move(mp, moveMap.Position) {
				m.store.Set(strconv.FormatUint(mmp.ID, 10), mmp)
			}
			return false
		})
	case "removeMap":
		var id uint64
		if err := json.Unmarshal(data, &id); err != nil {
			return nil, err
		}
		m.mu.Lock()
		defer m.mu.Unlock()
		mp, ok := m.maps[id]
		if !ok {
			return nil, ErrUnknownMap
		}
		delete(m.maps, id)
		for n, np := range m.order {
			if np == mp {
				m.order = append(m.order[:n], m.order[n+1:]...)
				break
			}
		}
		return nil, nil
	case "addLayer":
		var (
			name  string
			strID string
		)
		if err := json.Unmarshal(data, &name); err != nil {
			return nil, err
		}
		m.updateMapData(cd.CurrentMap, func(mp *Map) bool {
			var id uint64
			for _, l := range mp.Layers {
				if strings.HasPrefix(l.ID, "Layer_") {
					if lid, _ := strconv.ParseUint(strings.TrimPrefix(l.ID, "Layer_"), 10, 64); lid >= id {
						id = lid + 1
					}
				}
			}
			strID = "Layer_" + strconv.FormatUint(id, 10)
			mp.Layers = append(mp.Layers, &Layer{
				ID:   strID,
				Name: name,
			})
			return true
		})
		return strID, nil
	case "renameLayer":
		var rename struct {
			ID   string `json:"id"`
			Name string `json:"name"`
		}
		if err := json.Unmarshal(data, &rename); err != nil {
			return nil, err
		}
		return nil, m.updateMapLayer(cd.CurrentMap, rename.ID, func(_ *Map, l *Layer) bool {
			if l.Name == rename.Name {
				return false
			}
			l.Name = rename.Name
			return true
		})
	case "moveLayer":
		var moveLayer struct {
			ID       string `json:"id"`
			Position int    `json:"position"`
		}
		err := json.Unmarshal(data, &moveLayer)
		if err != nil {
			return nil, err
		}
		err = m.updateMapData(cd.CurrentMap, func(mp *Map) bool {
			for n, l := range mp.Layers {
				if l.ID == moveLayer.ID {
					if n == moveLayer.Position {
						break
					}
					mp.Layers.Move(n, moveLayer.Position)
					return true
				}
			}
			err = ErrUnknownLayer
			return false
		})
		return nil, err
	case "showLayer":
		var layerID string
		if err := json.Unmarshal(data, &layerID); err != nil {
			return nil, err
		}
		return nil, m.updateMapLayer(cd.CurrentMap, layerID, func(_ *Map, l *Layer) bool {
			if !l.Hidden {
				return false
			}
			l.Hidden = false
			return true
		})
	case "hideLayer":
		var layerID string
		if err := json.Unmarshal(data, &layerID); err != nil {
			return nil, err
		}
		return nil, m.updateMapLayer(cd.CurrentMap, layerID, func(_ *Map, l *Layer) bool {
			if l.Hidden {
				return false
			}
			l.Hidden = true
			return true
		})
	case "addMask":
		var addMask struct {
			ID   string `json:"id"`
			Mask uint64 `json:"mask"`
		}
		if err := json.Unmarshal(data, &addMask); err != nil {
			return nil, err
		}
		return nil, m.updateMapLayer(cd.CurrentMap, addMask.ID, func(_ *Map, l *Layer) bool {
			mask := "/masks/" + strconv.FormatUint(addMask.Mask, 10)
			if l.Mask == mask {
				return false
			}
			l.Mask = mask
			return true
		})
	case "removeMask":
		var layerID string
		if err := json.Unmarshal(data, &layerID); err != nil {
			return nil, err
		}
		return nil, m.updateMapLayer(cd.CurrentMap, layerID, func(_ *Map, l *Layer) bool {
			if l.Mask == "" {
				return false
			}
			l.Mask = ""
			return true
		})
	case "removeLayer":
		var layerID string
		err := json.Unmarshal(data, &layerID)
		if err != nil {
			return nil, err
		}
		err = m.updateMapLayer(cd.CurrentMap, layerID, func(mp *Map, l *Layer) bool {
			for n, ll := range mp.Layers {
				if ll == l {
					mp.Layers.Remove(n)
					return true
				}
			}
			return false
		})
		return nil, err
	case "addToken":
		var token struct {
			*Token
			LayerID string `json:"layerID"`
		}
		if err := json.Unmarshal(data, &token); err != nil {
			return nil, err
		}
		if err := m.updateMapLayer(cd.CurrentMap, token.LayerID, func(mp *Map, l *Layer) bool {
			var tid uint64
			for _, ly := range mp.Layers {
				for _, tk := range ly.Tokens {
					if tk.ID > tid {
						tid = tk.ID
					}
				}
			}
			token.ID = tid + 1
			l.Tokens = append(l.Tokens, token.Token)
			return true
		}); err != nil {
			return nil, err
		}
		return token.ID, nil
	case "removeToken":
		var tokenID uint64
		if err := json.Unmarshal(data, &tokenID); err != nil {
			return nil, err
		}
		return nil, m.updateMapsLayerToken(cd.CurrentMap, tokenID, func(mp *Map, l *Layer, tk *Token) bool {
			for n, ltk := range l.Tokens {
				if ltk == tk {
					if tk.TokenType == tokenPattern {
						mp.Patterns.Remove(strings.TrimSuffix(strings.TrimPrefix(tk.Source, "url(#"), ")"))
					}
					l.Tokens.Remove(n)
					return true
				}
			}
			return false
		})
	case "moveToken":
		var moveToken struct {
			ID uint64 `json:"id"`
			X  int64  `json:"x"`
			Y  int64  `json:"y"`
		}
		if err := json.Unmarshal(data, &moveToken); err != nil {
			return nil, err
		}
		return nil, m.updateMapsLayerToken(cd.CurrentMap, moveToken.ID, func(_ *Map, _ *Layer, tk *Token) bool {
			if tk.X == moveToken.X && tk.Y == moveToken.Y {
				return false
			}
			tk.X = moveToken.X
			tk.Y = moveToken.Y
			return true
		})
	case "resizeToken":
		var resizeToken struct {
			ID     uint64 `json:"id"`
			Width  int64  `json:"width"`
			Height int64  `json:"height"`
		}
		if err := json.Unmarshal(data, &resizeToken); err != nil {
			return nil, err
		}
		return nil, m.updateMapsLayerToken(cd.CurrentMap, resizeToken.ID, func(_ *Map, _ *Layer, tk *Token) bool {
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
			ID       uint64 `json:"id"`
			Rotation uint8  `json:"rotation"`
		}
		if err := json.Unmarshal(data, &rotateToken); err != nil {
			return nil, err
		}
		return nil, m.updateMapsLayerToken(cd.CurrentMap, rotateToken.ID, func(_ *Map, _ *Layer, tk *Token) bool {
			if tk.Rotation == rotateToken.Rotation {
				return false
			}
			tk.Rotation = rotateToken.Rotation
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
		return nil, m.updateMapsLayerToken(cd.CurrentMap, flipToken.ID, func(_ *Map, _ *Layer, tk *Token) bool {
			if tk.Flip == flipToken.Flip {
				return false
			}
			tk.Flip = flipToken.Flip
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
		return nil, m.updateMapsLayerToken(cd.CurrentMap, flopToken.ID, func(_ *Map, _ *Layer, tk *Token) bool {
			if tk.Flop == flopToken.Flop {
				return false
			}
			tk.Flop = flopToken.Flop
			return true
		})
	case "setTokenPattern":
		var tokenID uint64
		if err := json.Unmarshal(data, &tokenID); err != nil {
			return nil, err
		}
		return nil, m.updateMapsLayerToken(cd.CurrentMap, tokenID, func(mp *Map, _ *Layer, tk *Token) bool {
			if tk.TokenType != tokenImage {
				return false
			}
			idStr := "url(#Pattern_" + strconv.FormatUint(tk.ID, 10) + ")"
			mp.Patterns = append(mp.Patterns, Pattern{
				ID:     strings.TrimSuffix(strings.TrimPrefix(idStr, "url(#"), ")"),
				Width:  tk.Width,
				Height: tk.Height,
				Image: &Token{
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
		var tokenID uint64
		if err := json.Unmarshal(data, &tokenID); err != nil {
			return nil, err
		}
		return nil, m.updateMapsLayerToken(cd.CurrentMap, tokenID, func(mp *Map, _ *Layer, tk *Token) bool {
			if tk.TokenType != tokenPattern {
				return false
			}
			tk.TokenType = tokenImage
			tk.Source = mp.Patterns.Remove(strings.TrimSuffix(strings.TrimPrefix(tk.Source, "url(#"), ")"))
			return true
		})
	case "setTokenSource":
		var tokenSource struct {
			ID     uint64 `json:"id"`
			Source string `json:"source"`
		}
		if err := json.Unmarshal(data, &tokenSource); err != nil {
			return nil, err
		}
		return nil, m.updateMapsLayerToken(cd.CurrentMap, tokenSource.ID, func(_ *Map, _ *Layer, tk *Token) bool {
			if tk.TokenType != tokenImage || tk.Source == tokenSource.Source {
				return false
			}
			tk.Source = tokenSource.Source
			return true
		})
	case "setTokenLayer":
		var tokenLayer struct {
			ID    uint64 `json:"id"`
			Layer uint64 `json:"layer"`
		}
		if err := json.Unmarshal(data, &tokenLayer); err != nil {
			return nil, err
		}
		return nil, m.updateMapsLayerToken(cd.CurrentMap, tokenLayer.ID, func(mp *Map, l *Layer, tk *Token) bool {
			for _, ll := range mp.Layers {
				for m, ttk := range ll.Tokens {
					if ttk == tk {
						if ll.ID == l.ID {
							return false
						}
						ll.Tokens.Remove(m)
						l.Tokens = append(l.Tokens, tk)
						return true
					}
				}
			}
			return false
		})
	case "setTokenTop":
		var tokenID uint64
		if err := json.Unmarshal(data, &tokenID); err != nil {
			return nil, err
		}
		return nil, m.updateMapsLayerToken(cd.CurrentMap, tokenID, func(_ *Map, l *Layer, tk *Token) bool {
			if l.Tokens[len(l.Tokens)-1] == tk {
				return false
			}
			return true
		})
	case "setTokenBottom":
		var tokenID uint64
		if err := json.Unmarshal(data, &tokenID); err != nil {
			return nil, err
		}
		return nil, m.updateMapsLayerToken(cd.CurrentMap, tokenID, func(_ *Map, l *Layer, tk *Token) bool {
			if l.Tokens[0] == tk {
				return false
			}
			return true
		})
	case "setInitiative":
		var initiative Initiative
		if err := json.Unmarshal(data, &initiative); err != nil {
			return nil, err
		}
		return nil, m.updateMapData(cd.CurrentMap, func(mp *Map) bool {
			mp.Initiative = initiative
			return true
		})
	}
	return nil, ErrUnknownMethod
}

const (
	ErrInvalidData errors.Error = "invalid map data"
)
