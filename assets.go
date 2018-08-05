package main

import "net/http"

var Assets assets

type assets struct {
}

func (a *assets) ServeHTTP(w http.ResponseWriter, r *http.Request) {

}
