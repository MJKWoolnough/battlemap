package main

import (
	"encoding/xml"
	"io"

	"vimagination.zapto.org/rwcount"
)

var svgDoctype = xml.Directive("DOCTYPE svg PUBLIC \"-//W3C//DTD SVG 20010904//EN\" \"http://www.w3.org/TR/2001/REC-SVG-20010904/DTD/svg10.dtd\"")

type MapX struct {
	Width  uint `xml:"width,attr"`
	Height uint `xml:"height,attr"`
	Defs   struct {
		Patterns []Patterns `json:"pattern"`
	} `xml:"defs"`
	Layers []Layer `xml:"g"`
}

type PatternX struct {
	PatternUnits PatternUnits `xml:",attr"`
	ID           string       `xml:"id,attr"`
	Width        uint         `xml:"width,attr"`
	Height       uint         `xml:"height,attr"`
	Image        *Image       `xml:"image,omitempty"`
	Path         *Path        `xml:"path,omitempty"`
}

type Path struct {
	Path        string `xml:"d,attr"`
	Fill        string `xml:"fill,attr,omitempty"`
	Stroke      string `xml:"stroke,attr,omitempty"`
	StrokeWidth string `xml:"stroke-width,attr,omitempty"`
}

type Layer struct {
	ID     string  `xml:"id,attr"`
	Tokens []Token `xml:",any"`
}

type Token struct {
	tokenType
	Source string `xml:"xlink:href,attr"`
	X      int    `xml:"x,attr"`
	Y      int    `xml:"y,attr"`
	Width  uint   `xml:"width,attr"`
	Height uint   `xml:"height,attr"`
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
