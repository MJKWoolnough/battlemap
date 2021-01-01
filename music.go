package battlemap

import "time"

type musicTrack struct {
	AssetID uint64
	Volume  uint32
	Repeat  int32
}

type musicPack struct {
	Tracks   []musicTrack
	Repeat   uint64
	PlayTime time.Time
	Playing  bool
}

type musicPacksDir struct {
	*Battlemap
}

func (m *musicPacksDir) Init(b *Battlemap) error {
	return nil
}

func (musicPacksDir) Cleanup() {}
