"use strict";
const pageLoad = new Promise(successFn => window.addEventListener("load", successFn)),
      createElements = function(namespace) {
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
		clearElement(container);
		const elm = layers.pop();
		if (elm !== undefined) {
			container.appendChild(elm);
		}
		if (closerFn instanceof Function) {
			closerFn();
		}
		if (layers.length === 0) {
			window.removeEventListener("keypress", keyPress);
			return;
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
				{},
				createHTML(
					"span",
					{
						"class": "closer",

						"onclick": closer.bind(null, closerFn)
					},
					"X"
				)
			));
		},
		removeLayer: closer
	});
      },
      include = function(url) {
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
	return new Promise((successFn, errorFn) => {
		props["onload"] = successFn;
		props["onerror"] = errorFn;
		document.head.appendChild(createHTML(elm, props));
	});
      },
      Subscription = function(fn) {
	const successFns = [],
	      errorFns = [];
	fn((...data) => successFns.forEach(f => f(...data)), (...data) => errorFns.forEach(f => f(...data)));
	this.when = (successFn, errorFn) => {
		if (successFn instanceof Function) {
			successFns.push(successFn);
		}
		if (errorFn instanceof Function) {
			errorFns.push(errorFn);
		}
	};
      },
      xmlHTTP = function(url, props = {}) {
	return new Promise((successFn, errorFn) => {
		const xh = new XMLHttpRequest();
		xh.open(
			props.hasOwnProperty("method") ? props["method"] : "GET",
			url,
			true,
			props.hasOwnProperty("user") ? props["user"] : null,
			props.hasOwnProperty("password") ? props["password"] : null
		);
		if (props.hasOwnProperty("type")) {
			xh.setRequestHeader("Content-Type", props["type"]);
		}
		xh.addEventListener("readystatechange", () => {
			if (this.readyState === 4) {
				if (this.status === 200) {
					switch (props["response"]) {
					case "text":
					case "TEXT":
						successFn.call(xh, xh.responseText);
						break;
					default:
						successFn.call(xh, xh.response);
					}
				} else {
					errorFn.call(xh, xh.responseText);
				}
			}
		});
		if (props.hasOwnProperty("onprogress")) {
			xh.addEventListener("progress", props["onprogress"]);
		}
		xh.send(props.hasOwnProperty("data") ? props["data"] : null);
	});
      },
      RPC = (function() {
	const connectWS = function(path, allowXH) {
		return new Promise((successFn, errorFn) => {
			const ws = new WebSocket((window.location.protocol == "https:" ? "wss:" : "ws:") + "//" + window.location.host + path);
			ws.addEventListener("open", successFn.bind(null, ws));
			ws.addEventListener("error", errorFn);
		}).then(ws => Promise.resolve((function() {
			const requests = [],
			      awaitFn = (id, keep) => (successFn, errorFn) => {
				requests[id] = {"successFn": successFn, "errorFn": errorFn, "keep": keep};
				if (id >= nextID) {
					nextID = id + 1;
				}
			};
			let nextID = 0, closed = false;
			ws.addEventListener("close", e => {
				if (!closed) {
					switch (e.code) {
					case 1006:
						document.body.textContent = "The server unexpectedly closed the connection - this may be an error.";
						break;
					default:
						document.body.textContent = "Lost Connection To Server! Code: " + e.code;
					}
				}
			});
			ws.addEventListener("message", e => {
				const data = JSON.parse(e.data),
				    req = requests[data["id"]];
				if (typeof req === "undefined") {
					return;
				}
				if (!req.keep) {
					delete requests[data["id"]];
				}
				if (data["error"] !== undefined && data["error"] !== null) {
					req["errorFn"](data["error"]);
					return;
				}
				if (req["successFn"]) {
					req["successFn"](data["result"]);
				}
			});
			window.addEventListener("beforeunload", function() {
				if (!closed) {
					closed = true;
					ws.close();
				}
			});
			return Object.freeze({
				"request": function(method, params = null) {
					if (closed) {
						return Promise.reject("RPC closed");
					}
					return new Promise((successFn, errorFn) => {
						const msg = {
							"method": method,
							"id": nextID,
							"params": [params]
						};
						requests[nextID] = {"successFn": successFn, "errorFn": errorFn, "keep": false};
						nextID++;
						ws.send(JSON.stringify(msg));
					});
				},
				"await": function(id, keep = false) {
					if (keep) {
						return new Subscription(awaitFn(id, true));
					}
					return new Promise(awaitFn(id, false));
				},
				"close": function() {
					closed = true;
					ws.close();
				}
			});
		}())),
		() => {
			if (allowXH) {
				return connectXH();
			} else {
				return Promise.reject("error connecting to WebSocket");
			}
		});
	      },
	      connectXH = function(path) {
		const requests = [],
		      awaitFn = (id, keep) => (successFn, errorFn) => {
			requests[id] = {"successFn": successFn, "errorFn": errorFn, "keep": keep};
			if (id >= nextID) {
				nextID = id + 1;
			}
		      },
		      todo = [],
		      readystatechange = function() {
			this.responseText.split("\n").forEach(response => {
				const data = JSON.parse(response),
				      req = request[data["id"]];
				if (typeof req === "undefined") {
					return;
				}
				if (!req.keep) {
					delete requests[data["id"]];
				}
				if (data["error"] !== undefined && data["error"] !== null) {
					req["errorFn"](data["error"]);
					return;
				}
				if (req["successFn"]) {
					req["successFn"](data["result"]);
				}
			});
		      },
		      send = function() {
			xmlHTTP(path, {
				"method": "POST",
				"type": "application/json",
				"repsonse": "text",
				"data": todo.join()
			}).then(readystatechange);
			todo.splice(0, todo.length);
			sto = -1;
		      };
		let nextID = 0,
		    sto = -1,
		    closed = false;
		//TODO: Set up a 'ping' function for 'await' request?
		return Promise.resolve(Object.freeze({
			"request": function(method, params = null) {
				if (closed) {
					return new Promise.reject("RPC closed");
				}
				return new Promise((successFn, errorFn) => {
					const msg = {
						"method": method,
						"id": nextID,
						"params": [params]
					};
					requests[nextID] = {"successFn": successFn, "errorFn": errorFn, "keep": false};
					nextID++;
					todo.push(JSON.stringify(msg));
					if (sto === -1) {
						sto = window.setTimeout(send, 1);
					}
				});
			},
			"await": function(id, keep = false) {
				if (keep) {
					return new Subscription(awaitFn(id, true));
				}
				return new Promise(awaitFn(id, false));
			},
			"close": function() {
				closed = true;
			}
		}));
	      };
	  return function(path, allowWS = true, allowXH = false) {
		if (allowWS) {
			return connectWS(path, allowXH);
		} else if (allowXH) {
			return connectXH(path);
		}
		return Promise.reject("no connecion available");
	  };
      }());
