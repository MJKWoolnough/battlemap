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
	AssetsDir, CharsDir, MapsDir, FilesDir  string
}

func LoadConfig(filename string) error {
	Config.Lock()
	defer Config.Unlock()
	f, err := os.Open(filename)
	if err != nil {
		if os.IsNotExist(err) {
			return nil
		}
		return errors.WithContext(fmt.Sprintf("error opening config file (%q): ", filename), err)
	}
	err = json.NewDecoder(f).Decode(Config)
	f.Close()
	if err != nil {
		return errors.WithContext(fmt.Sprintf("error decoding config file (%q): ", filename), err)
	}
	if Config.ServerPort == "" {
		Config.ServerPort = 8080
	}
	if Config.AssetsDir == "" {
		Config.AssetsDir = "./assets"
	}
	if Config.CharsDir == "" {
		Config.CharsDir = "./characters"
	}
	if Config.MapsDir == "" {
		Config.MapsDir = "./maps"
	}
	if Config.FilesDir == "" {
		Config.FilesDir = "./files"
	}
	return nil
}

func SaveConfig(filename string) error {
	Config.RLock()
	defer Config.RUnlock()
	f, err := os.Create(filename)
	if err != nil {
		return errors.WithContext(fmt.Sprintf("error creating config file (%q): ", filename), err)
	}
	err = json.NewEncoder(f).Encode(Config)
	if err == nil {
		err = f.Close()
	} else {
		f.Close()
	}
	if err != nil {
		return errors.WithContext(fmt.Sprintf("error writing config file (%q): ", filename), err)
	}
	return nil
}

var Config config
