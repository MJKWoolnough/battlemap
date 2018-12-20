package main

import (
	"io"
	"io/ioutil"
	"net/http"
	"os"
)

type Methods interface {
	Delete(http.ResponseWriter, *http.Request) bool
	Get(http.ResponseWriter, *http.Request) bool
	Options(http.ResponseWriter, *http.Request) bool
	Patch(http.ResponseWriter, *http.Request) bool
	Post(http.ResponseWriter, *http.Request) bool
	Put(http.ResponseWriter, *http.Request) bool
}

type DefaultMethods struct{}

func (DefaultMethods) Delete(http.ResponseWriter, *http.Request) bool { return false }
func (DefaultMethods) Get(http.ResponseWriter, *http.Request) bool    { return false }
func (DefaultMethods) Patch(http.ResponseWriter, *http.Request) bool  { return false }
func (DefaultMethods) Post(http.ResponseWriter, *http.Request) bool   { return false }
func (DefaultMethods) Put(http.ResponseWriter, *http.Request) bool    { return false }

type Dir struct {
	Methods
}

func (d Dir) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	var success bool
	switch r.Method {
	case http.MethodDelete:
		success = d.Methods.Delete(w, r)
	case http.MethodGet, http.MethodHead:
		success = d.Methods.Get(w, r)
	case http.MethodPatch:
		success = d.Methods.Patch(w, r)
	case http.MethodPost:
		success = d.Methods.Post(w, r)
	case http.MethodPut:
		success = d.Methods.Put(w, r)
	}
	if !success {
		w.WriteHeader(http.StatusMethodNotAllowed)
	}
}

func uploadFile(r io.Reader, location string) error {
	tf, err := ioutil.TempFile("", "battlemap-upload")
	if err != nil {
		return err
	}
	tfName := tf.Name()
	_, err = io.Copy(tf, r)
	if err == nil {
		err = tf.Close()
	} else {
		tf.Close()
	}
	if err != nil {
		os.Remove(tfName)
		return err
	}
	err = os.Rename(tfName, location)
	if err != nil {
		return err
	}
	return nil
}

func fileExists(filename string) bool {
	_, err := os.Stat(filename)
	return !os.IsNotExist(err)
}
