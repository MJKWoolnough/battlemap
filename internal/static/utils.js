"use strict";
const createElements = function(namespace) {
	const childrenArr = function(elem, children) {
		if (typeof children === "string") {
			elem.textContent = children;
		} else if (children) {
			if (children.hasOwnProperty("length")) {
				Array.from(children).forEach(c => childrenArr(elem, c));
			} else if(children instanceof Node) {
				elem.appendChild(children);
			}
		}
	      };
	return function(element, properties, children) {
		const elem = typeof element === "string" ? document.createElementNS(namespace, element) : element;
		if (typeof properties === "string") {
			[properties, children] = [children, properties];
		}
		if (typeof properties === "object") {
			Object.keys(properties).forEach(k => {
				let prop = properties[k];
				if (prop !== undefined) {
					if (k.substr(0, 2) === "on" && typeof prop === "function") {
						elem.addEventListener(k.substr(2), prop.bind(elem));
					} else {
						elem.setAttribute(k, prop)
					}
				}
			});
		}
		childrenArr(elem, children);
		return elem;
	};
      },
      createHTML = createElements(document.getElementsByTagName("html")[0].namespaceURI),
      formatText = function(text) {
	const df = document.createDocumentFragment();
	text.split("\n").forEach((t, n) => {
		if (n > 0) {
			df.appendChild(creatHTML("br"));
		}
		df.appendChild(document.createTextNode(child));
	});
	return df;
      },
      clearElement = function(elem) {
	while (elem.hasChildNodes()) {
		elem.removeChild(elem.lastChild);
	}
      },
      layers = function(container) {
	const layers = [],
	      closer = function(closerFn) {
		if (layers.length === 0) {
			window.removeEventListener("keypress", kerPress);
			return;
		}
		clearElement(container);
		const elm = layers.pop();
		if (elm !== undefined) {
			container.appendChild(elm);
		}
		if (closerFn instanceof Function) {
			closerFn();
		}
	      },
	      keyPress = function(e) {
		e = e || window.event;
		if (e.keyCode === 27) {
			closer();
		}
	      };
	return Object.freeze({
		addLayer: closerFn => {
			if (layers.length === 0) {
				window.addEventListener("keypress", keyPress);
			}
			if (container.hasChildNodes()) {
				const df = document.createDocumentFragment();
				while (container.hasChildNodes()) {
					df.appendChild(container.firstChild);
				}
				layers.push(df);
			}
			return container.appendChild(createHTML(
				"div",
				{
					"onclick": closer
				},
				createHTML(
					"button",
					{},
					"X"
				)
			));
		},
		removeLayer: closer
	});
      },
      include = function(url, successFn, errorFn) {
	const css = url.substr(-3) === "css",
	      elm = css ? "link" : "script",
	      props = css ? {
		      "href": url,
		      "rel": "stylesheet",
		      "type": "text/css"
	      } : {
		      "src": url,
		      "type": "text/javascript"
	      };
	if (typeof successFn === "function") {
		props["onload"] = successFn;
	}
	if (typeof successFn === "function") {
		props["onerror"] = errorFn;
	}
	document.head.appendChild(createHTML(elm, props));
      },
      waitGroup = function(callback) {
	let state = 0;
	this.add = function(amount) {
		state += amount || 1;
	};
	this.done = function() {
		state--;
		if (state === 0) {
			callback();
		}
	};
      },
      RPC = function(path, onopen) {
	const request = function(callback, keep) {
		this.callback = callback;
		this.keep = keep;
	    },
	    requests = [],
	    ws = new WebSocket((window.location.protocol == "https:" ? "wss:" : "ws:") + "//" + window.location.host + path);
	let nextID = 0,
	    error = alert,
	    closed = false;
	ws.addEventListener("message", function(event) {
		const data = JSON.parse(event.data),
		    req = requests[data["id"]];
		if (typeof req === "undefined") {
			return;
		}
		if (!req.keep) {
			delete requests[data["id"]];
		}
		if (data["error"] !== undefined && data["error"] !== null) {
			error(data["error"]);
			return;
		}
		if (req.callback) {
			req.callback(data["result"]);
		}
	});
	ws.addEventListener("error", function(event) {
		document.body.textContent = "An Error Occurred!";
	});
	ws.addEventListener("close", function(event) {
		if (!closed) {
			switch (event.code) {
			case 1006:
				document.body.textContent = "The server unexpectedly closed the connection - this may be an error.";
				break;
			default:
				document.body.textContent = "Lost Connection To Server! Code: " + event.code;
			}
		}
	});
	if (typeof onopen === "function") {
		ws.addEventListener("open", onopen.bind(null, this));
	}
	window.addEventListener("beforeunload", function() {
		if (!closed) {
			closed = true;
			ws.close();
		}
	});
	this.errorFn = function(callback) {
		error = callback;
	};
	this.request = function(method, params, callback, keep) {
		const msg = {
			"method": method,
			"id": nextID,
			"params": [params]
		};
		requests[nextID] = new request(callback, keep);
		nextID++;
		ws.send(JSON.stringify(msg));
	};
	this.await = function(id, callback, keep) {
		requests[id] = new request(callback, keep);
		if (id >= nextID) {
			nextID = id + 1;
		}
	};
	this.close = function() {
		closed = true;
		ws.close();
	};
      };
