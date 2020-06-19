package battlemap

import (
	"encoding/json"
	"errors"
	"fmt"
	"io"

	"vimagination.zapto.org/memio"
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
	JSON memio.Buffer `json:"-"`
}

func (l *levelMap) ReadFrom(r io.Reader) (int64, error) {
	l.JSON = l.JSON[:0]
	sr := rwcount.Reader{Reader: io.TeeReader(r, &l.JSON)}
	err := json.NewDecoder(&sr).Decode(l)
	if sr.Err != nil {
		return sr.Count, sr.Err
	} else if err != nil {
		return sr.Count, err
	}
	l.layers = make(map[string]struct{})
	err = l.validate(l.layers, true)
	if err != nil {
		return sr.Count, err
	}
	if _, ok := l.layers["Grid"]; !ok {
		l.Layers = append(l.Layers, &layer{Name: "Grid", Tokens: []*token{}})
		l.layers["Grid"] = struct{}{}
	}
	if _, ok := l.layers["Light"]; !ok {
		l.Layers = append(l.Layers, &layer{Name: "Light", Tokens: []*token{}})
		l.layers["Light"] = struct{}{}
	}
	return sr.Count, nil
}

func (l *levelMap) WriteTo(w io.Writer) (int64, error) {
	l.JSON = l.JSON[:0]
	fmt.Fprintf(&l.JSON, "{\"width\":%d,\"height\":%d,\"gridSize\":%d,\"gridStroke\":%d,\"gridColour\":", l.Width, l.Height, l.GridSize, l.GridStroke)
	l.GridColour.WriteTo(&l.JSON)
	fmt.Fprint(&l.JSON, ",\"lightColour\":")
	l.Light.WriteTo(&l.JSON)
	l.layer.WriteTo(&l.JSON, false)
	fmt.Fprint(&l.JSON, "}")
	n, err := w.Write(l.JSON)
	return int64(n), err
}

type layer struct {
	Name   string   `json:"name"`
	Mask   uint64   `json:"mask"`
	Hidden bool     `json:"hidden"`
	Tokens []*token `json:"tokens"`
	Layers []*layer `json:"children"`
}

func (l *layer) validate(layers map[string]struct{}, first bool) error {
	if _, ok := layers[l.Name]; ok {
		return ErrDuplicateLayer
	}
	layers[l.Name] = struct{}{}
	if l.Name == "Grid" {
		if l.Tokens != nil || l.Layers != nil {
			return ErrInvalidLayer
		}
	} else if l.Layers != nil && l.Tokens != nil || l.Tokens == nil && l.Layers == nil || l.Name == "Light" && l.Layers != nil {
		return ErrInvalidLayer
	}
	for _, layer := range l.Layers {
		if !first && (l.Name == "Grid" || l.Name == "Light") {
			return ErrInvalidLayer
		}
		if err := layer.validate(layers, false); err != nil {
			return err
		}
	}
	return nil
}

func (l *layer) WriteTo(w io.Writer, full bool) {
	if full {
		fmt.Fprintf(w, "\"name\":%q,\"mask\":%d,\"hidden\":%t", l.Name, l.Mask, l.Hidden)
	}
	if l.Layers != nil {
		fmt.Fprint(w, ",\"children\":[")
		for n, l := range l.Layers {
			if n > 0 {
				fmt.Fprint(w, ",")
			}
			fmt.Fprint(w, "{")
			l.WriteTo(w, true)
			fmt.Fprint(w, "}")
		}
	} else if l.Name != "Grid" {
		fmt.Fprint(w, ",\"tokens\":[")
		for n, t := range l.Tokens {
			if n > 0 {
				fmt.Fprint(w, ",")
			}
			t.WriteTo(w)
		}
	} else {
		return
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

func (t *token) WriteTo(w io.Writer) {
	fmt.Fprintf(w, "{\"src\":%d,\"x\":%d,\"y\":%d,\"width\":%d,\"height\":%d,\"rotation\":%d,\"flip\":%t,\"flop\":%t,\"snap\":%t", t.Source, t.X, t.Y, t.Width, t.Height, t.Rotation, t.Flip, t.Flop, t.Snap)
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

// Errors
var (
	ErrDuplicateLayer = errors.New("duplicate layer name")
	ErrInvalidLayer   = errors.New("invalid layer structure")
)
