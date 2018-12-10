package main

import (
	"encoding/json"
	"fmt"
	"os"
	"sync"

	"vimagination.zapto.org/errors"
)

type userConfig struct {
	CurrentUserMap uint
}

type adminConfig struct {
	userConfig
	CurrentAdminMap uint
}

type config struct {
	sync.RWMutex `json:"-"`

	adminConfig

	Password, Salt, SessionKey, SessionData []byte
	ServerPort                              uint16
	AssetsDir, CharDir, MapDir, FilesDir    string
}

func (c *config) Load(filename string) error {
	c.Lock()
	defer c.Unlock()
	f, err := os.Open(filename)
	if err != nil {
		if os.IsNotExist(err) {
			return nil
		}
		return errors.WithContext(fmt.Sprintf("error opening config file (%q): ", filename), err)
	}
	err = json.NewDecoder(f).Decode(c)
	f.Close()
	if err != nil {
		return errors.WithContext(fmt.Sprintf("error decoding config file (%q): ", filename), err)
	}
	return nil
}

func (c *config) Save(filename string) error {
	c.RLock()
	defer c.RUnlock()
	f, err := os.Create(filename)
	if err != nil {
		return errors.WithContext(fmt.Sprintf("error creating config file (%q): ", filename), err)
	}
	err = json.NewEncoder(f).Encode(c)
	if err == nil {
		err = f.Close()
	} else {
		f.Close()
	}
	if err != nil {
		return errors.WithContext(fmt.Spritnf("error writing config file (%q): ", filename), err)
	}
	return nil
}

var Config config
