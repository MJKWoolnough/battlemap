window.addEventListener("load", (function() {
	var admin = function(ws) {
		var rpc = new (function() {
			var requests = [],
			    nextID = 0,
			    request = function(method, params, callback) {
				    var msg = {
					"method": "RPC." + method,
					"id": nextID,
					"params": [params],
				    };
				    requests[nextID++] = callback;
				    ws.send(JSON.stringify(msg));
			    },
			ws.onmessage = function(event) {
				var data = JSON.parse(event.data),
				    req = requests[data["id"]];
				delete requests[data["id"]];
				if (typeof req === "undefined") {
					return;
				} else if (data["error"] !== null) {
					alert(data["error"]);
					return;
				}
				req(data["result"]);
			}
			this.X = request.bind(this, "X");
		})();
		// setup UI
		// get current admin map
		// load admin map
	    },
	    user = function(ws) {
		ws.onmessage = function(event) {
			var data = JSON.parse(event.data);
			// process changes
		}
	    };
	return function() {
		var ws = new WebSocket((window.location.protocol == "https:" ? "wss:" : "ws:") + "//" + window.location.host + "/socket"),
		    closed = false;
		ws.onmessage = function(event) {
			var data = JSON.parse(event.data)
			if (data.Admin) {
				admin(ws);
			} else {
				user(ws);
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
			closed = true;
			ws.close();
		});
	};
}()));
