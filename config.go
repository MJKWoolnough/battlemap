package main

import (
	"encoding/json"
	"fmt"
	"os"
	"sync"

	"vimagination.zapto.org/errors"
)

type userConfig struct {
	CurrentUserMap uint `json:"currentUserMap"`
}

type adminConfig struct {
	userConfig
	CurrentAdminMap uint `json:"currentAdminMap"`
}

type config struct {
	sync.RWMutex `json:"-"`

	adminConfig
	Password    []byte `json:"password"`
	Salt        []byte `json:"salt"`
	SessionKey  []byte `json:"sessionKey"`
	SessionData []byte `json:"sessionData"`
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
