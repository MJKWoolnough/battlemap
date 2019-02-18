package main

import (
	"encoding/xml"
	"io"

	"vimagination.zapto.org/rwcount"
)

var svgDoctype = xml.Directive("DOCTYPE svg PUBLIC \"-//W3C//DTD SVG 20010904//EN\" \"http://www.w3.org/TR/2001/REC-SVG-20010904/DTD/svg10.dtd\"")

type MapX struct {
	Width    uint       `xml:"width,attr"`
	Height   uint       `xml:"height,attr"`
	Patterns []Patterns `json:"defs>pattern"`
	Layers   []Layer    `xml:"g"`
}

type PatternX struct {
	ID     string `xml:"id,attr"`
	Width  uint   `xml:"width,attr"`
	Height uint   `xml:"height,attr"`
	Image  *Token `xml:"image,omitempty,any"`
	Path   *Path  `xml:"path,omitempty"`
}

type Path struct {
	Path        string `xml:"d,attr"`
	Fill        string `xml:"fill,attr,omitempty"`
	Stroke      string `xml:"stroke,attr,omitempty"`
	StrokeWidth string `xml:"stroke-width,attr,omitempty"`
}

type Layer struct {
	ID     string  `xml:"id,attr"`
	Name   string  `xml:"name,attr"`
	Tokens []Token `xml:",any"`
}

type Token struct {
	Source     string
	X          int
	Y          int
	Width      uint
	Height     uint
	Rotation   uint16
	Flip, Flop bool
	tokenType
}

func (m *Map) WriteTo(w io.Writer) (int64, error) {
	cw := rwcount.Writer{Writer: w}
	io.WriteString(&cw, xml.Header)
	xe := xml.NewEncoder(&cw)
	xe.EncodeToken(svgDoctype)
	xe.EncodeElement(m, xml.StartElement{Name: xml.Name{Local: "svg"}})
	return cw.Count, cw.Err
}

func (m *Map) ReadFrom(r io.Reader) (int64, error) {
	cr := rwcount.Reader{Reader: r}
	cr.Err = xml.NewDecoder(&cr).Decode(m)
	return cr.Count, cr.Err
}
