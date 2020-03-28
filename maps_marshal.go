package battlemap

import (
	"encoding/xml"
	"errors"
	"fmt"
	"io"
	"math"
	"strconv"
	"strings"

	"vimagination.zapto.org/parser"
	"vimagination.zapto.org/rwcount"
)

func (l *levelMap) ReadFrom(r io.Reader) (int64, error) {
	cr := rwcount.Reader{Reader: r}
	x := xml.NewDecoder(&cr)
	for {
		token, err := x.Token()
		if err != nil {
			return cr.Count, err
		}
		if se, ok := token.(xml.StartElement); ok {
			if se.Name.Local == "svg" {
				for _, attr := range se.Attr {
					switch attr.Name.Local {
					case "width":
						if l.Width, err = strconv.ParseUint(attr.Value, 10, 64); err != nil {
							return cr.Count, err
						}
					case "height":
						if l.Height, err = strconv.ParseUint(attr.Value, 10, 64); err != nil {
							return cr.Count, err
						}
					case "data-initiative":
						if attr.Value == "" {
							continue
						}
						is := strings.Split(attr.Value, ",")
						l.Initiative = make([][2]uint64, len(is))
						for n, i := range is {
							p := strings.IndexByte(i, '|')
							if p < 1 {
								return cr.Count, ErrInvalidInitiative
							}
							if l.Initiative[n][0], err = strconv.ParseUint(i[:p], 10, 64); err != nil {
								return cr.Count, err
							}
							if l.Initiative[n][1], err = strconv.ParseUint(i[p+1:], 10, 64); err != nil {
								return cr.Count, err
							}
						}
					case "data-grid-pos":
						if l.GridPos, err = strconv.ParseUint(attr.Value, 10, 64); err != nil {
							return cr.Count, err
						}
					case "data-grid-hidden":
						if l.GridHidden, err = strconv.ParseBool(attr.Value); err != nil {
							return cr.Count, err
						}
					case "data-light-pos":
						if l.LightPos, err = strconv.ParseUint(attr.Value, 10, 64); err != nil {
							return cr.Count, err
						}
					case "data-light-hidden":
						if l.LightHidden, err = strconv.ParseBool(attr.Value); err != nil {
							return cr.Count, err
						}
					case "data-light-colour":
						if err = l.LightColour.UnmarshalXMLAttr(attr); err != nil {
							return cr.Count, err
						}
					}
				}
				break
			}
			return cr.Count, ErrInvalidSVG
		}
	}
	if l.Width == 0 || l.Height == 0 {
		return cr.Count, ErrInvalidMapDimensions
	}
	l.Masks = make(map[string]*mask)
	l.Patterns = make(map[string]*pattern)
	for {
		token, err := x.Token()
		if err != nil {
			return cr.Count, err
		}
		if se, ok := token.(xml.StartElement); ok {
			if se.Name.Local == "g" {
				nl := new(layer)
				if err = nl.UnmarshalXML(x, se); err != nil {
					return cr.Count, err
				}
				l.Layers = append(l.Layers, nl)
			} else if se.Name.Local == "defs" && len(l.Masks) == 0 && len(l.Patterns) == 0 {
				for {
					token, err := x.Token()
					if err != nil {
						return cr.Count, err
					}
					if se, ok := token.(xml.StartElement); ok {
						if se.Name.Local == "pattern" {
							p := new(pattern)
							if err = p.UnmarshalXML(x, se); err != nil {
								return cr.Count, err
							}
							l.Patterns[p.ID] = p
						} else if se.Name.Local == "mask" {
							m := new(mask)
							if err = m.UnmarshalXML(x, se); err != nil {
								return cr.Count, err
							}
							l.Masks[m.ID] = m
						} else {
							x.Skip()
						}
					} else if _, ok = token.(xml.EndElement); ok {
						break
					}
				}
			} else {
				x.Skip()
			}
		} else if _, ok = token.(xml.EndElement); ok {
			break
		}
	}
	return cr.Count, cr.Err
}

func (c *colour) UnmarshalXMLAttr(attr xml.Attr) error {
	cs := strings.Split(strings.TrimSuffix(strings.TrimPrefix(attr.Value, "rgba("), ")"), ",")
	if len(cs) != 4 {
		return ErrInvalidColour
	}
	r, err := strconv.ParseUint(strings.TrimSpace(cs[0]), 10, 8)
	if err != nil {
		return fmt.Errorf("error decoding Red: %w", err)
	}
	g, err := strconv.ParseUint(strings.TrimSpace(cs[1]), 10, 8)
	if err != nil {
		return fmt.Errorf("error decoding Green: %w", err)
	}
	b, err := strconv.ParseUint(strings.TrimSpace(cs[2]), 10, 8)
	if err != nil {
		return fmt.Errorf("error decoding Blue: %w", err)
	}
	a, err := strconv.ParseFloat(strings.TrimSpace(cs[3]), 32)
	if err != nil {
		return fmt.Errorf("error decoding Alpha: %w", err)
	}
	c.R = uint8(r)
	c.G = uint8(g)
	c.B = uint8(b)
	c.A = uint8(math.Round(a * 255))
	return nil
}

func (p *pattern) UnmarshalXML(x *xml.Decoder, se xml.StartElement) error {
	var err error
	for _, attr := range se.Attr {
		switch attr.Name.Local {
		case "id":
			p.ID = attr.Value
		case "width":
			if p.Width, err = strconv.ParseUint(attr.Value, 10, 64); err != nil {
				return err
			}
		case "height":
			if p.Height, err = strconv.ParseUint(attr.Value, 10, 64); err != nil {
				return err
			}
		}
	}
	if p.ID == "" || p.Width == 0 || p.Height == 0 {
		return ErrInvalidPattern
	}
	for {
		t, err := x.Token()
		if err != nil {
			return err
		}
		if se, ok := t.(xml.StartElement); ok {
			if se.Name.Local == "path" {
				p.Path = new(patternPath)
				for _, attr := range se.Attr {
					switch attr.Name.Local {
					case "d":
						p.Path.Path = attr.Value
					case "fill":
						if err := p.Path.Fill.UnmarshalXMLAttr(attr); err != nil {
							return err
						}
					case "stroke":
						if err := p.Path.Stroke.UnmarshalXMLAttr(attr); err != nil {
							return err
						}
					case "stroke-width":
						if p.Path.StrokeWidth, err = strconv.ParseUint(attr.Value, 10, 64); err != nil {
							return err
						}
					}
				}
				if p.Path.Path == "" || (p.Path.Fill.A == 0 && (p.Path.Stroke.A == 0 || p.Path.StrokeWidth == 0)) {
					return ErrInvalidPattern
				}
				x.Skip()
				x.Skip()
				break
			} else if se.Name.Local == "image" {
				p.Image = new(token)
				if err = p.Image.UnmarshalXML(x, se); err != nil {
					return err
				}
				x.Skip()
				break
			}
			x.Skip()
		} else if _, ok := t.(xml.EndElement); ok {
			return ErrInvalidPattern
		}
	}
	return nil
}

func (m *mask) UnmarshalXML(x *xml.Decoder, se xml.StartElement) error {
	for _, attr := range se.Attr {
		switch attr.Name.Local {
		case "id":
			m.ID = attr.Value
		}
	}
	for {
		t, err := x.Token()
		if err != nil {
			return err
		}
		if se, ok := t.(xml.StartElement); ok {
			if se.Name.Local == "image" {
				if err := m.Image.UnmarshalXML(x, se); err != nil {
					return err
				}
				x.Skip()
				break
			} else {
				x.Skip()
			}
		} else if _, ok = t.(xml.EndElement); ok {
			if m.Image.Source == "" {
				return ErrInvalidMask
			}
			break
		}
	}
	return nil
}

func (l *layer) UnmarshalXML(x *xml.Decoder, se xml.StartElement) error {
	for _, attr := range se.Attr {
		switch attr.Name.Local {
		case "data-name":
			l.Name = attr.Value
		case "mask":
			l.Mask = strings.TrimRight(strings.TrimLeft(attr.Value, "url(#"), ")")
		case "visibility":
			l.Hidden = attr.Value == "hidden"
		}
	}
	if l.Name == "" {
		return ErrInvalidLayer
	}
	for {
		t, err := x.Token()
		if err != nil {
			return err
		}
		if se, ok := t.(xml.StartElement); ok {
			switch se.Name.Local {
			case "g":
				if len(l.Tokens) > 0 {
					return ErrInvalidLayer
				}
				g := new(layer)
				if err := g.UnmarshalXML(x, se); err != nil {
					return err
				}
				l.Layers = append(l.Layers, g)
			case "rect", "circle", "image":
				if len(l.Layers) > 0 {
					return ErrInvalidLayer
				}
				t := new(token)
				if err := t.UnmarshalXML(x, se); err != nil {
					return err
				}
				l.Tokens = append(l.Tokens, t)
			default:
				x.Skip()
			}
		} else if _, ok = t.(xml.EndElement); ok {
			break
		}
	}
	return nil
}

const numbers = "0123456789"

func (t *token) UnmarshalXML(x *xml.Decoder, se xml.StartElement) error {
	x.Skip()
	switch se.Name.Local {
	case "image":
		t.TokenType = tokenImage
	case "rect":
		t.TokenType = tokenPattern
	case "circle":
		t.TokenType = tokenCircle
	default:
		return nil
	}
	var (
		err                    error
		translateX, translateY int64
	)
	for _, attr := range se.Attr {
		switch attr.Name.Local {
		case "transform":
			pt := parser.NewStringTokeniser(attr.Value)
			for {
				if pt.ExceptRun("(") == -1 {
					break
				}
				method := strings.TrimLeft(pt.Get(), " ")
				pt.Accept("(")
				pt.AcceptRun(" ")
				pt.Get()
				switch method {
				case "translate":
					pt.Accept("-")
					pt.AcceptRun(numbers)
					var err error
					if translateX, err = strconv.ParseInt(pt.Get(), 10, 64); err != nil {
						return fmt.Errorf("error parsing translate X: %w", err)
					}
					pt.AcceptRun(" ")
					if pt.Accept(")") {
						pt.Get()
						continue
					}
					pt.Accept(",")
					pt.AcceptRun(" ")
					pt.Get()
					pt.Accept("-")
					pt.AcceptRun(numbers)
					if translateY, err = strconv.ParseInt(pt.Get(), 10, 64); err != nil {
						return fmt.Errorf("error parsing translate Y: %w", err)
					}
					pt.AcceptRun(" ")
					pt.Accept(")")
					pt.Get()
				case "scale":
					if pt.Accept("-") {
						t.Flop = true
					}
					if pt.ExceptRun(")-") == '-' {
						t.Flip = true
						pt.ExceptRun(")")
						pt.Accept(")")
					}
					pt.Get()
				case "rotate":
					pt.AcceptRun(numbers)
					r, err := strconv.ParseUint(pt.Get(), 10, 64)
					if err != nil {
						return fmt.Errorf("error parsing rotation: %w", err)
					}
					t.Rotation = uint8(r % 360 * 256 / 360)
					pt.ExceptRun(")")
					pt.Accept(")")
					pt.Get()
				}
			}
		case "width":
			t.Width, err = strconv.ParseUint(attr.Value, 10, 64)
		case "height":
			t.Height, err = strconv.ParseUint(attr.Value, 10, 64)
		case "xlink:href", "href":
			t.Source = attr.Value
		case "fill":
			if strings.HasPrefix(attr.Value, "url(") {
				t.Source = strings.TrimSuffix(strings.TrimPrefix(attr.Value, "url(#"), ")")
			} else {
				t.Source = attr.Value
				if t.TokenType == tokenPattern {
					t.TokenType = tokenRect
				}
			}
		case "stroke":
			err = t.Stroke.UnmarshalXMLAttr(attr)
		case "stroke-width":
			t.StrokeWidth, err = strconv.ParseUint(attr.Value, 10, 64)
		case "data-token":
			t.TokenData, err = strconv.ParseUint(attr.Value, 10, 64)
		}
		if err != nil {
			return fmt.Errorf("error unmarshling token: %w", err)
		}
	}
	if t.Flop {
		translateX = -translateX - int64(t.Width)
	}
	if t.Flip {
		translateY = -translateY - int64(t.Height)
	}
	t.X = translateX
	t.Y = translateY
	if (t.TokenType == tokenImage || t.TokenType == tokenPattern) && t.Source == "" {
		return ErrInvalidTokenSource
	}
	return nil
}

var (
	svgDoctype = xml.Directive("DOCTYPE svg PUBLIC \"-//W3C//DTD SVG 20010904//EN\" \"http://www.w3.org/TR/2001/REC-SVG-20010904/DTD/svg10.dtd\"")
	mapAttrs   = [...]xml.Attr{
		{
			Name:  xml.Name{Local: "xmlns"},
			Value: "http://www.w3.org/2000/svg",
		}, {
			Name:  xml.Name{Local: "xmlns:xlink"},
			Value: "http://www.w3.org/1999/xlink",
		},
	}
	patternAttrs = [...]xml.Attr{
		{
			Name:  xml.Name{Local: "patternUnits"},
			Value: "userSpaceOnUse",
		},
	}
)

func (l *levelMap) WriteTo(w io.Writer) (int64, error) {
	cw := rwcount.Writer{Writer: w}
	io.WriteString(&cw, xml.Header)
	x := xml.NewEncoder(&cw)
	x.EncodeToken(svgDoctype)
	var lightColour xml.Attr
	lightColour, _ = l.LightColour.MarshalXMLAttr(xml.Name{Local: "data-light-colour"})
	initiative := xml.Attr{Name: xml.Name{Local: "data-initiative"}}
	if len(l.Initiative) > 0 {
		var sb strings.Builder
		for n, i := range l.Initiative {
			if n > 0 {
				sb.WriteByte(',')
			}
			sb.WriteString(strconv.FormatUint(i[0], 10))
			sb.WriteByte('|')
			sb.WriteString(strconv.FormatUint(i[1], 10))
		}
		initiative.Value = sb.String()
	}
	svg := xml.StartElement{Name: xml.Name{Local: "svg"}, Attr: append(mapAttrs[:],
		xml.Attr{
			Name:  xml.Name{Local: "width"},
			Value: strconv.FormatUint(l.Width, 10),
		},
		xml.Attr{
			Name:  xml.Name{Local: "height"},
			Value: strconv.FormatUint(l.Height, 10),
		},
		initiative,
		xml.Attr{
			Name:  xml.Name{Local: "data-grid-pos"},
			Value: strconv.FormatUint(l.GridPos, 10),
		},
		xml.Attr{
			Name:  xml.Name{Local: "data-grid-hidden"},
			Value: strconv.FormatBool(l.GridHidden),
		},
		xml.Attr{
			Name:  xml.Name{Local: "data-light-pos"},
			Value: strconv.FormatUint(l.LightPos, 10),
		},
		xml.Attr{
			Name:  xml.Name{Local: "data-light-hidden"},
			Value: strconv.FormatBool(l.LightHidden),
		},
		lightColour,
	)}
	x.EncodeToken(svg)
	defs := xml.StartElement{Name: xml.Name{Local: "defs"}}
	x.EncodeToken(defs)
	for _, pattern := range l.Patterns {
		if err := pattern.MarshalXML(x, xml.StartElement{Name: xml.Name{Local: "pattern"}}); err != nil {
			return cw.Count, err
		}
	}
	for _, mask := range l.Masks {
		if err := mask.MarshalXML(x, xml.StartElement{Name: xml.Name{Local: "mask"}}); err != nil {
			return cw.Count, err
		}
	}
	x.EncodeToken(defs.End())
	for _, layer := range l.Layers {
		if err := layer.MarshalXML(x, xml.StartElement{Name: xml.Name{Local: "g"}}); err != nil {
			return cw.Count, err
		}
	}
	x.EncodeToken(svg.End())
	x.Flush()
	return cw.Count, cw.Err
}

func (c *colour) MarshalXMLAttr(name xml.Name) (xml.Attr, error) {
	return xml.Attr{Name: name, Value: fmt.Sprintf("rgba(%d, %d, %d, %.3f)", c.R, c.G, c.B, float32(c.A)/255)}, nil
}

func (p *pattern) MarshalXML(x *xml.Encoder, se xml.StartElement) error {
	se.Attr = append(patternAttrs[:],
		xml.Attr{Name: xml.Name{Local: "id"}, Value: p.ID},
		xml.Attr{Name: xml.Name{Local: "width"}, Value: strconv.FormatUint(p.Width, 10)},
		xml.Attr{Name: xml.Name{Local: "height"}, Value: strconv.FormatUint(p.Height, 10)},
	)
	x.EncodeToken(se)
	if p.Path != nil {
		attrs := make([]xml.Attr, 1, 4)
		attrs[0] = xml.Attr{Name: xml.Name{Local: "d"}, Value: p.Path.Path}
		if p.Path.Fill.A != 0 {
			colour, _ := p.Path.Fill.MarshalXMLAttr(xml.Name{Local: "fill"})
			attrs = append(attrs, colour)
		}
		if p.Path.Stroke.A != 0 {
			colour, _ := p.Path.Stroke.MarshalXMLAttr(xml.Name{Local: "stroke"})
			attrs = append(attrs, colour)
		}
		if p.Path.StrokeWidth > 0 {
			attrs = append(attrs, xml.Attr{
				Name:  xml.Name{Local: "stroke-width"},
				Value: strconv.FormatUint(p.Path.StrokeWidth, 10),
			})
		}
		path := xml.StartElement{Name: xml.Name{Local: "path"}, Attr: attrs}
		x.EncodeToken(path)
		x.EncodeToken(path.End())
	} else if p.Image != nil {
		if err := p.Image.MarshalXML(x, xml.StartElement{Name: xml.Name{Local: "image"}}); err != nil {
			return err
		}
	}
	x.EncodeToken(se.End())
	return nil
}

func (m *mask) MarshalXML(x *xml.Encoder, se xml.StartElement) error {
	se.Attr = []xml.Attr{{Name: xml.Name{Local: "id"}, Value: m.ID}}
	x.EncodeToken(se)
	if err := m.Image.MarshalXML(x, xml.StartElement{Name: xml.Name{Local: "image"}}); err != nil {
		return err
	}
	x.EncodeToken(se.End())
	return nil
}

func (l *layer) MarshalXML(x *xml.Encoder, se xml.StartElement) error {
	se.Attr = append(make([]xml.Attr, 0, 3),
		xml.Attr{Name: xml.Name{Local: "data-name"}, Value: l.Name},
	)
	if l.Mask != "" {
		se.Attr = append(se.Attr, xml.Attr{Name: xml.Name{Local: "mask"}, Value: "url(#" + l.Mask + ")"})
	}
	if l.Hidden {
		se.Attr = append(se.Attr, xml.Attr{Name: xml.Name{Local: "visibility"}, Value: "hidden"})
	}
	x.EncodeToken(se)
	if l.Layers != nil {
		for _, ly := range l.Layers {
			if err := ly.MarshalXML(x, xml.StartElement{Name: xml.Name{Local: "g"}}); err != nil {
				return err
			}
		}
	} else {
		for _, t := range l.Tokens {
			if err := t.MarshalXML(x, xml.StartElement{}); err != nil {
				return err
			}
		}
	}
	x.EncodeToken(se.End())
	return nil
}

func (t *token) MarshalXML(x *xml.Encoder, se xml.StartElement) error {
	var transform string
	translateX := t.X
	translateY := t.Y
	if t.Flip {
		translateY = -int64(t.Height) - translateY
	}
	if t.Flop {
		translateX = -int64(t.Width) - translateX
	}
	if translateX != 0 || translateY != 0 {
		if translateY == 0 {
			transform = "translate(" + strconv.FormatInt(translateX, 10) + ") "
		} else if translateX == 0 {
			transform = "translate(0, " + strconv.FormatInt(translateY, 10) + ") "
		} else {
			transform = "translate(" + strconv.FormatInt(translateX, 10) + ", " + strconv.FormatInt(translateY, 10) + ") "
		}
	}
	if t.Flip {
		if t.Flop {
			transform += "scale(-1, -1) "
		} else {
			transform += "scale(1, -1) "
		}
	} else if t.Flop {
		transform += "scale(-1, 1) "
	}
	if t.Rotation != 0 {
		transform += "rotate(" + strconv.FormatUint(uint64(t.Rotation)*360/256, 10) + ", " + strconv.FormatUint(t.Width>>1, 10) + ", " + strconv.FormatUint(t.Height>>1, 10) + ")"
	}
	transform = strings.TrimSuffix(transform, " ")
	switch t.TokenType {
	case tokenImage:
		se = xml.StartElement{
			Name: xml.Name{Local: "image"},
			Attr: []xml.Attr{
				{
					Name:  xml.Name{Local: "preserveAspectRatio"},
					Value: "none",
				},
				{
					Name:  xml.Name{Local: "width"},
					Value: strconv.FormatUint(t.Width, 10),
				},
				{
					Name:  xml.Name{Local: "height"},
					Value: strconv.FormatUint(t.Height, 10),
				},
				{
					Name:  xml.Name{Local: "xlink:href"},
					Value: t.Source,
				},
				{
					Name:  xml.Name{Local: "data-token"},
					Value: strconv.FormatUint(t.TokenData, 10),
				},
				{
					Name:  xml.Name{Local: "transform"},
					Value: transform,
				},
			},
		}
	case tokenPattern:
		se = xml.StartElement{
			Name: xml.Name{Local: "rect"},
			Attr: []xml.Attr{
				{
					Name:  xml.Name{Local: "width"},
					Value: strconv.FormatUint(t.Width, 10),
				},
				{
					Name:  xml.Name{Local: "height"},
					Value: strconv.FormatUint(t.Height, 10),
				},
				{
					Name:  xml.Name{Local: "fill"},
					Value: "url(#" + t.Source + ")",
				},
				{
					Name:  xml.Name{Local: "data-token"},
					Value: strconv.FormatUint(t.TokenData, 10),
				},
				{
					Name:  xml.Name{Local: "transform"},
					Value: transform,
				},
			},
		}
	case tokenRect:
		attrs := make([]xml.Attr, 0, 7)
		attrs = append(attrs, xml.Attr{
			Name:  xml.Name{Local: "width"},
			Value: strconv.FormatUint(t.Width, 10),
		}, xml.Attr{
			Name:  xml.Name{Local: "height"},
			Value: strconv.FormatUint(t.Height, 10),
		})
		if t.Source != "" {
			attrs = append(attrs, xml.Attr{
				Name:  xml.Name{Local: "fill"},
				Value: t.Source,
			})
		}
		if t.Stroke.A != 0 {
			attr, _ := t.Stroke.MarshalXMLAttr(xml.Name{Local: "stroke"})
			attrs = append(attrs, attr)
			if t.StrokeWidth != 0 {
				attrs = append(attrs, xml.Attr{
					Name:  xml.Name{Local: "stroke-width"},
					Value: strconv.FormatUint(t.StrokeWidth, 10),
				})
			}
		}
		if t.TokenData != 0 {
			attrs = append(attrs, xml.Attr{
				Name:  xml.Name{Local: "data-token"},
				Value: strconv.FormatUint(t.TokenData, 10),
			})
		}
		se = xml.StartElement{
			Name: xml.Name{Local: "rect"},
			Attr: append(attrs, xml.Attr{
				Name:  xml.Name{Local: "transform"},
				Value: transform,
			}),
		}
	case tokenCircle:
		attrs := make([]xml.Attr, 0, 7)
		attrs = append(attrs, xml.Attr{
			Name:  xml.Name{Local: "rx"},
			Value: strconv.FormatUint(t.Width, 10),
		}, xml.Attr{
			Name:  xml.Name{Local: "ry"},
			Value: strconv.FormatUint(t.Height, 10),
		})
		if t.Source != "" {
			attrs = append(attrs, xml.Attr{
				Name:  xml.Name{Local: "fill"},
				Value: t.Source,
			})
		}
		if t.Stroke.A != 0 {
			attr, _ := t.Stroke.MarshalXMLAttr(xml.Name{Local: "stroke"})
			attrs = append(attrs, attr)
			if t.StrokeWidth != 0 {
				attrs = append(attrs, xml.Attr{
					Name:  xml.Name{Local: "stroke-width"},
					Value: strconv.FormatUint(t.StrokeWidth, 10),
				})
			}
		}
		if t.TokenData != 0 {
			attrs = append(attrs, xml.Attr{
				Name:  xml.Name{Local: "data-token"},
				Value: strconv.FormatUint(t.TokenData, 10),
			})
		}
		se = xml.StartElement{
			Name: xml.Name{Local: "ellipse"},
			Attr: append(attrs, xml.Attr{
				Name:  xml.Name{Local: "transform"},
				Value: transform,
			}),
		}
	default:
		return ErrInvalidTokenType
	}
	if transform == "" {
		se.Attr = se.Attr[:len(se.Attr)-1]
	}
	if err := x.EncodeToken(se); err != nil {
		return err
	}
	return x.EncodeToken(se.End())
}

// Errors
var (
	ErrInvalidSVG           = errors.New("invalid SVG")
	ErrInvalidInitiative    = errors.New("invalid initiaitive")
	ErrInvalidColour        = errors.New("invalid colour")
	ErrInvalidTokenType     = errors.New("invalid token type")
	ErrInvalidTokenSource   = errors.New("invalid token source")
	ErrInvalidPattern       = errors.New("invalid pattern")
	ErrInvalidMask          = errors.New("invalid mask")
	ErrInvalidLayer         = errors.New("layer must either contain tokens or other layers")
	ErrInvalidMapDimensions = errors.New("invalid map dimensions")
)
