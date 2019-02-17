package main

import (
	"net/http"
	"path/filepath"
	"strings"

	"vimagination.zapto.org/errors"
	"vimagination.zapto.org/keystore"
)

type mapsDir struct {
	DefaultMethods

	store *keystore.FileStore
}

func (m *mapsDir) Init() error {
	var location keystore.String
	err := Config.Get("MapsDir", &location)
	if err != nil {
		return errors.WithContext("error getting map directory: ", err)
	}
	sp := filepath.Join(Config.BaseDir, string(location))
	m.store, err = keystore.NewFileStore(sp, sp, keystore.NoMangle)
	if err != nil {
		return errors.WithContext("error creating map store: ", err)
	}
	return nil
}

func (m *mapsDir) Options(w http.ResponseWriter, r *http.Request) {

}

type CurrentMap uint

func (c CurrentMap) RPC(method string, data []byte) (interface{}, error) {
	switch strings.TrimPrefix(method, "maps.") {
	case "getCurrentMap":
		return uint(c), nil
	}
	return nil, ErrUnknownMethod
}

var MapsDir mapsDir
