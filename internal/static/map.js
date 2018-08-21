"use strict";
window.addEventListener("load", function() {
	const rpc = new RPC("/socket");
	rpc.await(-1, function(admin) {
		const wg = new waitGroup(() => mapStart(rpc)),
		      wgDone = wg.done.bind(wg);
		if (admin) {
			wg.add(2);
			include("assets.css", wgDone, alert.bind(null, "error loading asset css"));
			include("assets.js", wgDone, alert.bind(null, "error loading asset script"));
		}
		wg.add(1);
		include(admin ? "admin.js" : "user.js", wgDone, alert.bind(null, "error loading map script"));
	});
});
