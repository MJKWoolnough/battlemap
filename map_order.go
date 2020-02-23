package battlemap

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
