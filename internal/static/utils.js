"use strict";
var createHTML = (function() {
	var createElement = document.createElementNS.bind(document, document.getElementsByTagName("html")[0].namespaceURI);
	return function(element, properties, children, pre) {
		var elem = createElement(element);
		if (typeof properties === "object") {
			Object.keys(properties).forEach(k => elem.setAttribute(k, properties[k]));
		}
		if (typeof children === "function") {
			children = children(elem);
		}
		if (typeof children === "string") {
			if (!pre && children.indexOf("\n") >= 0) {
				children.split("\n").forEach((t, n) => {
					if (n !== 0) {
						elem.appendChild(createElement("br"));
					}
					elem.appendChild(document.createTextNode(c));
				});
			} else {
				elem.textContent = children;
			}
		} else if (children) {
			if (children.hasOwnProperty("length")) {
				children.forEach(c => {
					if (typeof c === "function") {
						c = c(elem);
					}
					if (typeof c === "string") {
						elem.appendChild(document.createTextNode(c));
					} else {
						elem.appendChild(c);
					}
				});
			} else {
				elem.appendChild(children);
			}
		}
		return elem;
	};
    }()),
    waitGroup = function(callback) {
	var state = 0;
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
    RPC = function(path) {
	var request = function(callback, keep) {
		this.callback = callback;
		this.keep = keep;
	    },
	    requests = [],
	    ws = new WebSocket((window.location.protocol == "https:" ? "wss:" : "ws:") + "//" + window.location.host + path),
	    nextID = 0,
	    sendRequest = function(method, params, request) {
	    },
	    error = alert,
	    closed = false;
	ws.onmessage = function(event) {
		var data = JSON.parse(event.data),
		    req = requests[data["id"]];
		if (typeof req === "undefined") {
			return;
		}
		if (!req.keep) {
			delete request[data["id"]];
		}
		if (data["error"] !== undefined && data["error"] !== null) {
			error(data["error"]);
			return;
		}
		if (req.callback) {
			req.callback(data["result"]);
		}
	}
	ws.onerror = function(event) {
		document.body.textContent = "An Error Occurred!";
	}
	ws.onclose = function(event) {
		if (!closed) {
			switch (event.code) {
			case 1006:
				document.body.textContent = "The server unexpectedly closed the connection - this may be an error.";
				break;
			default:
				document.body.textContent = "Lost Connection To Server! Code: " + event.code;
			}
		}
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
		var msg = {
			"method": "RPC." + method,
			"id": nextID,
			"params": [params]
		};
		request[nextID] = new request(callback, keep);
		nextID++;
		ws.send(JSON.stringify(msg));
	};
	this.pseudoRequest = function(id, callback, keep) {
		requests[id] = new request(callback, keep);
		if (id > nextID) {
			nextID = id + 1;
		}
	};
	this.close = function() {
		closed = true;
		ws.close();
	};
    };
