package battlemap

import (
	"fmt"
	"net/http"

	"golang.org/x/net/websocket"
	"vimagination.zapto.org/httpdir"
	"vimagination.zapto.org/httpgzip"
)

type Battlemap struct {
	config     config
	socket     socket
	auth       Auth
	assets     assetsDir
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
		"Assets":  &b.assets,
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
	b.mux.Handle("/login", b.auth)
	b.mux.Handle("/assets", http.StripPrefix("/assets", Dir{&b.assets}))
	b.mux.Handle("/tokens", http.StripPrefix("/tokens", Dir{&b.tokens}))
	b.mux.Handle("/characters", http.StripPrefix("/characters", Dir{&b.chars}))
	b.mux.Handle("/maps", http.StripPrefix("/maps", Dir{&b.maps}))
	b.mux.Handle("/masks", http.StripPrefix("/masks", Dir{&b.masks}))
	b.mux.Handle("/files", http.StripPrefix("/files", Dir{&b.files}))
	b.mux.Handle("/plugins", http.StripPrefix("/plugins", Dir{&b.plugins}))
	b.mux.Handle("/", httpgzip.FileServer(dir))
}

func (b *Battlemap) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	b.mux.ServeHTTP(w, b.auth.Auth(r))
}

const moduleError = "error initialising %s module: %w"
