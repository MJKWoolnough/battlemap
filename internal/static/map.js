"use strict";
window.addEventListener("load", function() {
	const rpc = new RPC("/socket");
	rpc.await(-1, function(admin) {
		const wg = new waitGroup(() => mapStart(rpc));
		if (admin) {
			wg.add(2);
			include("assets.css", wg.done, alert.bind(null, "error loading asset css"));
			include("assets.js", wg.done, alert.bind(null, "error loading asset script"));
		}
		wg.add(1);
		include(admin ? "admin.js" : "user.js", wg.done, alert.bind(null, "error loading map script"));
	});
});
