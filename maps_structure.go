package battlemap

type levelMap struct {
	Width       uint64
	Height      uint64
	Initiative  [][2]uint64
	GridPos     uint64
	GridHidden  bool
	LightPos    uint64
	LightHidden bool
	LightColour colour
	Patterns    map[string]*pattern
	Masks       map[string]*mask
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
	Name   string
	Mask   string
	Hidden bool
	Tokens []*token
	Layers []*layer
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
}

type tokenType uint8

const (
	tokenImage tokenType = iota + 1
	tokenPattern
	tokenRect
	tokenCircle
)

type colour struct {
	R, G, B, A uint8
}
