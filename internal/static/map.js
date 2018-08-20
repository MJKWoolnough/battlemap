"use strict";
window.addEventListener("load", function() {
	const rpc = new RPC("/socket");
	rpc.await(-1, function(admin) {
		const wg = new waitGroup(() => mapStart(rpc));
		if (admin) {
			wg.add(2);
			document.head.appendChild(createHTML(
				"link",
				{
					"href": "assets.css",
					"media": "screen",
					"rel": "stylesheet",
					"type": "text/css",

					"onload": wg.done.bind(wg),
					"onerror": alert.bind(null, "error loading asset css")
				}
			));
			document.head.appendChild(createHTML(
				"script",
				{
					"async": "false",
					"src": "assets.js",
					"type": "text/javascript",

					"onload": wg.done.bind(wg),
					"onerror": alert.bind(null, "error loading asset script")
				}
			));
		}
		wg.add(1);
		document.head.appendChild(createHTML(
			"script",
			{
				"async": "false",
				"onload": wg.done.bind(wg),
				"onerror": alert.bind(null, "error loading map script"),
				"src": admin ? "admin.js" : "user.js",
				"type": "text/javascript",
			}
		));
	});
});
