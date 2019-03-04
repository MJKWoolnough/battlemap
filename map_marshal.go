package main

import (
	"encoding/xml"
	"fmt"
	"strconv"
	"strings"

	"vimagination.zapto.org/errors"
	"vimagination.zapto.org/parser"
)

type Map MapX

var MapAttrs = [...]xml.Attr{
	{
		Name:  xml.Name{Local: "xmlns"},
		Value: "http://www.w3.org/2000/svg",
	}, {
		Name:  xml.Name{Local: "xmlns:xlink"},
		Value: "http://www.w3.org/1999/xlink",
	},
}

func (x *Map) MarshalXML(e *xml.Encoder, s xml.StartElement) error {
	s.Attr = MapAttrs[:]
	return e.EncodeElement((*MapX)(x), s)
}

type Pattern PatternX

var PatternAttrs = [...]xml.Attr{
	{
		Name:  xml.Name{Local: "patternUnits"},
		Value: "userSpaceOnUse",
	},
}

func (x *Pattern) MarshalXML(e *xml.Encoder, s xml.StartElement) error {
	s.Attr = PatternAttrs[:]
	return e.EncodeElement((*PatternX)(x), s)
}

type TokenType uint8

const (
	tokenImage TokenType = iota + 1
	tokenPattern
	tokenRect
	tokenCircle
)

func (x *Token) MarshalXML(e *xml.Encoder, s xml.StartElement) error {
	var transform string
	translateX := x.X
	translateY := x.Y
	if x.Flip {
		translateY = -int64(x.Height) - translateY
	}
	if x.Flop {
		translateX = -int64(x.Width) - translateX
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
	if x.Flip {
		if x.Flop {
			transform += "scale(-1, -1) "
		} else {
			transform += "scale(1, -1) "
		}
	} else if x.Flop {
		transform += "scale(-1, 1) "
	}
	if x.Rotation != 0 {
		transform += "rotate(" + strconv.FormatUint(uint64(x.Rotation)*360/256, 10) + ", " + strconv.FormatUint(x.Width>>1, 10) + ", " + strconv.FormatUint(x.Height>>1, 10) + ")"
	}
	transform = strings.TrimSuffix(transform, " ")
	switch x.TokenType {
	case tokenImage:
		s = xml.StartElement{
			Name: xml.Name{Local: "image"},
			Attr: []xml.Attr{
				{
					Name:  xml.Name{Local: "width"},
					Value: strconv.FormatUint(x.Width, 10),
				},
				{
					Name:  xml.Name{Local: "height"},
					Value: strconv.FormatUint(x.Height, 10),
				},
				{
					Name:  xml.Name{Local: "xlink:href"},
					Value: x.Source,
				},
				{
					Name:  xml.Name{Local: "preserveAspectRatio"},
					Value: "none",
				},
				{
					Name:  xml.Name{Local: "data-token"},
					Value: strconv.FormatUint(x.TokenData, 10),
				},
				{
					Name:  xml.Name{Local: "transform"},
					Value: transform,
				},
			},
		}
	case tokenPattern:
		s = xml.StartElement{
			Name: xml.Name{Local: "rect"},
			Attr: []xml.Attr{
				{
					Name:  xml.Name{Local: "width"},
					Value: strconv.FormatUint(x.Width, 10),
				},
				{
					Name:  xml.Name{Local: "height"},
					Value: strconv.FormatUint(x.Height, 10),
				},
				{
					Name:  xml.Name{Local: "fill"},
					Value: "url(#" + x.Source + ")",
				},
				{
					Name:  xml.Name{Local: "data-token"},
					Value: strconv.FormatUint(x.TokenData, 10),
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
			Value: strconv.FormatUint(x.Width, 10),
		}, xml.Attr{
			Name:  xml.Name{Local: "height"},
			Value: strconv.FormatUint(x.Height, 10),
		})
		if x.Source != "" {
			attrs = append(attrs, xml.Attr{
				Name:  xml.Name{Local: "fill"},
				Value: x.Source,
			})
		}
		if x.Stroke.A != 0 {
			attr, _ := x.Stroke.MarshalXMLAttr(xml.Name{Local: "stroke"})
			attrs = append(attrs, attr)
			if x.StrokeWidth != 0 {
				attrs = append(attrs, xml.Attr{
					Name:  xml.Name{Local: "stroke-width"},
					Value: strconv.FormatUint(x.StrokeWidth, 10),
				})
			}
		}
		if x.TokenData != 0 {
			attrs = append(attrs, xml.Attr{
				Name:  xml.Name{Local: "data-token"},
				Value: strconv.FormatUint(x.TokenData, 10),
			})
		}
		s = xml.StartElement{
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
			Value: strconv.FormatUint(x.Width, 10),
		}, xml.Attr{
			Name:  xml.Name{Local: "ry"},
			Value: strconv.FormatUint(x.Height, 10),
		})
		if x.Source != "" {
			attrs = append(attrs, xml.Attr{
				Name:  xml.Name{Local: "fill"},
				Value: x.Source,
			})
		}
		if x.Stroke.A != 0 {
			attr, _ := x.Stroke.MarshalXMLAttr(xml.Name{Local: "stroke"})
			attrs = append(attrs, attr)
			if x.StrokeWidth != 0 {
				attrs = append(attrs, xml.Attr{
					Name:  xml.Name{Local: "stroke-width"},
					Value: strconv.FormatUint(x.StrokeWidth, 10),
				})
			}
		}
		if x.TokenData != 0 {
			attrs = append(attrs, xml.Attr{
				Name:  xml.Name{Local: "data-token"},
				Value: strconv.FormatUint(x.TokenData, 10),
			})
		}
		s = xml.StartElement{
			Name: xml.Name{Local: "ellipse"},
			Attr: append(attrs, xml.Attr{
				Name:  xml.Name{Local: "transform"},
				Value: transform,
			}),
		}
	default:
		return errors.Error("invalid token type")
	}
	if transform == "" {
		s.Attr = s.Attr[:len(s.Attr)-1]
	}
	if err := e.EncodeToken(s); err != nil {
		return err
	}
	return e.EncodeToken(s.End())
}

const numbers = "0123456789"

func (x *Token) UnmarshalXML(d *xml.Decoder, s xml.StartElement) error {
	switch s.Name.Local {
	case "image":
		x.TokenType = tokenImage
	case "rect":
		x.TokenType = tokenPattern
	case "circle":
		x.TokenType = tokenCircle
	default:
		return nil
	}
	var (
		err                    error
		translateX, translateY int64
	)
	for _, attr := range s.Attr {
		switch attr.Name.Local {
		case "transform":
			t := parser.NewStringTokeniser(attr.Value)
			for {
				if t.ExceptRun("(") == -1 {
					break
				}
				method := strings.TrimLeft(t.Get(), " ")
				t.Accept("(")
				t.AcceptRun(" ")
				t.Get()
				switch method {
				case "translate":
					t.Accept("-")
					t.AcceptRun(numbers)
					var err error
					if translateX, err = strconv.ParseInt(t.Get(), 10, 64); err != nil {
						return errors.WithContext("error parsing translate X: ", err)
					}
					t.AcceptRun(" ")
					if t.Accept(")") {
						t.Get()
						continue
					}
					t.Accept(",")
					t.AcceptRun(" ")
					t.Get()
					t.Accept("-")
					t.AcceptRun(numbers)
					if translateY, err = strconv.ParseInt(t.Get(), 10, 64); err != nil {
						return errors.WithContext("error parsing translate Y: ", err)
					}
					t.AcceptRun(" ")
					t.Accept(")")
					t.Get()
				case "scale":
					if t.Accept("-") {
						x.Flop = true
					}
					if t.ExceptRun(")-") == '-' {
						x.Flip = true
						t.ExceptRun(")")
						t.Accept(")")
					}
					t.Get()
				case "rotate":
					t.AcceptRun(numbers)
					r, err := strconv.ParseUint(t.Get(), 10, 64)
					if err != nil {
						return errors.WithContext("error parsing rotation: ", err)
					}
					x.Rotation = uint8(r % 360 * 256 / 360)
					t.ExceptRun(")")
					t.Accept(")")
					t.Get()
				}
			}
		case "width":
			x.Width, err = strconv.ParseUint(attr.Value, 10, 64)
		case "height":
			x.Height, err = strconv.ParseUint(attr.Value, 10, 64)
		case "xlink:href", "href":
			x.Source = attr.Value
		case "fill":
			if strings.HasPrefix(attr.Value, "url(") {
				x.Source = strings.TrimSuffix(strings.TrimPrefix(attr.Value, "url(#"), ")")
			} else {
				x.Source = attr.Value
				if x.TokenType == tokenPattern {
					x.TokenType = tokenRect
				}
			}
		case "stroke":
			err = x.Stroke.UnmarshalXMLAttr(attr)
		case "stroke-width":
			x.StrokeWidth, err = strconv.ParseUint(attr.Value, 10, 64)
		case "data-token":
			x.TokenData, err = strconv.ParseUint(attr.Value, 10, 64)
		}
		if err != nil {
			return errors.WithContext("error unmarshling token: ", err)
		}
	}
	if x.Flop {
		translateX = -translateX - int64(x.Width)
	}
	if x.Flip {
		translateY = -translateY - int64(x.Height)
	}
	x.X = translateX
	x.Y = translateY
	if (x.TokenType == tokenImage || x.TokenType == tokenPattern) && x.Source == "" {
		return errors.Error("invalid token source")
	}
	return nil
}

type Colour struct {
	R uint8 `json:"r"`
	G uint8 `json:"g"`
	B uint8 `json:"b"`
	A uint8 `json:"a"`
}

func (c Colour) MarshalXMLAttr(name xml.Name) (xml.Attr, error) {
	return xml.Attr {
		Name:  name,
		Value: fmt.Sprintf("rgba(%d, %d, %d, %.2f)", c.R, c.G, c.B, float32(c.A)/255),
	}, nil
}

func (c *Colour) UnmarshalXMLAttr(attr xml.Attr) error {
	cs := strings.Split(strings.TrimSuffix(strings.TrimPrefix(attr.Value, "rgba("), ")"), ",")
	if len(cs) != 4 {
		return errors.Error("invalid colour")
	}
	r, err := strconv.ParseUint(strings.TrimSpace(cs[0]), 10, 8)
	if err != nil {
		return errors.WithContext("error decoding Red: ", err)
	}
	g, err := strconv.ParseUint(strings.TrimSpace(cs[1]), 10, 8)
	if err != nil {
		return errors.WithContext("error decoding Green: ", err)
	}
	b, err := strconv.ParseUint(strings.TrimSpace(cs[2]), 10, 8)
	if err != nil {
		return errors.WithContext("error decoding Blue: ", err)
	}
	a, err := strconv.ParseFloat(strings.TrimSpace(cs[3]), 32)
	if err != nil {
		return errors.WithContext("error decoding Alpha: ", err)
	}
	c.R = uint8(r)
	c.G = uint8(g)
	c.B = uint8(b)
	c.A = uint8(a * 255)
	return nil
}

type Hidden bool

func (h Hidden) MarshalXMLAttr(name xml.Name) (xml.Attr, error) {
	attr := xml.Attr{Name: name}
	if h {
		attr.Value = "hidden"
	} else {
		attr.Value = "visible"
	}
	return attr, nil
}

func (h *Hidden) Unmarshal(attr xml.Attr) error {
	*h = attr.Value == "hidden"
	return nil
}
