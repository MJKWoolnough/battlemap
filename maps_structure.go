package battlemap

import (
	"fmt"
	"io"

	"vimagination.zapto.org/rwcount"
)

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

func (l levelMap) WriteTo(w io.Writer) (int64, error) {
	sw := rwcount.Writer{Writer: w}
	fmt.Fprintf(&sw, "{\"width\":%d,\"height\":%d,\"gridSize\":%d,\"gridStroke\":%d,\"gridColour\":", l.Width, l.Height, l.GridSize, l.GridStroke)
	l.GridColour.WriteTo(&sw)
	fmt.Fprint(&sw, ",\"lightColour\":")
	l.Light.WriteTo(&sw)
	fmt.Fprint(&sw, ",")
	l.layer.WriteTo(&sw)
	fmt.Fprint(&sw, "}")
	return sw.Count, sw.Err
}

type layer struct {
	Name   string   `json:"name"`
	Mask   uint64   `json:"mask"`
	Hidden bool     `json:"hidden"`
	Tokens []*token `json:"tokens"`
	Layers []*layer `json:"layers"`
}

func (l layer) WriteTo(w io.Writer) {
	fmt.Fprintf(w, "\"name\":%q,\"mask\":%d,\"hidden\":%t,", l.Name, l.Mask, l.Hidden)
	if l.Tokens != nil {
		fmt.Fprint(w, "\"tokens\":[")
		for n, t := range l.Tokens {
			if n > 0 {
				fmt.Fprint(w, ",")
			}
			t.WriteTo(w)
		}
	} else {
		fmt.Fprint(w, "\"layers\":[")
		for n, l := range l.Layers {
			if n > 0 {
				fmt.Fprint(w, ",")
			}
			fmt.Fprint(w, "{")
			l.WriteTo(w)
			fmt.Fprint(w, "}")
		}
	}
	fmt.Fprint(w, "]")
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

func (t token) WriteTo(w io.Writer) {
	fmt.Fprintf(w, "{\"src\":%q,\"x\":%d,\"y\":%d,\"width\":%d,\"height\":%d,\"rotation\":%d,\"flip\":%t,\"flop\":%t,\"snap\":%t", t.Source, t.X, t.Y, t.Width, t.Height, t.Rotation, t.Flip, t.Flop, t.Snap)
	if t.PatternWidth > 0 && t.PatternHeight > 0 {
		fmt.Fprintf(w, ",\"patternWidth\":%d,\"patternHeight\":%d", t.PatternWidth, t.PatternHeight)
	}
	if t.TokenData > 0 {
		fmt.Fprintf(w, ",\"tokenData\":%d", t.TokenData)
	}
	fmt.Fprint(w, "}")
}

type colour struct {
	R uint8 `json:"r"`
	G uint8 `json:"g"`
	B uint8 `json:"b"`
	A uint8 `json:"a"`
}

func (c colour) WriteTo(w io.Writer) {
	fmt.Fprintf(w, "{\"r\":%d,\"g\":%d,\"b\":%d,\"a\":%d}", c.R, c.G, c.B, c.A)
}
