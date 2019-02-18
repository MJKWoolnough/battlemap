package main

import (
	"encoding/xml"
	"strconv"

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

type Image Token

var ImageAttrs = [...]xml.Attr{
	{
		Name:  xml.Name{Local: "preserveAspectRation"},
		Value: "none",
	},
}

type Video Token

var VideoAttrs = [...]xml.Attr{
	{
		Name:  xml.Name{Local: "xmlns"},
		Value: "http://www.w3.org/1999/xhtml",
	}, {
		Name:  xml.Name{Local: "autoplay"},
		Value: "autoplay",
	}, {
		Name:  xml.Name{Local: "loop"},
		Value: "loop",
	}, {
		Name:  xml.Name{Local: "muted"},
		Value: "muted",
	}, {
		Name:  xml.Name{Local: "style"},
		Value: "object-fit: fill",
	}, {
		Name:  xml.Name{Local: "width"},
		Value: "100%",
	}, {
		Name:  xml.Name{Local: "height"},
		Value: "100%",
	},
}

func (x *Video) MarshalXML(e *xml.Encoder, s xml.StartElement) error {
	if err := e.EncodeToken(xml.StartElement{
		Name: xml.Name{Local: "foreignObject"},
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
		},
	}); err != nil {
		return err
	}
	if err := e.EncodeToken(xml.StartElement{
		Name: xml.Name{Local: "video"},
		Attr: VideoAttrs,
	}); err != nil {
		return err
	}
	err := e.EncodeToken(xml.StartElement{
		Name: xml.Name{Local: "source"},
		Attr: []xml.Attr{
			{
				Name:  xml.Name{Local: "src"},
				Value: x.Source,
			},
		},
	})
}

func (x *Video) UnmarshalXML(d *xml.Decoder, s xml.StartElement) error {
	var err error
	for _, attr := range s.Attr {
		switch attr.Name.Local {
		case "x":
			x.X, err = strconv.ParseInt(attr.Value, 10, 64)
		case "y":
			x.Y, err = strconv.ParseInt(attr.Value, 10, 64)
		case "width":
			x.Width, err = strconv.ParseUint(attr.Value, 10, 64)
		case "height":
			x.Height, err = strconv.ParseUint(attr.Value, 10, 64)
		}
		if err != nil {
			return err
		}
	}
Loop:
	for {
		t, err := d.Token()
		if err != nil {
			return err
		}
		switch t := t.(type) {
		case xml.StartElement:
			if t.Name.Local == "source" {
				for _, attr := range t.Attr {
					if attr.Name.Local == "src" {
						x.Source = attr.Value
					}
				}
			}
		case xml.EndElement:
			if t.Name.Local == s.Name.Local {
				break Loop
			}
		}
	}
	if x.Source == "" {
		return errors.Error("invalid video source")
	}
	return nil
}

type tokenType uint

const (
	tokenImage tokenType = iota + 1
	tokenVideo
)

func (x *Token) MarshalXML(e *xml.Encoder, s xml.StartElement) error {
	switch x.tokenType {
	case tokenImage:
		return e.EncodeElement((*Image)(x), xml.StartElement{
			Name: xml.Name{Local: "image"},
			Attr: ImageAttrs[:],
		})
	case tokenVideo:
		return e.EncodeElement((*Video)(x), xml.StartElement{})
	default:
		return errors.Error("invalid token type")
	}
}

func (x *Token) UnmarshalXML(d *xml.Decoder, s xml.StartElement) error {
	switch s.Name.Local {
	case "image":
		x.tokenType = tokenImage
		return d.DecodeElement((*Image)(x), s)
	case "foreignObject":
		x.tokenType = tokenVideo
		return d.DecodeElement((*Video)(x), s)
	}
	return nil
}
