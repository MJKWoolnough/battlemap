package battlemap // import "vimagination.zapto.org/battlemap"

import (
	"fmt"
	"net/http"
	"strings"

	"golang.org/x/net/websocket"
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
	audio      assetsDir
	musicPacks musicPacksDir
	chars      charactersDir
	maps       mapsDir
	plugins    pluginsDir
	mux        http.ServeMux
}

// New creates a new, initialised Battlemap type, using the given path as its
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

	b.initMux(index)

	return b, nil
}

func (b *Battlemap) initModules(path string, a Auth) error {
	if err := b.config.Init(path); err != nil {
		return fmt.Errorf("error loading Config: %w", err)
	}

	b.images.fileType = fileTypeImage
	b.audio.fileType = fileTypeAudio

	if a == nil {
		a := new(auth)

		if err := a.Init(b); err != nil {
			return fmt.Errorf(moduleError, "auth", err)
		}

		b.auth = a
	} else {
		b.auth = a
	}

	l := newLinks()

	for _, m := range [...]struct {
		Name   string
		Module interface {
			Init(b *Battlemap, l links) error
		}
	}{
		{"Socket", &b.socket},
		{"Audio", &b.audio},
		{"MusicPacks", &b.musicPacks},
		{"Images", &b.images},
		{"Chars", &b.chars},
		{"Maps", &b.maps},
		{"Plugins", &b.plugins},
	} {
		if err := m.Module.Init(b, l); err != nil {
			return fmt.Errorf(moduleError, m.Name, err)
		}
	}

	b.chars.cleanup(l.chars)
	b.images.cleanup(l.images)
	b.audio.cleanup(l.audio)
	b.musicPacks.cleanup(l.music)

	return nil
}

func (b *Battlemap) initMux(index http.Handler) {
	b.mux.Handle("/socket", websocket.Handler(b.socket.ServeConn))

	for path, module := range map[string]http.Handler{
		"/login/":   b.auth,
		"/images/":  &b.images,
		"/audio/":   &b.audio,
		"/plugins/": &b.plugins,
	} {
		p := strings.TrimSuffix(path, "/")

		b.mux.Handle(path, http.StripPrefix(path, module))
		b.mux.Handle(p, http.StripPrefix(p, module))
	}

	b.mux.Handle("/", index)
}

func (b *Battlemap) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	b.mux.ServeHTTP(w, b.auth.Auth(r))
}

const moduleError = "error initialising %s module: %w"
