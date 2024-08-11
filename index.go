package battlemap

import (
	_ "embed" // required for index embed
	"time"

	"vimagination.zapto.org/httpembed"
)

var (
	//go:embed index.gz
	indexData []byte
	index     = httpembed.HandleBuffer("index.html", indexData, 263480, time.Unix(1722623981, 0))
)
