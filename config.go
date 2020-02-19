package battlemap

import (
	"fmt"
	"io"

	"vimagination.zapto.org/keystore"
)

type config struct {
	BaseDir   string
	memStore  *keystore.MemStore
	fileStore *keystore.FileStore
}

const configFile = "config"

func (c *config) Init(baseDir string) error {
	c.BaseDir = baseDir
	c.memStore = keystore.NewMemStore()
	c.memStore.SetAll(map[string]io.WriterTo{
		"ServerPort":     keystore.Uint16(8080),
		"ImageAssetsDir": keystore.String("assets/images"),
		"AudioAssetsDir": keystore.String("assets/audio"),
		"CharsDir":       keystore.String("characters"),
		"MasksDir":       keystore.String("masks"),
		"MapsDir":        keystore.String("maps"),
		"FilesDir":       keystore.String("files"),
		"PluginsDir":     keystore.String("plugins"),
		"TokensDir":      keystore.String("tokens"),
	})
	var err error
	c.fileStore, err = keystore.NewFileStore(baseDir, baseDir, keystore.NoMangle)
	if err != nil {
		return fmt.Errorf("error creating config store: %w", err)
	}
	err = c.fileStore.Get(configFile, c.memStore)
	if err != nil && err != keystore.ErrUnknownKey {
		return fmt.Errorf("error parsing config data: %w", err)
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
