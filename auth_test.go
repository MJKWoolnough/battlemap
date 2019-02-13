package main

import (
	"net/http"
	"net/http/cookiejar"
	"net/url"
	"testing"
)

func TestAuthHTTP(t *testing.T) {
	c := srv.Client()
	c.Jar, _ = cookiejar.New(nil)
	c.CheckRedirect = func(*http.Request, []*http.Request) error { return http.ErrUseLastResponse }
	if resp, err := c.Get(srv.URL + "/login/loggedin"); err != nil {
		t.Errorf("unexpected error getting logged in status: %s", err)
	} else if resp.StatusCode != http.StatusUnauthorized {
		t.Errorf("expecting status %s, got %s", http.StatusText(http.StatusUnauthorized), http.StatusText(resp.StatusCode))
	} else if resp, err = c.PostForm(srv.URL+"/login/login", url.Values{"password": []string{"notThePassword"}}); err != nil {
		t.Errorf("unexpected error failing to log in: %s", err)
	} else if resp.StatusCode != http.StatusUnauthorized {
		t.Errorf("expecting %s, got %s", http.StatusText(http.StatusUnauthorized), http.StatusText(resp.StatusCode))
	} else if resp, err = c.PostForm(srv.URL+"/login/update", url.Values{"password": []string{"newPassword"}, "confirmPassword": []string{"newPassword"}}); err != nil {
		t.Errorf("unexpected error failing to change password: %s", err)
	} else if resp.StatusCode != http.StatusUnauthorized {
		t.Errorf("expecting status %s, got %s", http.StatusText(http.StatusUnauthorized), http.StatusText(resp.StatusCode))
	} else if resp, err = c.PostForm(srv.URL+"/login/login", url.Values{"password": []string{""}}); err != nil {
		t.Errorf("unexpected error logging in: %s", err)
	} else if resp.StatusCode != http.StatusSeeOther {
		t.Errorf("expecting %s, got %s", http.StatusText(http.StatusSeeOther), http.StatusText(resp.StatusCode))
	} else if resp, err = c.Get(srv.URL + "/login/loggedin"); err != nil {
		t.Errorf("unexpected error getting logged in status: %s", err)
	} else if resp.StatusCode != http.StatusOK {
		t.Errorf("expecting status %s, got %s", http.StatusText(http.StatusOK), http.StatusText(resp.StatusCode))
	} else if resp, err = c.PostForm(srv.URL+"/login/update", url.Values{"password": []string{"newPassword"}, "confirmPassword": []string{"newPassword"}}); err != nil {
		t.Errorf("unexpected error failing to change password: %s", err)
	} else if resp.StatusCode != http.StatusSeeOther {
		t.Errorf("expecting status %s, got %s", http.StatusText(http.StatusSeeOther), http.StatusText(resp.StatusCode))
	} else if resp, err = c.Get(srv.URL + "/login/loggedin"); err != nil {
		t.Errorf("unexpected error getting logged in status: %s", err)
	} else if resp.StatusCode != http.StatusOK {
		t.Errorf("expecting status %s, got %s", http.StatusText(http.StatusOK), http.StatusText(resp.StatusCode))
	} else if resp, err = c.Get(srv.URL + "/login/logout"); err != nil {
		t.Errorf("unexpected error logging out: %s", err)
	} else if resp.StatusCode != http.StatusOK {
		t.Errorf("expecting status %s, got %s", http.StatusText(http.StatusOK), http.StatusText(resp.StatusCode))
	} else if resp, err = c.Get(srv.URL + "/login/loggedin"); err != nil {
		t.Errorf("unexpected error getting logged in status: %s", err)
	} else if resp.StatusCode != http.StatusUnauthorized {
		t.Errorf("expecting status %s, got %s", http.StatusText(http.StatusUnauthorized), http.StatusText(resp.StatusCode))
	} else if resp, err = c.PostForm(srv.URL+"/login/login", url.Values{"password": []string{""}}); err != nil {
		t.Errorf("unexpected error failing to log in: %s", err)
	} else if resp.StatusCode != http.StatusUnauthorized {
		t.Errorf("expecting %s, got %s", http.StatusText(http.StatusUnauthorized), http.StatusText(resp.StatusCode))
	} else if resp, err = c.PostForm(srv.URL+"/login/login", url.Values{"password": []string{"newPassword"}}); err != nil {
		t.Errorf("unexpected error logging in: %s", err)
	} else if resp.StatusCode != http.StatusSeeOther {
		t.Errorf("expecting %s, got %s", http.StatusText(http.StatusSeeOther), http.StatusText(resp.StatusCode))
	} else if resp, err = c.PostForm(srv.URL+"/login/update", url.Values{"password": []string{""}, "confirmPassword": []string{""}}); err != nil {
		t.Errorf("unexpected error failing to change password: %s", err)
	} else if resp.StatusCode != http.StatusSeeOther {
		t.Errorf("expecting status %s, got %s", http.StatusText(http.StatusSeeOther), http.StatusText(resp.StatusCode))
	}
}
