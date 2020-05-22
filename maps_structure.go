package battlemap

import "fmt"

type levelMap struct {
	Width      uint64
	Height     uint64
	Initiative [][2]uint64
	Patterns   map[string]*pattern
	Masks      map[string]*mask
	layers     map[string]struct{}
	layer
}

type pattern struct {
	ID     string
	Width  uint64
	Height uint64
	Image  *token
	Path   *patternPath
}

type mask struct {
	ID    string
	Image token
}

type patternPath struct {
	Path        string
	Fill        colour
	Stroke      colour
	StrokeWidth uint64
}

type layer struct {
	Name     string
	Mask     string
	Hidden   bool
	IsFolder bool
	Tokens   []*token
	Layers   []*layer
}

type token struct {
	Source      string
	Stroke      colour
	StrokeWidth uint64
	X           int64
	Y           int64
	Width       uint64
	Height      uint64
	Rotation    uint8
	Flip        bool
	Flop        bool
	TokenData   uint64
	TokenType   tokenType
	Snap        bool
}

type tokenType uint8

const (
	tokenImage tokenType = iota + 1
	tokenPattern
	tokenRect
	tokenCircle
)

type colour struct {
	R uint8 `json:"r"`
	G uint8 `json:"g"`
	B uint8 `json:"b"`
	A uint8 `json:"a"`
}

func (c colour) ToRGBA() string {
	return fmt.Sprintf("rgba(%d, %d, %d, %.3f)", c.R, c.G, c.B, float32(c.A)/255)
}
