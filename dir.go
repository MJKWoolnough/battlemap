package main

import (
	"io"
	"io/ioutil"
	"os"
)

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
