package battlemap

import (
	"compress/gzip"
	"io"

	"vimagination.zapto.org/byteio"
)

type musicTrack struct {
	AssetID uint64
	Volume  uint32
	Repeat  int32
}

type musicPack struct {
	Tracks   []musicTrack
	Repeat   uint64
	PlayTime uint64
	Playing  bool
}

func (m *musicPack) WriteTo(w io.Writer) (int64, error) {
	g, err := gzip.NewWriterLevel(w, gzip.BestCompression)
	if err != nil {
		return 0, err
	}
	bw := byteio.StickyLittleEndianWriter{Writer: g}
	bw.WriteUint64(uint64(len(m.Tracks)))
	for _, t := range m.Tracks {
		bw.WriteUint64(t.AssetID)
		bw.WriteUint32(t.Volume)
		bw.WriteInt32(t.Repeat)
	}
	bw.WriteUint64(m.Repeat)
	bw.WriteUint64(m.PlayTime)
	bw.WriteBool(m.Playing)
	g.Close()
	return bw.Count, bw.Err
}

type musicPacksDir struct {
	*Battlemap
}

func (m *musicPacksDir) Init(b *Battlemap) error {
	return nil
}

func (musicPacksDir) Cleanup() {}
