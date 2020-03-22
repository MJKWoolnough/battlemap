package battlemap

import (
	"encoding/xml"
	"io"

	"vimagination.zapto.org/rwcount"
)

var svgDoctype = xml.Directive("DOCTYPE svg PUBLIC \"-//W3C//DTD SVG 20010904//EN\" \"http://www.w3.org/TR/2001/REC-SVG-20010904/DTD/svg10.dtd\"")

type mapX struct {
	Initiative initiative `xml:"data-initiative,attr,omitempty" json:"-"`
	Width      uint64     `xml:"width,attr" json:"-"`
	Height     uint64     `xml:"height,attr" json:"-"`
	Patterns   patterns   `xml:"defs>pattern,omitempty" json:"-"`
	Masks      []mask     `xml:"defs>mask,omitempty" json:"-"`
	layers
}

type patterns []pattern

type patternX struct {
	ID     string       `xml:"id,attr"`
	Width  uint64       `xml:"width,attr"`
	Height uint64       `xml:"height,attr"`
	Image  *token       `xml:"image,omitempty"`
	Path   *patternPath `xml:"path,omitempty"`
}

type mask struct {
	ID    string `xml:"id,attr"`
	Image token  `xml:"image"`
}

type patternPath struct {
	Path        string `xml:"d,attr"`
	Fill        colour `xml:"fill,attr,omitempty"`
	Stroke      colour `xml:"stroke,attr,omitempty"`
	StrokeWidth uint64 `xml:"stroke-width,attr,omitempty"`
}

type layer struct {
	Name     string `xml:"data-name,attr" json:"name"`
	Mask     string `xml:"mask,attr,omitempty" json:"-"`
	Hidden   hidden `xml:"visibility,attr,omitempty" json:"-"`
	Tokens   tokens `xml:",omitempty,any" json:"-"`
	Children layers `xml:"g" json:"-"`
}

type token struct {
	Source      string    `json:"source"`
	Stroke      colour    `json:"colour"`
	StrokeWidth uint64    `json:"strokeWidth"`
	X           int64     `json:"x"`
	Y           int64     `json:"y"`
	Width       uint64    `json:"width"`
	Height      uint64    `json:"height"`
	Rotation    uint8     `json:"rotation"`
	Flip        bool      `json:"flip"`
	Flop        bool      `json:"flop"`
	TokenData   uint64    `json:"tokenData"`
	TokenType   tokenType `json:"tokenType"`
}

func (m *levelMap) WriteTo(w io.Writer) (int64, error) {
	cw := rwcount.Writer{Writer: w}
	io.WriteString(&cw, xml.Header)
	xe := xml.NewEncoder(&cw)
	xe.EncodeToken(svgDoctype)
	xe.EncodeElement(m, xml.StartElement{Name: xml.Name{Local: "svg"}})
	return cw.Count, cw.Err
}

func (m *levelMap) ReadFrom(r io.Reader) (int64, error) {
	cr := rwcount.Reader{Reader: r}
	cr.Err = xml.NewDecoder(&cr).Decode(m)
	return cr.Count, cr.Err
}
