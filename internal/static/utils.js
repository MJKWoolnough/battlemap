"use strict";
const createElements = function(namespace) {
	const childrenArr = function(elem, children, pre) {
		if (typeof children === "string") {
			children.split("\n").forEach((child, n) => {
				if (n > 0 && !pre) {
					elem.appendChild(document.createElementNS(ns, "br"))
				}
				elem.appendChild(document.createTextNode(child));
			});
		} else if (children) {
			if (children.hasOwnProperty("length")) {
				Array.from(children).forEach(c => childrenArr(elem, c, pre));
			} else if(children instanceof Node) {
				elem.appendChild(children);
			}
		}
	      };
	return function(element, properties, children, pre) {
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
		childrenArr(elem, children, pre);
		return elem;
	};
      },
      createHTML = createElements(document.getElementsByTagName("html")[0].namespaceURI),
      clearElement = function(elem) {
	while (elem.hasChildNodes()) {
		elem.removeChild(elem.lastChild);
	}
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
