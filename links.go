package battlemap

import (
	"encoding/json"
	"strings"
)

type links struct {
	images, audio, chars, maps linkManager
}

func newLinks() links {
	return links{
		images: make(linkManager),
		audio:  make(linkManager),
		chars:  make(linkManager),
		maps:   make(linkManager),
	}
}

func (l *links) getLinkKey(key string) linkManager {
	if strings.HasPrefix(key, "store-image") {
		return l.images
	} else if strings.HasPrefix(key, "store-audio") {
		return l.audio
	} else if strings.HasPrefix(key, "store-character") {
		return l.chars
	}
	return nil
}

type linkManager map[uint64]struct{}

func (l linkManager) setLink(id uint64) {
	l[id] = struct{}{}
}

type tokenID struct {
	Source uint64 `json:"src"`
}

func (l linkManager) setJSONLinks(j json.RawMessage) {
	if len(j) > 0 {
		switch j[0] {
		case '[':
			var ids []uint64
			if err := json.Unmarshal(j, &ids); err == nil {
				for _, id := range ids {
					l.setLink(id)
				}
			} else {
				var ids []tokenID
				if err := json.Unmarshal(j, &ids); err == nil {
					for _, id := range ids {
						l.setLink(id.Source)
					}
				}
			}
		case '{':
			var id tokenID
			if err := json.Unmarshal(j, &id); err == nil {
				l.setLink(id.Source)
			} else {
				ids := make(map[string]uint64)
				if err := json.Unmarshal(j, &ids); err == nil {
					for _, id := range ids {
						l.setLink(id)
					}
				} else {
					ids := make(map[string]tokenID)
					if err := json.Unmarshal(j, &ids); err == nil {
						for _, id := range ids {
							l.setLink(id.Source)
						}
					}
				}
			}
		default:
			var id uint64
			if err := json.Unmarshal(j, &id); err == nil {
				l.setLink(id)
			}
		}
	}
}
