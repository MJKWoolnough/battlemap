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
			Input: "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n<!DOCTYPE svg PUBLIC \"-//W3C//DTD SVG 20010904//EN\" \"http://www.w3.org/TR/2001/REC-SVG-20010904/DTD/svg10.dtd\"><svg xmlns=\"http://www.w3.org/2000/svg\" xmlns:xlink=\"http://www.w3.org/1999/xlink\" width=\"100\" height=\"200\" data-initiative=\"0|1,2|3,3|4\" data-grid-pos=\"1\" data-grid-hidden=\"true\" data-light-pos=\"2\" data-light-hidden=\"false\" data-light-colour=\"rgba(3, 2, 1, 0.498)\"><defs></defs><g data-name=\"Test Layer\"></g></svg>",
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
				layer: layer{
					Layers: []*layer{
						{
							Name:   "Test Layer",
							Mask:   "",
							Hidden: false,
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
