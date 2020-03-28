package battlemap

import (
	"reflect"
	"strings"
	"testing"

	"vimagination.zapto.org/memio"
)

func TestMapsMarshal(t *testing.T) {
	var buf memio.Buffer
	for n, test := range [...]struct {
		Input  string
		Output levelMap
		Err    error
	}{
		{
			Input: "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n<!DOCTYPE svg PUBLIC \"-//W3C//DTD SVG 20010904//EN\" \"http://www.w3.org/TR/2001/REC-SVG-20010904/DTD/svg10.dtd\"><svg xmlns=\"http://www.w3.org/2000/svg\" xmlns:xlink=\"http://www.w3.org/1999/xlink\"></svg>",
			Err:   ErrInvalidMapDimensions,
		},
		{
			Input: "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n<!DOCTYPE svg PUBLIC \"-//W3C//DTD SVG 20010904//EN\" \"http://www.w3.org/TR/2001/REC-SVG-20010904/DTD/svg10.dtd\"><svg xmlns=\"http://www.w3.org/2000/svg\" xmlns:xlink=\"http://www.w3.org/1999/xlink\" width=\"100\" height=\"200\" data-initiative=\"0|1,2|3,3|4\" data-grid-pos=\"1\" data-grid-hidden=\"true\" data-light-pos=\"2\" data-light-hidden=\"false\" data-light-colour=\"rgba(3, 2, 1, 0.498)\"><defs></defs></svg>",
			Output: levelMap{
				Width:       100,
				Height:      200,
				Initiative:  [][2]uint64{{0, 1}, {2, 3}, {3, 4}},
				GridPos:     1,
				GridHidden:  true,
				LightPos:    2,
				LightHidden: false,
				LightColour: colour{R: 3, G: 2, B: 1, A: 127},
				Patterns:    map[string]*pattern{},
				Masks:       map[string]*mask{},
			},
		},
		{
			Input: "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n<!DOCTYPE svg PUBLIC \"-//W3C//DTD SVG 20010904//EN\" \"http://www.w3.org/TR/2001/REC-SVG-20010904/DTD/svg10.dtd\"><svg xmlns=\"http://www.w3.org/2000/svg\" xmlns:xlink=\"http://www.w3.org/1999/xlink\" width=\"1\" height=\"2\" data-initiative=\"\" data-grid-pos=\"0\" data-grid-hidden=\"false\" data-light-pos=\"0\" data-light-hidden=\"false\" data-light-colour=\"rgba(0, 0, 0, 0.000)\"><defs><pattern patternUnits=\"userSpaceOnUse\" width=\"1\" height=\"2\"><path d=\"M 0 200 V 0 H 100\" fill=\"rgba(255, 0, 0, 1.000)\" stroke=\"rgba(0, 0, 0, 1.000)\" stroke-width=\"1\"></path></pattern></defs></svg>",
			Err:   ErrInvalidPattern,
		},
		{
			Input: "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n<!DOCTYPE svg PUBLIC \"-//W3C//DTD SVG 20010904//EN\" \"http://www.w3.org/TR/2001/REC-SVG-20010904/DTD/svg10.dtd\"><svg xmlns=\"http://www.w3.org/2000/svg\" xmlns:xlink=\"http://www.w3.org/1999/xlink\" width=\"1\" height=\"2\" data-initiative=\"\" data-grid-pos=\"0\" data-grid-hidden=\"false\" data-light-pos=\"0\" data-light-hidden=\"false\" data-light-colour=\"rgba(0, 0, 0, 0.000)\"><defs><pattern patternUnits=\"userSpaceOnUse\" id=\"gridPattern\" width=\"0\" height=\"2\"><path d=\"M 0 200 V 0 H 100\" fill=\"rgba(255, 0, 0, 1.000)\" stroke=\"rgba(0, 0, 0, 1.000)\" stroke-width=\"1\"></path></pattern></defs></svg>",
			Err:   ErrInvalidPattern,
		},
		{
			Input: "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n<!DOCTYPE svg PUBLIC \"-//W3C//DTD SVG 20010904//EN\" \"http://www.w3.org/TR/2001/REC-SVG-20010904/DTD/svg10.dtd\"><svg xmlns=\"http://www.w3.org/2000/svg\" xmlns:xlink=\"http://www.w3.org/1999/xlink\" width=\"1\" height=\"2\" data-initiative=\"\" data-grid-pos=\"0\" data-grid-hidden=\"false\" data-light-pos=\"0\" data-light-hidden=\"false\" data-light-colour=\"rgba(0, 0, 0, 0.000)\"><defs><pattern patternUnits=\"userSpaceOnUse\" id=\"gridPattern\" width=\"1\" height=\"0\"><path d=\"M 0 200 V 0 H 100\" fill=\"rgba(255, 0, 0, 1.000)\" stroke=\"rgba(0, 0, 0, 1.000)\" stroke-width=\"1\"></path></pattern></defs></svg>",
			Err:   ErrInvalidPattern,
		},
		{
			Input: "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n<!DOCTYPE svg PUBLIC \"-//W3C//DTD SVG 20010904//EN\" \"http://www.w3.org/TR/2001/REC-SVG-20010904/DTD/svg10.dtd\"><svg xmlns=\"http://www.w3.org/2000/svg\" xmlns:xlink=\"http://www.w3.org/1999/xlink\" width=\"1\" height=\"2\" data-initiative=\"\" data-grid-pos=\"0\" data-grid-hidden=\"false\" data-light-pos=\"0\" data-light-hidden=\"false\" data-light-colour=\"rgba(0, 0, 0, 0.000)\"><defs><pattern patternUnits=\"userSpaceOnUse\" id=\"gridPattern\" width=\"1\" height=\"2\"><path fill=\"rgba(255, 0, 0, 1.000)\" stroke=\"rgba(0, 0, 0, 1.000)\" stroke-width=\"1\"></path></pattern></defs></svg>",
			Err:   ErrInvalidPattern,
		},
		{
			Input: "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n<!DOCTYPE svg PUBLIC \"-//W3C//DTD SVG 20010904//EN\" \"http://www.w3.org/TR/2001/REC-SVG-20010904/DTD/svg10.dtd\"><svg xmlns=\"http://www.w3.org/2000/svg\" xmlns:xlink=\"http://www.w3.org/1999/xlink\" width=\"1\" height=\"2\" data-initiative=\"\" data-grid-pos=\"0\" data-grid-hidden=\"false\" data-light-pos=\"0\" data-light-hidden=\"false\" data-light-colour=\"rgba(0, 0, 0, 0.000)\"><defs><pattern patternUnits=\"userSpaceOnUse\" id=\"gridPattern\" width=\"1\" height=\"2\"><path d=\"M 0 200 V 0 H 100\" stroke-width=\"1\"></path></pattern></defs></svg>",
			Err:   ErrInvalidPattern,
		},
		{
			Input: "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n<!DOCTYPE svg PUBLIC \"-//W3C//DTD SVG 20010904//EN\" \"http://www.w3.org/TR/2001/REC-SVG-20010904/DTD/svg10.dtd\"><svg xmlns=\"http://www.w3.org/2000/svg\" xmlns:xlink=\"http://www.w3.org/1999/xlink\" width=\"1\" height=\"2\" data-initiative=\"\" data-grid-pos=\"0\" data-grid-hidden=\"false\" data-light-pos=\"0\" data-light-hidden=\"false\" data-light-colour=\"rgba(0, 0, 0, 0.000)\"><defs><pattern patternUnits=\"userSpaceOnUse\" id=\"gridPattern\" width=\"1\" height=\"2\"><path d=\"M 0 200 V 0 H 100\" stroke=\"rgba(0, 0, 0, 1.000)\" stroke-width=\"0\"></path></pattern></defs></svg>",
			Err:   ErrInvalidPattern,
		},
		{
			Input: "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n<!DOCTYPE svg PUBLIC \"-//W3C//DTD SVG 20010904//EN\" \"http://www.w3.org/TR/2001/REC-SVG-20010904/DTD/svg10.dtd\"><svg xmlns=\"http://www.w3.org/2000/svg\" xmlns:xlink=\"http://www.w3.org/1999/xlink\" width=\"1\" height=\"2\" data-initiative=\"\" data-grid-pos=\"0\" data-grid-hidden=\"false\" data-light-pos=\"0\" data-light-hidden=\"false\" data-light-colour=\"rgba(0, 0, 0, 0.000)\"><defs><pattern patternUnits=\"userSpaceOnUse\" id=\"gridPattern\" width=\"1\" height=\"2\"><path d=\"M 0 200 V 0 H 100\" fill=\"rgba(255, 0, 0, 1.000)\" stroke=\"rgba(0, 0, 0, 1.000)\" stroke-width=\"1\"></path></pattern><mask id=\"mask_1\"><image preserveAspectRatio=\"none\" width=\"100\" height=\"200\" xlink:href=\"source.png\" data-token=\"1\"></image></mask></defs></svg>",
			Output: levelMap{
				Width:  1,
				Height: 2,
				Patterns: map[string]*pattern{
					"gridPattern": &pattern{
						ID:     "gridPattern",
						Width:  1,
						Height: 2,
						Path: &patternPath{
							Path:        "M 0 200 V 0 H 100",
							Fill:        colour{R: 255, G: 0, B: 0, A: 255},
							Stroke:      colour{R: 0, G: 0, B: 0, A: 255},
							StrokeWidth: 1,
						},
					},
				},
				Masks: map[string]*mask{
					"mask_1": &mask{
						ID: "mask_1",
						Image: token{
							Source:    "source.png",
							Width:     100,
							Height:    200,
							TokenData: 1,
							TokenType: tokenImage,
						},
					},
				},
			},
		},
	} {
		var m levelMap
		_, err := m.ReadFrom(strings.NewReader(test.Input))
		if test.Err != err {
			t.Errorf("test %d: expecting error %q, got %q", n+1, test.Err, err)
			continue
		} else if test.Err != nil {
			continue
		} else if err != nil {
			t.Errorf("test %d: unexpected error: %s", n+1, err)
			continue
		} else if !reflect.DeepEqual(test.Output, m) {
			t.Errorf("test %d: got unexpected output", n+1)
			continue
		}
		m.WriteTo(&buf)
		if string(buf) != test.Input {
			t.Errorf("test %d: expecting output %q, got %q", n+1, test.Input, buf)
		}
		buf = buf[:0]
	}
}
