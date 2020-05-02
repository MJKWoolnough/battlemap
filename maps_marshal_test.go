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
		{ // 1
			Input: "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n<!DOCTYPE svg PUBLIC \"-//W3C//DTD SVG 20010904//EN\" \"http://www.w3.org/TR/2001/REC-SVG-20010904/DTD/svg10.dtd\"><svg xmlns=\"http://www.w3.org/2000/svg\" xmlns:xlink=\"http://www.w3.org/1999/xlink\"></svg>",
			Err:   ErrInvalidMapDimensions,
		},
		{ // 2
			Input: "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n<!DOCTYPE svg PUBLIC \"-//W3C//DTD SVG 20010904//EN\" \"http://www.w3.org/TR/2001/REC-SVG-20010904/DTD/svg10.dtd\"><svg xmlns=\"http://www.w3.org/2000/svg\" xmlns:xlink=\"http://www.w3.org/1999/xlink\" width=\"100\" height=\"200\" data-initiative=\"0|1,2|3,3|4\"><defs></defs></svg>",
			Output: levelMap{
				Width:      100,
				Height:     200,
				Initiative: [][2]uint64{{0, 1}, {2, 3}, {3, 4}},
				Patterns:   map[string]*pattern{},
				Masks:      map[string]*mask{},
				layers:     map[string]struct{}{},
				layer: layer{
					IsFolder: true,
				},
			},
		},
		{ // 3
			Input: "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n<!DOCTYPE svg PUBLIC \"-//W3C//DTD SVG 20010904//EN\" \"http://www.w3.org/TR/2001/REC-SVG-20010904/DTD/svg10.dtd\"><svg xmlns=\"http://www.w3.org/2000/svg\" xmlns:xlink=\"http://www.w3.org/1999/xlink\" width=\"1\" height=\"2\" data-initiative=\"\"><defs><pattern patternUnits=\"userSpaceOnUse\" width=\"1\" height=\"2\"><path d=\"M 0 200 V 0 H 100\" fill=\"rgba(255, 0, 0, 1.000)\" stroke=\"rgba(0, 0, 0, 1.000)\" stroke-width=\"1\"></path></pattern></defs></svg>",
			Err:   ErrInvalidPattern,
		},
		{ // 4
			Input: "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n<!DOCTYPE svg PUBLIC \"-//W3C//DTD SVG 20010904//EN\" \"http://www.w3.org/TR/2001/REC-SVG-20010904/DTD/svg10.dtd\"><svg xmlns=\"http://www.w3.org/2000/svg\" xmlns:xlink=\"http://www.w3.org/1999/xlink\" width=\"1\" height=\"2\" data-initiative=\"\"><defs><pattern patternUnits=\"userSpaceOnUse\" id=\"gridPattern\" width=\"0\" height=\"2\"><path d=\"M 0 200 V 0 H 100\" fill=\"rgba(255, 0, 0, 1.000)\" stroke=\"rgba(0, 0, 0, 1.000)\" stroke-width=\"1\"></path></pattern></defs></svg>",
			Err:   ErrInvalidPattern,
		},
		{ // 5
			Input: "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n<!DOCTYPE svg PUBLIC \"-//W3C//DTD SVG 20010904//EN\" \"http://www.w3.org/TR/2001/REC-SVG-20010904/DTD/svg10.dtd\"><svg xmlns=\"http://www.w3.org/2000/svg\" xmlns:xlink=\"http://www.w3.org/1999/xlink\" width=\"1\" height=\"2\" data-initiative=\"\"><defs><pattern patternUnits=\"userSpaceOnUse\" id=\"gridPattern\" width=\"1\" height=\"0\"><path d=\"M 0 200 V 0 H 100\" fill=\"rgba(255, 0, 0, 1.000)\" stroke=\"rgba(0, 0, 0, 1.000)\" stroke-width=\"1\"></path></pattern></defs></svg>",
			Err:   ErrInvalidPattern,
		},
		{ // 6
			Input: "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n<!DOCTYPE svg PUBLIC \"-//W3C//DTD SVG 20010904//EN\" \"http://www.w3.org/TR/2001/REC-SVG-20010904/DTD/svg10.dtd\"><svg xmlns=\"http://www.w3.org/2000/svg\" xmlns:xlink=\"http://www.w3.org/1999/xlink\" width=\"1\" height=\"2\" data-initiative=\"\"><defs><pattern patternUnits=\"userSpaceOnUse\" id=\"gridPattern\" width=\"1\" height=\"2\"><path fill=\"rgba(255, 0, 0, 1.000)\" stroke=\"rgba(0, 0, 0, 1.000)\" stroke-width=\"1\"></path></pattern></defs></svg>",
			Err:   ErrInvalidPattern,
		},
		{ // 7
			Input: "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n<!DOCTYPE svg PUBLIC \"-//W3C//DTD SVG 20010904//EN\" \"http://www.w3.org/TR/2001/REC-SVG-20010904/DTD/svg10.dtd\"><svg xmlns=\"http://www.w3.org/2000/svg\" xmlns:xlink=\"http://www.w3.org/1999/xlink\" width=\"1\" height=\"2\" data-initiative=\"\"><defs><pattern patternUnits=\"userSpaceOnUse\" id=\"gridPattern\" width=\"1\" height=\"2\"><path d=\"M 0 200 V 0 H 100\" stroke-width=\"1\"></path></pattern></defs></svg>",
			Err:   ErrInvalidPattern,
		},
		{ // 8
			Input: "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n<!DOCTYPE svg PUBLIC \"-//W3C//DTD SVG 20010904//EN\" \"http://www.w3.org/TR/2001/REC-SVG-20010904/DTD/svg10.dtd\"><svg xmlns=\"http://www.w3.org/2000/svg\" xmlns:xlink=\"http://www.w3.org/1999/xlink\" width=\"1\" height=\"2\" data-initiative=\"\"><defs><pattern patternUnits=\"userSpaceOnUse\" id=\"gridPattern\" width=\"1\" height=\"2\"><path d=\"M 0 200 V 0 H 100\" stroke=\"rgba(0, 0, 0, 1.000)\" stroke-width=\"0\"></path></pattern></defs></svg>",
			Err:   ErrInvalidPattern,
		},
		{ // 9
			Input: "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n<!DOCTYPE svg PUBLIC \"-//W3C//DTD SVG 20010904//EN\" \"http://www.w3.org/TR/2001/REC-SVG-20010904/DTD/svg10.dtd\"><svg xmlns=\"http://www.w3.org/2000/svg\" xmlns:xlink=\"http://www.w3.org/1999/xlink\" width=\"1\" height=\"2\" data-initiative=\"\"><defs><pattern patternUnits=\"userSpaceOnUse\" id=\"gridPattern\" width=\"1\" height=\"2\"><path d=\"M 0 200 V 0 H 100\" fill=\"rgba(255, 0, 0, 1.000)\" stroke=\"rgba(0, 0, 0, 1.000)\" stroke-width=\"1\"></path></pattern><mask id=\"mask_1\"><image preserveAspectRatio=\"none\" width=\"100\" height=\"200\" href=\"source.png\" data-token=\"1\"></image></mask></defs></svg>",
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
				layers: map[string]struct{}{},
				layer: layer{
					IsFolder: true,
				},
			},
		},
		{ // 10
			Input: "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n<!DOCTYPE svg PUBLIC \"-//W3C//DTD SVG 20010904//EN\" \"http://www.w3.org/TR/2001/REC-SVG-20010904/DTD/svg10.dtd\"><svg xmlns=\"http://www.w3.org/2000/svg\" xmlns:xlink=\"http://www.w3.org/1999/xlink\" width=\"1\" height=\"2\" data-initiative=\"\"><g></g></svg>",
			Err:   ErrInvalidLayer,
		},
		{ // 11
			Input: "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n<!DOCTYPE svg PUBLIC \"-//W3C//DTD SVG 20010904//EN\" \"http://www.w3.org/TR/2001/REC-SVG-20010904/DTD/svg10.dtd\"><svg xmlns=\"http://www.w3.org/2000/svg\" xmlns:xlink=\"http://www.w3.org/1999/xlink\" width=\"1\" height=\"2\" data-initiative=\"\"><defs></defs><g data-name=\"Test Layer\"></g></svg>",
			Output: levelMap{
				Width:    1,
				Height:   2,
				Patterns: map[string]*pattern{},
				Masks:    map[string]*mask{},
				layers: map[string]struct{}{
					"Test Layer": struct{}{},
				},
				layer: layer{
					IsFolder: true,
					Layers: []*layer{
						&layer{
							Name: "Test Layer",
						},
					},
				},
			},
		},
		{ // 12
			Input: "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n<!DOCTYPE svg PUBLIC \"-//W3C//DTD SVG 20010904//EN\" \"http://www.w3.org/TR/2001/REC-SVG-20010904/DTD/svg10.dtd\"><svg xmlns=\"http://www.w3.org/2000/svg\" xmlns:xlink=\"http://www.w3.org/1999/xlink\" width=\"1\" height=\"2\" data-initiative=\"\"><defs></defs><g data-name=\"Test Layer 1\" data-is-folder=\"true\"><g data-name=\"Test Layer 2\" data-is-folder=\"true\"><g data-name=\"Test Layer 3\"></g><g data-name=\"Test Layer 4\" data-is-folder=\"true\"></g></g></g><g data-name=\"Test Layer 5\"></g></svg>",
			Output: levelMap{
				Width:    1,
				Height:   2,
				Patterns: map[string]*pattern{},
				Masks:    map[string]*mask{},
				layers: map[string]struct{}{
					"Test Layer 1": struct{}{},
					"Test Layer 2": struct{}{},
					"Test Layer 3": struct{}{},
					"Test Layer 4": struct{}{},
					"Test Layer 5": struct{}{},
				},
				layer: layer{
					IsFolder: true,
					Layers: []*layer{
						&layer{
							Name:     "Test Layer 1",
							IsFolder: true,
							Layers: []*layer{
								&layer{
									Name:     "Test Layer 2",
									IsFolder: true,
									Layers: []*layer{
										&layer{
											Name: "Test Layer 3",
										},
										&layer{
											Name:     "Test Layer 4",
											IsFolder: true,
										},
									},
								},
							},
						},
						&layer{
							Name: "Test Layer 5",
						},
					},
				},
			},
		},
		{ // 13
			Input: "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n<!DOCTYPE svg PUBLIC \"-//W3C//DTD SVG 20010904//EN\" \"http://www.w3.org/TR/2001/REC-SVG-20010904/DTD/svg10.dtd\"><svg xmlns=\"http://www.w3.org/2000/svg\" xmlns:xlink=\"http://www.w3.org/1999/xlink\" width=\"1\" height=\"2\" data-initiative=\"\"><defs></defs><g data-name=\"Test Layer 1\" mask=\"url(#mask_1)\" visibility=\"hidden\"></g></svg>",
			Output: levelMap{
				Width:    1,
				Height:   2,
				Patterns: map[string]*pattern{},
				Masks:    map[string]*mask{},
				layers: map[string]struct{}{
					"Test Layer 1": struct{}{},
				},
				layer: layer{
					IsFolder: true,
					Layers: []*layer{
						&layer{
							Name:   "Test Layer 1",
							Mask:   "mask_1",
							Hidden: true,
						},
					},
				},
			},
		},
		{ // 14
			Input: "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n<!DOCTYPE svg PUBLIC \"-//W3C//DTD SVG 20010904//EN\" \"http://www.w3.org/TR/2001/REC-SVG-20010904/DTD/svg10.dtd\"><svg xmlns=\"http://www.w3.org/2000/svg\" xmlns:xlink=\"http://www.w3.org/1999/xlink\" width=\"1\" height=\"2\" data-initiative=\"\"><defs></defs><g data-name=\"Test Layer 1\"><rect></rect></g></svg>",
			Err:   ErrInvalidToken,
		},
		{ // 15
			Input: "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n<!DOCTYPE svg PUBLIC \"-//W3C//DTD SVG 20010904//EN\" \"http://www.w3.org/TR/2001/REC-SVG-20010904/DTD/svg10.dtd\"><svg xmlns=\"http://www.w3.org/2000/svg\" xmlns:xlink=\"http://www.w3.org/1999/xlink\" width=\"1\" height=\"2\" data-initiative=\"\"><defs></defs><g data-name=\"Test Layer 1\"><image preserveAspectRatio=\"none\" width=\"1\" height=\"2\" href=\"1.png\" data-token=\"0\"></image></g></svg>",
			Output: levelMap{
				Width:    1,
				Height:   2,
				Patterns: map[string]*pattern{},
				Masks:    map[string]*mask{},
				layers: map[string]struct{}{
					"Test Layer 1": struct{}{},
				},
				layer: layer{
					IsFolder: true,
					Layers: []*layer{
						&layer{
							Name: "Test Layer 1",
							Tokens: []*token{
								&token{
									Width:     1,
									Height:    2,
									Source:    "1.png",
									TokenType: tokenImage,
								},
							},
						},
					},
				},
			},
		},
		{ // 16
			Input: "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n<!DOCTYPE svg PUBLIC \"-//W3C//DTD SVG 20010904//EN\" \"http://www.w3.org/TR/2001/REC-SVG-20010904/DTD/svg10.dtd\"><svg xmlns=\"http://www.w3.org/2000/svg\" xmlns:xlink=\"http://www.w3.org/1999/xlink\" width=\"1\" height=\"2\" data-initiative=\"\"><defs></defs><g data-name=\"Test Layer 1\"><g data-name=\"Test Layer 2\"></g><rect width=\"1\" height=\"2\" xlink:href=\"1.png\"></rect></g></svg>",
			Err:   ErrInvalidLayerFolder,
		},
		{ // 17
			Input: "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n<!DOCTYPE svg PUBLIC \"-//W3C//DTD SVG 20010904//EN\" \"http://www.w3.org/TR/2001/REC-SVG-20010904/DTD/svg10.dtd\"><svg xmlns=\"http://www.w3.org/2000/svg\" xmlns:xlink=\"http://www.w3.org/1999/xlink\" width=\"1\" height=\"2\" data-initiative=\"\"><defs></defs><g data-name=\"Test Layer 1\"><rect width=\"1\" height=\"2\" xlink:href=\"1.png\"></rect><g data-name=\"Test Layer 2\"></g></g></svg>",
			Err:   ErrInvalidLayerFolder,
		},
		{ // 18
			Input: "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n<!DOCTYPE svg PUBLIC \"-//W3C//DTD SVG 20010904//EN\" \"http://www.w3.org/TR/2001/REC-SVG-20010904/DTD/svg10.dtd\"><svg xmlns=\"http://www.w3.org/2000/svg\" xmlns:xlink=\"http://www.w3.org/1999/xlink\" width=\"1\" height=\"2\" data-initiative=\"\"><defs></defs><g data-name=\"Test Layer 1\"><image preserveAspectRatio=\"none\" width=\"1\" height=\"2\" href=\"1.png\" data-token=\"0\"></image><rect width=\"3\" height=\"4\" fill=\"url(#pattern_1)\" data-token=\"1\"></rect></g></svg>",
			Output: levelMap{
				Width:    1,
				Height:   2,
				Patterns: map[string]*pattern{},
				Masks:    map[string]*mask{},
				layers: map[string]struct{}{
					"Test Layer 1": struct{}{},
				},
				layer: layer{
					IsFolder: true,
					Layers: []*layer{
						&layer{
							Name: "Test Layer 1",
							Tokens: []*token{
								&token{
									Width:     1,
									Height:    2,
									Source:    "1.png",
									TokenType: tokenImage,
								},
								&token{
									Width:     3,
									Height:    4,
									Source:    "url(#pattern_1)",
									TokenType: tokenPattern,
									TokenData: 1,
								},
							},
						},
					},
				},
			},
		},
		{ // 19
			Input: "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n<!DOCTYPE svg PUBLIC \"-//W3C//DTD SVG 20010904//EN\" \"http://www.w3.org/TR/2001/REC-SVG-20010904/DTD/svg10.dtd\"><svg xmlns=\"http://www.w3.org/2000/svg\" xmlns:xlink=\"http://www.w3.org/1999/xlink\" width=\"1\" height=\"2\" data-initiative=\"\"><defs></defs><g data-name=\"Light\"><rect width=\"100%\" height=\"100%\" fill=\"rgba(255, 0, 0, 0.500)\"></rect></g></svg>",
			Output: levelMap{
				Width:    1,
				Height:   2,
				Patterns: map[string]*pattern{},
				Masks:    map[string]*mask{},
				layers: map[string]struct{}{
					"Light": struct{}{},
				},
				layer: layer{
					IsFolder: true,
					Layers: []*layer{
						&layer{
							Name: "Light",
							Tokens: []*token{
								&token{
									Source: "rgba(255, 0, 0, 0.500)",
								},
							},
						},
					},
				},
			},
		},
		{ // 20
			Input: "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n<!DOCTYPE svg PUBLIC \"-//W3C//DTD SVG 20010904//EN\" \"http://www.w3.org/TR/2001/REC-SVG-20010904/DTD/svg10.dtd\"><svg xmlns=\"http://www.w3.org/2000/svg\" xmlns:xlink=\"http://www.w3.org/1999/xlink\" width=\"1\" height=\"2\" data-initiative=\"\"><defs></defs><g data-name=\"Grid\"><rect width=\"100%\" height=\"100%\" fill=\"url(#gridPattern)\"></rect></g></svg>",
			Output: levelMap{
				Width:    1,
				Height:   2,
				Patterns: map[string]*pattern{},
				Masks:    map[string]*mask{},
				layers: map[string]struct{}{
					"Grid": struct{}{},
				},
				layer: layer{
					IsFolder: true,
					Layers: []*layer{
						&layer{
							Name: "Grid",
						},
					},
				},
			},
		},
	} {
		var m levelMap
		_, err := m.ReadFrom(strings.NewReader(test.Input))
		if test.Err != nil {
			if test.Err != err {
				t.Errorf("test %d: expecting error %q, got %q", n+1, test.Err, err)
			}
		} else if err != nil {
			t.Errorf("test %d: unexpected error: %s", n+1, err)
		} else if !reflect.DeepEqual(test.Output, m) {
			t.Errorf("test %d: got unexpected output", n+1)
		} else {
			m.WriteTo(&buf)
			if string(buf) != test.Input {
				t.Errorf("test %d: expecting output %q, got %q", n+1, test.Input, buf)
			}
			buf = buf[:0]
		}
	}
}
