package battlemap

import (
	"bytes"
	"crypto/rand"
	"crypto/sha256"
	"encoding/json"
	"hash"
	"io"
	"net/http"
	"sync"
	"time"

	"golang.org/x/net/websocket"
	"vimagination.zapto.org/errors"
	"vimagination.zapto.org/httpaccept"
	"vimagination.zapto.org/memio"
	"vimagination.zapto.org/sessions"
)

type Auth interface {
	http.Handler
	Auth(*http.Request) *http.Request
	AuthConn(*websocket.Conn) AuthConn
	IsAdmin(*http.Request) bool
}

type auth struct {
	*Battlemap
	store *sessions.CookieStore

	mu                                  sync.RWMutex
	passwordSalt, password, sessionData memio.Buffer
}

func (a *auth) Init(b *Battlemap) error {
	var save bool

	salt := make(memio.Buffer, 0, 16)
	password := make(memio.Buffer, 0, sha256.Size)
	b.config.Get("passwordSalt", &salt)
	b.config.Get("password", &password)
	if len(salt) == 0 {
		salt = salt[:16]
		rand.Read(salt)
		password = hashPass(password, salt)
		save = true
	} else if len(password) == 0 {
		password = hashPass(nil, salt)
	}

	sessionKey := make(memio.Buffer, 0, 16)
	b.config.Get("sessionKey", &sessionKey)
	if len(sessionKey) != 16 {
		sessionKey = sessionKey[:16]
		rand.Read(sessionKey)
		save = true
	}
	sessionData := make(memio.Buffer, 0, 32)
	b.config.Get("sessionData", &sessionData)
	if len(sessionData) < 16 {
		sessionData = sessionData[:32]
		rand.Read(sessionData)
		save = true
	}
	var err error
	a.store, err = sessions.NewCookieStore(sessionKey, sessions.HTTPOnly(), sessions.Path("/"), sessions.Name("admin"), sessions.Expiry(time.Hour*24*30))
	if err != nil {
		return errors.WithContext("error creating Cookie Store: ", err)
	}
	a.passwordSalt = salt
	a.password = password
	a.sessionData = sessionData
	if save {
		if err = b.config.SetAll(map[string]io.WriterTo{
			"passwordSalt": &salt,
			"password":     &password,
			"sessionKey":   &sessionKey,
			"sessionData":  &sessionData,
		}); err != nil {
			return errors.WithContext("error setting auth config: ", err)
		}
	}
	a.Battlemap = b
	return nil
}

func (a *auth) IsAdmin(r *http.Request) bool {
	rData := a.store.Get(r)
	a.mu.RLock()
	isAdmin := bytes.Equal(rData, a.sessionData)
	a.mu.RUnlock()
	return isAdmin
}

func (a *auth) Auth(r *http.Request) *http.Request { return r }

func (a *auth) Logout(w http.ResponseWriter, r *http.Request) {
	a.store.Set(w, nil)
	var at AcceptType
	httpaccept.HandleAccept(r, &at)
	switch at {
	case "json":
		w.Header().Set(contentType, "application/json")
		io.WriteString(w, "{\"admin\": false}")
	case "xml":
		w.Header().Set(contentType, "text/xml")
		io.WriteString(w, "<admin>false</admin>")
	case "txt":
		w.Header().Set(contentType, "text/plain")
		io.WriteString(w, "logged out")
	case "form":
		w.Header().Set(contentType, "application/x-www-form-urlencoded")
		io.WriteString(w, "admin=false")
	}
}

func (a *auth) UpdatePassword(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		w.WriteHeader(http.StatusMethodNotAllowed)
		return
	}
	if !a.IsAdmin(r) {
		http.Error(w, http.StatusText(http.StatusForbidden), http.StatusForbidden)
		return
	}
	r.ParseForm()
	password := r.PostFormValue(passwordField)
	confirm := r.PostFormValue("confirmPassword")
	var at AcceptType
	httpaccept.HandleAccept(r, &at)
	if password != confirm {
		w.WriteHeader(http.StatusBadRequest)
		switch at {
		case "json":
			w.Header().Set(contentType, "application/json")
			io.WriteString(w, "{\"updated\": false}")
		case "xml":
			w.Header().Set(contentType, "text/xml")
			io.WriteString(w, "<updated>false</login>")
		case "txt":
			w.Header().Set(contentType, "text/plain")
			io.WriteString(w, "passwords don't match")
		case "form":
			w.Header().Set(contentType, "application/x-www-form-urlencoded")
			io.WriteString(w, "updated=false")
		}
		return
	}
	a.store.Set(w, a.UpdatePasswordGetData(password, SocketIDFromRequest(r)))
	switch at {
	case "json":
		w.Header().Set(contentType, "application/json")
		io.WriteString(w, "{\"updated\": true}")
	case "xml":
		w.Header().Set(contentType, "text/xml")
		io.WriteString(w, "<updated>true</login>")
	case "txt":
		w.Header().Set(contentType, "text/plain")
		io.WriteString(w, "password updated")
	case "form":
		w.Header().Set(contentType, "application/x-www-form-urlencoded")
		io.WriteString(w, "<updated>true</login>")
	default:
		http.Redirect(w, r, "/", http.StatusSeeOther)
	}
}

func (a *auth) UpdatePasswordGetData(newPassword string, id ID) []byte {
	a.mu.Lock()
	a.password = hashPass([]byte(newPassword), a.passwordSalt)
	password := a.password
	rand.Read(a.sessionData)
	data := a.sessionData
	a.mu.Unlock()
	d := data
	a.config.SetAll(map[string]io.WriterTo{
		"password":    &password,
		"sessionData": &d,
	})
	a.socket.KickAdmins(id)
	return data
}

func (a *auth) Login(w http.ResponseWriter, r *http.Request) {
	r.ParseForm()
	var password string
	if _, ok := r.PostForm[passwordField]; ok {
		password = r.PostFormValue(passwordField)
	} else {
		_, password, _ = r.BasicAuth()
	}
	var at AcceptType
	httpaccept.HandleAccept(r, &at)
	if sessionData := a.login(password); len(sessionData) > 0 {
		a.store.Set(w, sessionData)
		switch at {
		case "json":
			w.Header().Set(contentType, "application/json")
			io.WriteString(w, "{\"admin\": true}")
		case "xml":
			w.Header().Set(contentType, "text/xml")
			io.WriteString(w, "<admin>true</admin>")
		case "txt":
			w.Header().Set(contentType, "text/plain")
			io.WriteString(w, "logged in")
		case "form":
			w.Header().Set(contentType, "application/x-www-form-urlencoded")
			io.WriteString(w, "admin=true")
		default:
			http.Redirect(w, r, "/", http.StatusSeeOther)
		}
		return
	}
	w.Header().Set("WWW-Authenticate", "Basic realm=\"Battlemap\"")
	var content string
	switch at {
	case "json":
		w.Header().Set(contentType, "application/json")
		content = "{\"admin\": false}"
	case "xml":
		w.Header().Set(contentType, "text/xml")
		content = "<admin>false</admin>"
	case "txt":
		w.Header().Set(contentType, "text/plain")
		content = "logged out"
	case "form":
		w.Header().Set(contentType, "application/x-www-form-urlencoded")
		content = "admin=false"
	}
	w.WriteHeader(http.StatusUnauthorized)
	io.WriteString(w, content)
}

func (a *auth) LoggedIn(w http.ResponseWriter, r *http.Request) {
	if a.IsAdmin(r) {
		a.mu.RLock()
		sessionData := a.sessionData
		a.mu.RUnlock()
		a.store.Set(w, sessionData)
		io.WriteString(w, "true")
	} else {
		io.WriteString(w, "false")
	}
}

func (a *auth) login(password string) []byte {
	var toRet []byte
	a.mu.RLock()
	if bytes.Equal(a.password, hashPass([]byte(password), a.passwordSalt)) {
		toRet = a.sessionData
	}
	a.mu.RUnlock()
	return toRet
}

func (a *auth) LoginGetData(password string) string {
	sessionData := a.login(password)
	if len(sessionData) == 0 {
		return ""
	}
	pw := make([]string, 0, 1)
	a.store.Set(psuedoHeaders{"Set-Cookie": pw}, sessionData)
	return pw[0]
}

func (a *auth) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	switch r.URL.Path {
	case "/update":
		a.UpdatePassword(w, r)
	case "/logout":
		a.Logout(w, r)
	case "/login":
		a.Login(w, r)
	case "/loggedin":
		a.LoggedIn(w, r)
	default:
		http.NotFound(w, r)
	}
}

var (
	loggedOut = []byte("{\"id\": -1, \"result\": 0}")
	loggedIn  = []byte("{\"id\": -1, \"result\": 1}")
)

func (a *auth) AuthConn(w *websocket.Conn) AuthConn {
	c := &authConn{
		auth: a,
	}
	if a.IsAdmin(w.Request()) {
		w.Write(loggedIn)
		c.admin = true
	} else {
		w.Write(loggedOut)
	}
	return c
}

type authConn struct {
	*auth

	mu    sync.RWMutex
	admin bool
}

func (a *authConn) IsAdmin() bool {
	a.mu.RLock()
	admin := a.admin
	a.mu.RUnlock()
	return admin
}

func (a *authConn) RPCData(cd ConnData, submethod string, data []byte) (interface{}, error) {
	if a.IsAdmin() {
		switch submethod {
		case "loggedIn":
			return true, nil
		case "logout":
			a.mu.Lock()
			a.admin = false
			a.mu.Unlock()
			return nil, nil
		case "changePassword":
			var password string
			json.Unmarshal(data, &password)
			sessionData := a.UpdatePasswordGetData(password, cd.ID)
			return sessionData, nil
		}
	} else {
		switch submethod {
		case "loggedIn":
			return false, nil
		case "login":
			var password string
			json.Unmarshal(data, &password)
			sessionData := a.LoginGetData(password)
			if len(sessionData) == 0 {
				return nil, ErrInvalidPassword
			}
			a.mu.Lock()
			a.admin = true
			a.mu.Unlock()
			return sessionData, nil
		case "requirements":
			return req, nil
		}
	}
	return nil, ErrUnknownMethod
}

var req = []string{"password"}

type psuedoHeaders http.Header

func (psuedoHeaders) Write([]byte) (int, error) { return 0, nil }
func (psuedoHeaders) WriteHeader(int)           {}
func (p psuedoHeaders) Header() http.Header     { return http.Header(p) }

var hashPool = sync.Pool{
	New: func() interface{} {
		return sha256.New()
	},
}

func hashPass(password, salt []byte) []byte {
	h := hashPool.Get().(hash.Hash)
	h.Write(password)
	h.Write(salt)
	res := h.Sum(make([]byte, 0, sha256.Size))
	h.Reset()
	hashPool.Put(h)
	return res
}

const (
	passwordField = "password"
	contentType   = "Content-Type"
	jsonType      = "application/json"
)
