package main

import (
	"testing"

	"vimagination.zapto.org/keystore"
)

func TestConfig(t *testing.T) {
	var (
		port    keystore.Uint16
		testVar keystore.String
	)
	if err := Config.Get("ServerPort", &port); err != nil {
		t.Errorf("error retrieving server port: %s", err)
	} else if port != 8080 {
		t.Errorf("expecting server port 8080, got %d", port)
	} else if err = Config.Set("ServerPort", keystore.Uint16(1234)); err != nil {
		t.Errorf("error setting server port: %s", err)
	} else if err = Config.Get("ServerPort", &port); err != nil {
		t.Errorf("error retrieving new server port: %s", err)
	} else if port != 1234 {
		t.Errorf("expecting server port 1234, got %d", port)
	} else if err := Config.Set("testVar", keystore.String("Hello, World!")); err != nil {
		t.Errorf("error setting testVar: %s", err)
	} else if err := Config.Init(Config.BaseDir); err != nil {
		t.Errorf("error re-initing Config: %s", err)
	} else if err = Config.Get("ServerPort", &port); err != nil {
		t.Errorf("error retrieving new server port: %s", err)
	} else if port != 1234 {
		t.Errorf("expecting server port 1234, got %d", port)
	} else if err = Config.Get("testVar", &testVar); err != nil {
		t.Errorf("error retrieving testVar: %s", err)
	} else if testVar != "Hello, World!" {
		t.Errorf("expecting testVar \"Hello, World!\", got %q", testVar)
	}
}
