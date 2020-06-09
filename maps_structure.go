package battlemap

type levelMap struct {
	Width      uint64 `json:"width"`
	Height     uint64 `json:"height"`
	GridSize   uint64 `json:"gridSize"`
	GridStroke uint64 `json:"gridStroke"`
	GridColour colour `json:"gridColour"`
	Light      colour `json:"lightColour"`
	layers     map[string]struct{}
	layer
}

type layer struct {
	Name   string   `json:"name"`
	Mask   uint64   `json:"mask"`
	Hidden bool     `json:"hidden"`
	Tokens []*token `json:"tokens"`
	Layers []*layer `json:"layers"`
}

type token struct {
	Source        uint64 `json:"src"`
	X             int64  `json:"x"`
	Y             int64  `json:"y"`
	Width         uint64 `json:"width"`
	Height        uint64 `json:"height"`
	PatternWidth  uint64 `json:"patternWidth"`
	PatternHeight uint64 `json:"patternHeight"`
	Rotation      uint8  `json:"rotation"`
	Flip          bool   `json:"flip"`
	Flop          bool   `json:"flop"`
	TokenData     uint64 `json:"tokenData"`
	Snap          bool   `json:"snap"`
}

type colour struct {
	R uint8 `json:"r"`
	G uint8 `json:"g"`
	B uint8 `json:"b"`
	A uint8 `json:"a"`
}
