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
	LightX     uint64 `json:"lightX"`
	LightY     uint64 `json:"lightY"`
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
	l.JSON = strconv.AppendUint(append(l.JSON, ",\"gridStroke\":"...), l.GridStroke, 10)
	l.JSON = l.GridColour.appendTo(append(l.JSON, ",\"gridColour\":"...))
	l.JSON = l.Light.appendTo(append(l.JSON, ",\"lightColour\":"...))
	l.JSON = strconv.AppendUint(append(l.JSON, ",\"lightX\":"...), l.LightX, 10)
	l.JSON = strconv.AppendUint(append(l.JSON, ",\"lightY\":"...), l.LightY, 10)
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
	Walls  []wall   `json:"walls"`
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
	for _, token := range l.Tokens {
		if err := token.validate(); err != nil {
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
		if l.Layers == nil && l.Name != "Grid" && l.Name != "Light" {
			p = append(p, ",\"walls\":["...)
			for n, w := range l.Walls {
				if n > 0 {
					p = append(p, ',')
				}
				p = w.appendTo(p)
			}
			p = append(p, ']')
		}
	}
	if l.Layers != nil {
		p = append(p, ",\"children\":["...)
		for n, l := range l.Layers {
			if n > 0 {
				p = append(p, ',')
			}
			p = append(l.appendTo(append(p, '{'), true), '}')
		}
	} else if l.Name != "Grid" && l.Name != "Light" {
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
	Source uint64 `json:"src"`
	coords
	Width         uint64          `json:"width"`
	Height        uint64          `json:"height"`
	PatternWidth  uint64          `json:"patternWidth"`
	PatternHeight uint64          `json:"patternHeight"`
	TokenData     json.RawMessage `json:"tokenData"`
	Rotation      uint8           `json:"rotation"`
	Flip          bool            `json:"flip"`
	Flop          bool            `json:"flop"`
	Snap          bool            `json:"snap"`
	TokenType     tokenType       `json:"tokenType"`
	IsEllipse     bool            `json:"isEllipse"`
	StrokeWidth   uint8           `json:"strokeWidth"`
	Fill          colour          `json:"fill"`
	Fills         []fill          `json:"fills"`
	FillType      fillType        `json:"fillType"`
	Stroke        colour          `json:"stroke"`
	Points        []coords        `json:"points"`
}

type coords struct {
	X int64 `json:"x"`
	Y int64 `json:"y"`
}

type tokenType uint8

const (
	tokenImage tokenType = iota
	tokenShape
	tokenDrawing
)

type fillType uint8

const (
	fillColour fillType = iota
	fillRadial
	fillGradient
)

func (t *token) appendTo(p []byte) []byte {
	p = appendNum(append(p, "{\"tokenType\":"...), uint8(t.TokenType))
	p = strconv.AppendInt(append(p, ",\"x\":"...), t.X, 10)
	p = strconv.AppendInt(append(p, ",\"y\":"...), t.Y, 10)
	p = strconv.AppendUint(append(p, ",\"width\":"...), t.Width, 10)
	p = strconv.AppendUint(append(p, ",\"height\":"...), t.Height, 10)
	p = appendNum(append(p, ",\"rotation\":"...), t.Rotation)
	p = strconv.AppendBool(append(p, ",\"snap\":"...), t.Snap)
	switch t.TokenType {
	case tokenImage:
		p = strconv.AppendUint(append(p, ",\"src\":"...), t.Source, 10)
		p = strconv.AppendBool(append(p, ",\"flip\":"...), t.Flip)
		p = strconv.AppendBool(append(p, ",\"flop\":"...), t.Flop)
		p = strconv.AppendUint(append(p, ",\"patternWidth\":"...), t.PatternWidth, 10)
		p = strconv.AppendUint(append(p, ",\"patternHeight\":"...), t.PatternHeight, 10)
		p = append(append(p, ",\"tokenData\":"...), t.TokenData...)
	case tokenDrawing:
		p = append(p, ",\"points\":["...)
		for n, coords := range t.Points {
			if n > 0 {
				p = append(p, ',')
			}
			p = strconv.AppendInt(append(p, "{\"x\":"...), coords.X, 10)
			p = strconv.AppendInt(append(p, ",\"y\":"...), coords.Y, 10)
			p = append(p, '}')
		}
		p = append(p, ']')
		fallthrough
	case tokenShape:
		if t.IsEllipse {
			p = append(p, ",\"isEllipse\":true"...)
		}
		p = t.Fill.appendTo(append(p, ",\"fill\":"...))
		if t.FillType != fillColour {
			p = append(p, ",\"fills\":["...)
			for n, f := range t.Fills {
				if n > 0 {
					p = append(p, ',')
				}
				p = f.appendTo(p)
			}
			p = append(p, ']')
		}
		p = t.Stroke.appendTo(append(p, ",\"stroke\":"...))
		p = appendNum(append(p, ",\"strokeWidth\":"...), t.StrokeWidth)
	}
	return append(p, '}')
}

func (t *token) validate() error {
	switch t.TokenType {
	case tokenImage:
		if t.FillType != 0 || t.Source == 0 || t.IsEllipse || !t.Fill.empty() || !t.Stroke.empty() || t.StrokeWidth > 0 || len(t.Points) > 0 || (t.PatternWidth > 0) != (t.PatternHeight > 0) {
			return ErrInvalidToken
		}
	case tokenDrawing:
		if len(t.Points) < 2 || t.IsEllipse {
			return ErrInvalidToken
		}
		fallthrough
	case tokenShape:
		if t.Source != 0 || t.Flip || t.Flop || t.PatternWidth > 0 || t.PatternHeight > 0 || t.TokenData != nil {
			return ErrInvalidToken
		}
	default:
		return ErrInvalidToken
	}
	return nil
}

type wall struct {
	X1     int64  `json:"x1"`
	Y1     int64  `json:"y1"`
	X2     int64  `json:"x2"`
	Y2     int64  `json:"y2"`
	Colour colour `json:"colour"`
}

func (w wall) appendTo(p []byte) []byte {
	p = strconv.AppendInt(append(p, "{\"x1\":"...), w.X1, 10)
	p = strconv.AppendInt(append(p, ",\"y1\":"...), w.Y1, 10)
	p = strconv.AppendInt(append(p, ",\"x2\":"...), w.X2, 10)
	p = strconv.AppendInt(append(p, ",\"y2\":"...), w.Y2, 10)
	p = w.Colour.appendTo(append(p, ",\"colour\":"...))
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

func (c colour) empty() bool {
	return c.R == 0 && c.G == 0 && c.B == 0 && c.A == 0
}

type fill struct {
	Pos    uint8  `json:"pos"`
	Colour colour `json:"colour"`
}

func (f fill) appendTo(p []byte) []byte {
	p = appendNum(append(p, "{\"pos\":"...), f.Pos)
	p = f.Colour.appendTo(p)
	return append(p, '}')
}

const hex = "0123456789abcdef"

func appendString(p []byte, s string) []byte {
	last := 0
	var char byte
	p = append(p, '"')
	for n, c := range s {
		switch c {
		case '"', '\\', '/':
			char = byte(c)
		case '\b':
			char = 'b'
		case '\f':
			char = 'f'
		case '\n':
			char = 'n'
		case '\r':
			char = 'r'
		case '\t':
			char = 't'
		default:
			if c < 0x20 { // control characters
				p = append(append(p, s[last:n]...), '\\', 'u', '0', '0', hex[c>>4], hex[c&0xf])
				last = n + 1
			}
			continue
		}
		p = append(append(p, s[last:n]...), '\\', char)
		last = n + 1
	}
	return append(append(p, s[last:]...), '"')
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
	ErrInvalidToken   = errors.New("invalid token")
)
