package battlemap

import (
	"fmt"
	"net/http"
	"strings"

	"golang.org/x/net/websocket"
	"vimagination.zapto.org/httpdir"
	"vimagination.zapto.org/httpgzip"
)

type Battlemap struct {
	config     config
	socket     socket
	auth       Auth
	images     assetsDir
	sounds     assetsDir
	chars      keystoreDir
	tokens     keystoreDir
	userTokens userKeystoreDir
	maps       mapsDir
	masks      masksDir
	files      filesDir
	plugins    pluginsDir
	mux        http.ServeMux
}

func New(path string, auth Auth) (*Battlemap, error) {
	b := new(Battlemap)
	if err := b.initModules(path, auth); err != nil {
		return nil, err
	}
	b.initMux(httpdir.Default)
	return b, nil
}

func (b *Battlemap) initModules(path string, a Auth) error {
	if err := b.config.Init(path); err != nil {
		return fmt.Errorf("error loading Config: %w", err)
	}
	b.chars.Name = "Chars"
	b.chars.Socket = SocketCharacters
	b.tokens.Name = "Tokens"
	b.tokens.Socket = SocketMaps
	b.userTokens.Name = "UserTokens"
	b.userTokens.Socket = SocketMaps
	b.images.fileType = fileTypeImage
	b.sounds.fileType = fileTypeAudio
	if a == nil {
		a := new(auth)
		if err := a.Init(b); err != nil {
			return fmt.Errorf(moduleError, "auth", err)
		}
		b.auth = a
	} else {
		b.auth = a
	}
	for module, init := range map[string]interface{ Init(b *Battlemap) error }{
		"Socket":  &b.socket,
		"Images":  &b.images,
		"Sounds":  &b.sounds,
		"Tokens":  &b.tokens,
		"Chars":   &b.chars,
		"Maps":    &b.maps,
		"Masks":   &b.masks,
		"Files":   &b.files,
		"Plugins": &b.plugins,
	} {
		if err := init.Init(b); err != nil {
			return fmt.Errorf(moduleError, module, err)
		}
	}
	return nil
}

func (b *Battlemap) initMux(dir http.FileSystem) {
	b.mux.Handle("/socket", websocket.Handler(b.socket.ServeConn))
	b.mux.Handle("/login/", http.StripPrefix("/login", b.auth))
	for path, module := range map[string]Methods{
		"/images/":     &b.images,
		"/sounds/":     &b.sounds,
		"/tokens/":     &b.tokens,
		"/characters/": &b.chars,
		"/maps/":       &b.maps,
		"/masks/":      &b.masks,
		"/files/":      &b.files,
		"/plugins/":    &b.plugins,
	} {
		p := strings.TrimSuffix(path, "/")
		d := Dir{module}
		b.mux.Handle(path, http.StripPrefix(p, d))
		b.mux.Handle(p, http.StripPrefix(p, d))
	}
	b.mux.Handle("/", httpgzip.FileServer(dir))
}

func (b *Battlemap) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	b.mux.ServeHTTP(w, b.auth.Auth(r))
}

const moduleError = "error initialising %s module: %w"
