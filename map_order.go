package main

import (
	"encoding/xml"
	"fmt"
	"sort"
	"strconv"

	"vimagination.zapto.org/memio"
)

type MapsOrder []*Map

func (m MapsOrder) Len() int {
	return len(m)
}

func (m MapsOrder) Less(i, j int) bool {
	return m[i].Order < m[j].Order
}

func (mo MapsOrder) Swap(i, j int) {
	m[i], m[j] = m[j], m[i]
}

func (m MapsOrder) Move(mp *Map, j int) MapsOrder {
	if j < 0 || j >= len(m) {
		return nil
	}
	i := sort.Search(len(m), func(i int) bool {
		return m[i].Order >= mp.Order
	})
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

func (m MapsOrder) Fix() {
	for n, mp := range m {
		m.Order = uint64(n) + 1
	}
}

func (m MapsOrder) MarshalXML(e *xml.Encoder, s xml.StartElement) error {
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

func (m MapsOrder) MarshalText() ([]byte, error) {
	var buf memio.Buffer
	for _, m := range m {
		fmt.Fprintf(&buf, "%d:%q", m.ID, m.Name)
	}
	return buf, nil
}
