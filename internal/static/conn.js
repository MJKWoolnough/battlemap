offer((function() {
	const Subscription = function(fn) {
		const successFns = [],
		      errorFns = [],
		      afterFns = [];
		fn(
			(...data) => {
				successFns.forEach(f => f(...data));
				afterFns.forEach(f => f());
			},
			(...data) => {
				errorFns.forEach(f => f(...data));
				afterFns.forEach(f => f());
			}
		);
		this.then = (successFn, errorFn) => {
			if (successFn instanceof Function) {
				successFns.push(successFn);
			}
			if (errorFn instanceof Function) {
				errorFns.push(errorFn);
			}
			return this;
		};
		this.catch = this.then.bind(this, undefined);
		this.finally = afterFn => {
			if (afterFN instanceof Function) {
				this.afterFns.push(afterFn);
			}
			return this;
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
				if (xh.readyState === 4) {
					if (xh.status === 200) {
						switch (props["response"]) {
						case "text":
						case "TEXT":
							successFn.call(xh, xh.responseText);
							break;
						case "json":
						case "JSON":
							successFn.call(xh, JSON.parse(xh.responseText));
							break
						default:
							successFn.call(xh, xh.response);
						}
					} else {
						errorFn.call(xh, new Error(xh.responseText));
					}
				}
			});
			if (props.hasOwnProperty("onprogress")) {
				xh.upload.addEventListener("progress", props["onprogress"]);
			}
			xh.send(props.hasOwnProperty("data") ? props["data"] : null);
		});
	      },
	      WS = function(path) {
			const url = (function() {
				const a = document.createElement("a");
				a.setAttribute("href", path);
				return a.href;
			}());
			return new Promise((successFn, errorFn) => {
				const ws = new WebSocket(url.replace(/^http/, "ws"));
				ws.addEventListener("open", () => successFn(Object.freeze({
					close: ws.close.bind(ws),
					send: ws.send.bind(ws),
					when: new Subscription((successFn, errorFn) => {
						ws.addEventListener("message", successFn);
						ws.addEventListener("error", errorFn);
						ws.addEventListener("close", errorFn);
					}).then,
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
		const closedErr = Object.freeze(new Error("RPC Closed")),
		      Request = class {
			constructor() {
				this.success = null;
				this.error = null;
			}
			getPromise() {
				const p = new Promise((successFn, errorFn) => {
					this.success = successFn;
					this.error = errorFn;
				}
			}
			subscribed() {
				return false;
			}
		      },
		      AwaitRequest = class {
			constructor() {
				this.promise = null;
				this.promiseSuccess = null;
				this.promiseError = null;
				this.subscription = null;
				this.subscriptionSuccess = null;
				this.subscriptionError = null;
			}
			getPromise() {
				if (this.promise !== null) {
					return this.promise;
				}
				return new Promise((successFn, errorFn) => {
					this.promiseSuccess = successFn;
					this.promiseError = errorFn;
				});
			}
			getSubscription() {
				if (this.subscription !== null) {
					return this.subscription;
				}
				return new Subscription((successFn, errorFn) => {
					this.subscriptionSuccess = successFn;
					this.subscriptionError = errorFn;
				});
			}
			clearPromise() {
				this.promise = null;
				this.promiseSuccess = null;
				this.promiseError = null;
			}
			success(data) {
				if (this.promiseSuccess !== null) {
					this.promiseSuccess(data);
					this.clearPromise();
				}
				if (this.subscriptionSuccess !== null) {
					this.subscriptionSuccess(data);
				}
			}
			error(e) {
				if (this.promiseError !== null) {
					this.promiseError(e);
					this.clearPromise();
				}
				if (this.subscriptionError !== null) {
					this.subscriptionError(e);
				}
			}
			subscribed() {
				return this.subscription !== null;
			}
		      },
		      RequestHandler = class {
			constructor(sender) {
				this.closed = false;
				this.nextID = 0;
				this.requests = new Map();
				this.sender = sender;
			}
			handleMessage(e) {
				const data = JSON.parse(e.data),
				      id = parseInt(data["id"]);
				if (!this.requests.has(id)) {
					return;
				}
				const req = this.requests.get(id);
				if (data["error"] !== undefined && data["error"] !== null) {
					req.error(new Error(data["error"]));
				} else {
					req.success(data["result"]);
				}
				if (!req.subscribed()) {
					this.requests.delete(id)
				}
			}
			handleError(e) {
				if (!this.closed) {
					this.closed = true;
					if (e.hasOwnProperty("type") && e["type"] === "close") {
						const err = new Error("Closed: " + e.code);
						err.name = "closed";
						this.requests.forEach(r => r.error(err));
					} else {
						const err = new Error("error");
						this.requests.forEach(r => r.error(err));
					}
					this.requests.clear();
				}
			}
			getRequest(id) {
				if (this.requests.has(id)) {
					return this.requests.get(id);
				}
				const r = id >= 0 ? new Request() : new AwaitRequest();
				this.requests.set(id, r);
				return r;
			}
			request(method, data = null) {
				if (this.closed) {
					return Promise.reject(closedErr);
				}
				this.sender(JSON.stringify({
					"method": method,
					"id": this.nextID,
					"params": [data]
				}));
				return this.getRequest(this.nextID++).getPromise();
			}
			await(id, keep = false) {
				if (this.closed) {
					return Promise.reject(closedErr);
				}
				if (id >= 0) {
					return Promise.reject(new Error("await IDs must be < 0"))
				}
				if (keep) {
					return this.getRequest(id).getSubscription();
				}
				return this.getRequest(id).getPromise();
			}
			close() {
				if (this.closed) {
					return false;
				}
				this.closed = true;
				this.requests.forEach(r => r.error(closedErr));
				return true;
			}
		      },
		      connectWS = function(path, allowXH) {
			return WS(path).then(ws => {
				const rh = new RequestHandler(ws.send),
				      closer = function() {
					if (rh.close()) {
						ws.close();
					}
				      };
				ws.when(rh.handleMessage.bind(rh), rh.handleError.bind(rh));
				window.addEventListener("beforeunload", closer);
				return Object.freeze({
					"request": rh.request.bind(rh),
					"await": rh.await.bind(rh),
					"close": (...data) => {
						if (rh.close()) {
							ws.close(...data);
							window.removeEventListener("beforeunload", closer);
						}
					}
				});
			}, e => {
				if (allowXH) {
					return connectXH(path);
				}
				return Promise.reject(new Error("error connecting to WebSocket"));
			});
		      },
		      connectXH = function(path) {
			const todo = [],
			      sto = -1,
			      sender = function() {
				HTTPRequest(path, {
					"method": "POST",
					"type": "application/json",
					"repsonse": "text",
					"data": todo.join()
				}).then(() => this.responseText.split("\n").forEach(msg => rh.handleMessage({"data": msg})));
				todo.splice(0, todo.length);
				sto = -1;
			      },
			      rh = new RequestHandler(function(msg) {
				todo.push(msg);
				if (sto === -1) {
					sto = window.setTimeout(sender, 1);
				}
			      });
			//TODO: Set up a 'ping' function for 'await' request?
			return Promise.resolve(Object.freeze({
				"request": rh.request.bind(rh),
				"await": rh.await.bind(rh),
				"close": rh.close.bind(rh)
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
