"use strict";
window.addEventListener("load", function() {
	var rpc = new RPC("/maps");
	rpc.await(0, function(admin) {
		document.head.appendChild(createHTML(
			"script",
			{
				"async": "false",
				"onload": function() {
					start(rpc);
				},
				"onerror": alert.bind(null, "error loading map script"),
				"src": admin ? "admin.js" : "user.js",
				"type": "text/javascript",
			}
		));
	});
});
