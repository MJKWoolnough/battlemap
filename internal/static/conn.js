offer((function() {
	const Subscription = function(fn) {
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
	      HTTPRequest = function(url, props = {}) {
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
	      WS = function(path) {
			return new Promise((successFn, errorFn) => {
				const ws = new WebSocket((window.location.protocol == "https:" ? "wss:" : "ws:") + "//" + window.location.host + path);
				ws.addEventListener("open", () => successFn(Object.freeze({
					close: ws.close.bind(ws),
					send: ws.send.bind(ws),
					when: new Subscription((successFn, errorFn) => {
						ws.addEventListener("message", successFn);
						ws.addEventListener("error", errorFn);
						ws.addEventListener("close", errorFn);
					}).when,
					get type() {
						return ws.type;
					},
					set type(t) {
						ws.type = t;
					},
				})));
				ws.addEventListener("error", errorFn);
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
						req["errorFn"](new Error(data["error"]));
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
	return Object.freeze({HTTPRequest, RPC, WS});
}()));
