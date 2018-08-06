package main

import (
	"crypto/sha256"
	"database/sql"
	"io"
	"net/http"

	"vimagination.zapto.org/errors"
)

var Auth auth

type auth struct {
	passwordHash   string
	updatePassword *sql.Stmt
	http.ServeMux
}

func (a *auth) Init(db *sql.DB) error {
	err := db.QueryRow("SELECT [Password] FROM [Config];").Scan(&a.passwordHash)
	if err != nil {
		return errors.WithContext("error retrieving password hash: ", err)
	}
	a.updatePassword, err = db.Prepare("UPDATE [Config] SET [Password] = ?;")
	if err != nil {
		return errors.WithContext("error creating prepared statement: ", err)
	}
	return nil
}

func (a *auth) hash(password string) string {
	data := sha256.Sum256([]byte(password))
	return string(data[:])
}

func (a *auth) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	if r.URL.Path != "/" {
		a.ServeMux.ServeHTTP(w, r)
		return
	}
	r.ParseForm()
	if a.hash(r.PostFormValue("password")) == a.passwordHash {
		if n := r.PostFormValue("new"); n != "" {
			a.updatePassword.Exec(a.hash(n))
			Session.Refresh()
		}
		Session.SetAdmin(w)
		http.Redirect(w, r, "/map.html", http.StatusFound)
		return
	}
	io.WriteString(w, loginPage)
}

const loginPage = `<!doctype html>
<html lang="en">
	<head>
		<title>Login</title>
	</head>
	<body>
		<a href="map.html">Load Map</a>
		<form action="/" method="post">
			<label for="password">Password: </label><input id="password" name="password" type="password" /><br />
			<label for="new">New Password?: </label><input id="new" name="new" type="password" /><br />
			<input type="submit" value="Login" />
		</form>
	</body>
</html>`
