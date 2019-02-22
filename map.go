package main

import (
	"encoding/xml"
	"io"

	"vimagination.zapto.org/rwcount"
)

var svgDoctype = xml.Directive("DOCTYPE svg PUBLIC \"-//W3C//DTD SVG 20010904//EN\" \"http://www.w3.org/TR/2001/REC-SVG-20010904/DTD/svg10.dtd\"")

type MapX struct {
	ID       uint64    `xml:"id,attr"`
	Name     string    `xml:"name,attr"`
	Order    uint64    `xml:"order,attr"`
	Width    uint64    `xml:"width,attr"`
	Height   uint64    `xml:"height,attr"`
	Patterns []Pattern `json:"defs>pattern"`
	Masks    []Mask    `json:"defs>mask"`
	Layers   []Layer   `xml:"g"`
}

type PatternX struct {
	ID     string `xml:"id,attr"`
	Width  uint64 `xml:"width,attr"`
	Height uint64 `xml:"height,attr"`
	Image  *Token `xml:"image,omitempty,any"`
	Path   *Path  `xml:"path,omitempty"`
}

type Mask struct {
	ID    string `xml:"id,attr"`
	Image Token  `xml:"image"`
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
	Mask   string  `xml:"mask,attr,omitempty"`
	Tokens []Token `xml:",any"`
}

type Token struct {
	Source      string
	Stroke      string
	StrokeWidth uint64
	ID          uint64
	X           int64
	Y           int64
	Width       uint64
	Height      uint64
	Rotation    uint8
	Flip, Flop  bool
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
