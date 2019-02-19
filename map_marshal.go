package main

import (
	"encoding/xml"
	"strconv"
	"strings"

	"vimagination.zapto.org/errors"
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

type tokenType uint8

const (
	tokenImage tokenType = iota + 1
	tokenPattern
)

func (x *Token) MarshalXML(e *xml.Encoder, s xml.StartElement) error {
	if s.Name.Local == "image" {
		x.tokenType = tokenImage
	}
	switch x.tokenType {
	case tokenImage:
		s = xml.StartElement{
			Name: xml.Name{Local: "image"},
			Attr: []xml.Attr{
				{
					Name:  xml.Name{Local: "x"},
					Value: strconv.FormatInt(x.X, 10),
				},
				{
					Name:  xml.Name{Local: "y"},
					Value: strconv.FormatInt(x.Y, 10),
				},
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
			},
		}
	case tokenPattern:
		s = xml.StartElement{
			Name: xml.Name{Local: "rect"},
			Attr: []xml.Attr{
				{
					Name:  xml.Name{Local: "fill"},
					Value: "url(#" + x.Source + ")",
				},
				{
					Name:  xml.Name{Local: "tranform"},
					Value: "translate(" + strconv.FormatInt(x.X, 10) + ", " + strconv.FormatInt(x.Y, 10) + ")",
				},
				{
					Name:  xml.Name{Local: "width"},
					Value: strconv.FormatUint(x.Width, 10),
				},
				{
					Name:  xml.Name{Local: "height"},
					Value: strconv.FormatUint(x.Height, 10),
				},
			},
		}
	default:
		return errors.Error("invalid token type")
	}
	if err := e.EncodeToken(s); err != nil {
		return err
	}
	return e.EncodeToken(s.End())
}

func (x *Token) UnmarshalXML(d *xml.Decoder, s xml.StartElement) error {
	switch s.Name.Local {
	case "image":
		x.tokenType = tokenImage
	case "rect":
		x.tokenType = tokenPattern
	default:
		return nil
	}
	var err error
	for _, attr := range s.Attr {
		switch attr.Name.Local {
		case "x":
			x.X, err = strconv.ParseInt(attr.Value, 10, 64)
		case "y":
			x.Y, err = strconv.ParseInt(attr.Value, 10, 64)
		case "transform":
		case "width":
			x.Width, err = strconv.ParseUint(attr.Value, 10, 64)
		case "height":
			x.Height, err = strconv.ParseUint(attr.Value, 10, 64)
		case "xlink:href", "href":
			x.Source = attr.Value
		case "fill":
			x.Source = strings.TrimSuffix(strings.TrimPrefix(attr.Value, "url(#"), ")")
		}
		if err != nil {
			return errors.WithContext("error unmarshling token: ", err)
		}
	}
	if x.Source == "" {
		return errors.Error("invalid token source")
	}
	return nil
}
