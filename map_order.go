package battlemap

import (
	"encoding/xml"
	"sort"
	"strconv"
)

type maps []*levelMap

func (m maps) Len() int {
	return len(m)
}

func (m maps) Less(i, j int) bool {
	return m[i].Order < m[j].Order
}

func (m maps) Swap(i, j int) {
	m[i], m[j] = m[j], m[i]
}

func (m maps) Move(mp *levelMap, j int) maps {
	if j < 0 || j >= len(m) {
		return nil
	}
	i := m.getPos(mp)
	if i >= len(m) || i == j {
		return nil
	}
	if i < j {
		copy(m[i:j-1], m[i+1:j])
		m[j] = mp
		if j == len(m)-1 {
			mp.Order = m[j-1].Order + 1
			return m[j:]
		}
		mp.Order = m[j+1].Order - 1
		least := j - 1
		for order := mp.Order - 1; m[least].Order > order; order, least = order-1, least-1 {
			m[least].Order = order
		}
		return m[least : j+1]
	}
	copy(m[j+1:i], m[j:i-1])
	m[j] = mp
	if j == 0 {
		mp.Order = m[1].Order - 1
		return m[:1]
	}
	mp.Order = m[j-1].Order + 1
	most := j + 1
	for order := mp.Order + 1; m[most].Order <= order; order, most = order+1, most+1 {
		m[most].Order = order
	}
	return m[j:most]
}

func (m *maps) Remove(mp *levelMap) {
	i := m.getPos(mp)
	if i >= len(*m) {
		return
	}
	copy((*m)[i:], (*m)[i+1:])
	(*m)[len(*m)-1] = nil
	*m = (*m)[:len(*m)-1]
}

func (m maps) getPos(mp *levelMap) int {
	return sort.Search(len(m), func(i int) bool {
		return m[i].Order >= mp.Order
	})
}

func (m maps) Fix() {
	for n, mp := range m {
		mp.Order = int64(n) + 1
	}
}

func (m maps) MarshalXML(e *xml.Encoder, s xml.StartElement) error {
	s.Attr = []xml.Attr{
		{Name: xml.Name{Local: "id"}},
	}
	se := s.End()
	for _, mp := range m {
		s.Attr[0].Value = strconv.FormatUint(mp.ID, 10)
		if err := e.EncodeToken(s); err != nil {
			return err
		}
		if err := e.EncodeToken(xml.CharData(mp.Name)); err != nil {
			return err
		}
		if err := e.EncodeToken(se); err != nil {
			return err
		}
	}
	return nil
}

type layers []*layer

func (l layers) Move(i, j int) {
	if i < 0 || i >= len(l) || j < 0 || j >= len(l) || i == j {
		return
	}
	e := l[i]
	if i < j {
		copy(l[i:j-1], l[i+1:j])
	} else {
		copy(l[j+1:i], l[j:i-1])
	}
	l[j] = e
}

func (l *layers) Remove(i int) {
	copy((*l)[i:], (*l)[i+1:])
	(*l)[len(*l)-1] = nil
	*l = (*l)[:len(*l)-1]
}

type tokens []*token

func (t tokens) Move(i, j int) {
	if i < 0 || i >= len(t) || j < 0 || j >= len(t) || i == j {
		return
	}
	e := t[i]
	if i < j {
		copy(t[i:j-1], t[i+1:j])
	} else {
		copy(t[j+1:i], t[j:i-1])
	}
	t[j] = e
}

func (t *tokens) Remove(i int) {
	copy((*t)[i:], (*t)[i+1:])
	(*t)[len(*t)-1] = nil
	*t = (*t)[:len(*t)-1]
}

func (p *patterns) Remove(id string) string {
	for n, pt := range *p {
		if pt.ID == id {
			copy((*p)[n:], (*p)[n+1:])
			(*p)[len(*p)-1] = pattern{}
			*p = (*p)[:len(*p)-1]
			if pt.Image != nil {
				return pt.Image.Source
			}
			break
		}
	}
	return ""
}
