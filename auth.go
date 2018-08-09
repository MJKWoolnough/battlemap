package main

import (
	"crypto/rand"
	"crypto/sha256"
	"database/sql"
	"html/template"
	"io"
	"net/http"
	"strings"

	"vimagination.zapto.org/errors"
	"vimagination.zapto.org/httpdir"
)

var Auth auth

type auth struct {
	password, salt string
	login          *template.Template
	updatePassword *sql.Stmt
	http.ServeMux
}

func (a *auth) init(db *sql.DB) error {
	err := db.QueryRow("SELECT [Password], [Salt] FROM [Config];").Scan(&a.passwordHash, &a.salt)
	if err != nil {
		return errors.WithContext("error retrieving password hash: ", err)
	}
	a.updatePassword, err = db.Prepare("UPDATE [Config] SET [Password] = ?;")
	if err != nil {
		return errors.WithContext("error creating prepared statement: ", err)
	}
	if a.salt == "" {
		var buf [16]byte
		rand.Read(buf[:])
		a.salt = string(buf[:])
		if _, err := db.Exec("UPDATE [Config] SET [Salt] = ?;", a.salt); err != nil {
			return errors.WithContext("error inserting Salt into database: ", err)
		}
	}
	if a.password == "" {
		a.password = a.hash("")
	}
	f, err := httpdir.Default.Open("login.tmpl")
	if err != nil {
		return errors.WithContext("error opening login template: ", err)
	}
	var sb strings.Builder
	if st, err := f.Stat(); err != nil {
		return errors.WithContext("error getting login template size: ", err)
	} else {
		sb.Grow(int(st.Size()))
	}
	_, err = io.Copy(sb, f)
	if err != nil {
		return errors.WithContext("error reading login template: ", err)
	}
	f.Close()
	a.login, err = template.New("login").Parse(sb.String())
	if err != nil {
		return errors.WithContext("error parsing login template: ", err)
	}
	return nil
}

func (a *auth) hash(password string) string {
	data := sha256.Sum256([]byte(password + a.salt))
	return string(data[:])
}

func (a *auth) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	if r.URL.Path != "/" {
		a.ServeMux.ServeHTTP(w, r)
		return
	}
	r.ParseForm()
	var vars struct {
		InvalidPassword, PasswordChanged bool
	}
	if _, ok := r.PostForm["submit"]; ok {
		if a.hash(r.PostFormValue("password")) == a.password {
			if n := r.PostFormValue("new"); r.PostFormValue("change") == "change" && n == r.PostFormValue("confirm") {
				a.passwordHash = a.hash(n)
				DB.Lock()
				a.updatePassword.Exec(a.passwordHash)
				DB.Unlock()
				Session.Refresh()
				vars.PasswordChanged = true
			} else {
				Session.SetAdmin(w)
				http.Redirect(w, r, "/map.html", http.StatusFound)
				return
			}
		} else {
			vars.InvalidPassword = true
		}
	}
	a.login.Execute(w, &vars)
}
