package main

import (
	"io"

	"vimagination.zapto.org/errors"
	"vimagination.zapto.org/keystore"
)

type config struct {
	BaseDir   string
	memStore  *keystore.MemStore
	fileStore *keystore.FileStore
	/*
		CurrentUserMap uint
		Password, Salt, SessionKey, SessionData           []byte
		ServerPort                                        uint16
		AssetsDir, CharsDir, MapsDir, FilesDir, PluginDir string
	*/
}

const configFile = "config"

func (c *config) Init(baseDir string) error {
	c.BaseDir = baseDir
	c.memStore = keystore.NewMemStore()
	c.memStore.SetAll(map[string]io.WriterTo{
		"ServerPort": keystore.Uint16(8080),
		"AssetsDir":  keystore.String("./assets"),
		"CharsDir":   keystore.String("./characters"),
		"MapsDir":    keystore.String("./maps"),
		"FilesDir":   keystore.String("./files"),
		"PluginsDir": keystore.String("./plugins"),
	})
	var err error
	c.fileStore, err = keystore.NewFileStore(baseDir, baseDir, keystore.NoMangle)
	if err != nil {
		return errors.WithContext("error creating config store: ", err)
	}
	err = c.fileStore.Get(configFile, c.memStore)
	if err != nil && err != keystore.ErrUnknownKey {
		return errors.WithContext("error parsing config data: ", err)
	}
	return nil
}

func (c *config) Get(key string, data io.ReaderFrom) error {
	return c.memStore.Get(key, data)
}

func (c *config) Set(key string, data io.WriterTo) error {
	if err := c.memStore.Set(key, data); err != nil {
		return err
	}
	return c.fileStore.Set(configFile, c.memStore)
}

func (c *config) SetAll(data map[string]io.WriterTo) error {
	if err := c.memStore.SetAll(data); err != nil {
		return err
	}
	return c.fileStore.Set(configFile, c.memStore)
}

var Config config
