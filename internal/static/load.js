"use strict";
const pageLoad = new Promise(successFn => window.addEventListener("load", successFn)),
      offer = obj => {
	      document.currentScript.dispatchEvent(new CustomEvent("executed", {"detail": obj}))
	      document.head.removeChild(document.currentScript);
      },
      include = (function() {
	const included = new Map();
	return function(url) {
		if (included.has(url)) {
			return included.get(url);
		}
		const css = url.substr(-3) === "css",
		      elm = document.createElement(css ? "link" : "script");
		elm.setAttribute(css ? "href" : "src", url);
		elm.setAttribute("type", css ? "text/css" : "text/javascript")
		if (css) {
			elm.setAttribute("rel", "stylesheet");
		}
		const p = new Promise((successFn, errorFn) => {
			if (css) {
				elm.addEventListener("onload", successFn);
			} else {
				elm.addEventListener("executed", e => successFn(e["detail"]));
			}
			elm.addEventListener("error", () => errorFn("error including: " + url));
			document.head.appendChild(elm);
		});
		included.set(url, p);
		return p;
	}
      }());
