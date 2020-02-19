package battlemap

import (
	"fmt"
	"net/http"
	"strings"

	"golang.org/x/net/websocket"
	"vimagination.zapto.org/httpdir"
	"vimagination.zapto.org/httpgzip"
)

// Battlemap contains all of the data required for a battlemap system.
//
// This type implements the http.Handler interface so that it can be easily
// added to an existing server.
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

// New creates a new, initialise Battlemap type, using the given path as its
// datastore directory.
//
// The passed Auth module will be used for authenticating all users and setting
// Admin mode. If nil is passed then it will use the built in auth module,
// allowing all users as guests and allowing signing in as the Admin.
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
	b.tokens.Name = "Tokens"
	b.userTokens.Name = "UserTokens"
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
	for path, module := range map[string]http.Handler{
		"/login/":   b.auth,
		"/images/":  &b.images,
		"/audio/":   &b.sounds,
		"/maps/":    &b.maps,
		"/masks/":   &b.masks,
		"/files/":   &b.files,
		"/plugins/": &b.plugins,
	} {
		p := strings.TrimSuffix(path, "/")
		b.mux.Handle(path, http.StripPrefix(path, module))
		b.mux.Handle(p, http.StripPrefix(p, module))
	}
	b.mux.Handle("/", httpgzip.FileServer(dir))
}

func (b *Battlemap) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	b.mux.ServeHTTP(w, b.auth.Auth(r))
}

const moduleError = "error initialising %s module: %w"
