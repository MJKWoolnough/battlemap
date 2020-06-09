package battlemap

type levelMap struct {
	Width      uint64
	Height     uint64
	GridSize   uint64
	GridStroke uint64
	GridColour colour
	Light      colour
	layers     map[string]struct{}
	layer
}

type layer struct {
	Name   string
	Mask   uint64
	Hidden bool
	Tokens []*token
	Layers []*layer
}

type token struct {
	Source        uint64
	X             int64
	Y             int64
	Width         uint64
	Height        uint64
	PatternWidth  uint64
	PatternHeight uint64
	Rotation      uint8
	Flip          bool
	Flop          bool
	TokenData     uint64
	Snap          bool
}

type colour struct {
	R uint8 `json:"r"`
	G uint8 `json:"g"`
	B uint8 `json:"b"`
	A uint8 `json:"a"`
}
