package battlemap

import (
	"encoding/json"
	"errors"
	"io"
	"strconv"

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
	l.JSON = strconv.AppendUint(append(l.JSON[:0], "{\"width\":"...), l.Width, 10)
	l.JSON = strconv.AppendUint(append(l.JSON, ",\"height\":"...), l.Height, 10)
	l.JSON = strconv.AppendUint(append(l.JSON, ",\"gridSize\":"...), l.GridSize, 10)
	l.JSON = strconv.AppendUint(append(l.JSON, ",\"gridSize\":"...), l.GridStroke, 10)
	l.JSON = l.GridColour.appendTo(append(l.JSON, ",\"gridColour\":"...))
	l.JSON = l.Light.appendTo(append(l.JSON, ",\"lightColour\":"...))
	l.JSON = l.layer.appendTo(l.JSON, false)
	l.JSON = append(l.JSON, '}')
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

func (l *layer) appendTo(p []byte, full bool) []byte {
	if full {
		p = appendString(append(p, "\"name\":"...), l.Name)
		p = strconv.AppendUint(append(p, ",\"mask\":"...), l.Mask, 10)
		p = strconv.AppendBool(append(p, ",\"hidden\":"...), l.Hidden)
	}
	if l.Layers != nil {
		p = append(p, ",\"children\":["...)
		for n, l := range l.Layers {
			if n > 0 {
				p = append(p, ',')
			}
			p = append(l.appendTo(append(p, '{'), true), '}')
		}
	} else if l.Name != "Grid" {
		p = append(p, ",\"tokens\":["...)
		for n, t := range l.Tokens {
			if n > 0 {
				p = append(p, ',')
			}
			p = t.appendTo(p)
		}
	} else {
		return p
	}
	return append(p, ']')
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

func (t *token) appendTo(p []byte) []byte {
	p = strconv.AppendUint(append(p, "{\"src\":"...), t.Source, 10)
	p = strconv.AppendInt(append(p, ",\"x\":"...), t.X, 10)
	p = strconv.AppendInt(append(p, ",\"y\":"...), t.Y, 10)
	p = strconv.AppendUint(append(p, ",\"width\":"...), t.Width, 10)
	p = strconv.AppendUint(append(p, ",\"height\":"...), t.Height, 10)
	p = appendNum(append(p, ",\"rotation\":"...), t.Rotation)
	p = strconv.AppendBool(append(p, ",\"flip\":"...), t.Flip)
	p = strconv.AppendBool(append(p, ",\"flop\":"...), t.Flop)
	p = strconv.AppendBool(append(p, ",\"snap\":"...), t.Snap)
	p = strconv.AppendUint(append(p, ",\"patternWidth\":"...), t.PatternWidth, 10)
	p = strconv.AppendUint(append(p, ",\"patternHeight\":"...), t.PatternHeight, 10)
	p = strconv.AppendUint(append(p, ",\"tokenData\":"...), t.TokenData, 10)
	return append(p, '}')
}

type colour struct {
	R uint8 `json:"r"`
	G uint8 `json:"g"`
	B uint8 `json:"b"`
	A uint8 `json:"a"`
}

func (c colour) appendTo(p []byte) []byte {
	p = appendNum(append(p, "{\"r\":"...), c.R)
	p = appendNum(append(p, ",\"g\":"...), c.G)
	p = appendNum(append(p, ",\"b\":"...), c.B)
	p = appendNum(append(p, ",\"a\":"...), c.A)
	return append(p, '}')
}

func appendString(p []byte, s string) []byte {
	return strconv.AppendQuote(p, s)
}

func appendNum(p []byte, n uint8) []byte {
	if n >= 100 {
		c := n / 100
		n -= c * 100
		p = append(p, '0'+c)
	}
	if n >= 10 {
		c := n / 10
		n -= c * 10
		p = append(p, '0'+c)
	}
	return append(p, '0'+n)
}

// Errors
var (
	ErrDuplicateLayer = errors.New("duplicate layer name")
	ErrInvalidLayer   = errors.New("invalid layer structure")
)
