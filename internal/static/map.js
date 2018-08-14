window.addEventListener("load", function() {
	var rpc = new RPC("/maps");
	rpc.pseudoRequest(0, function(admin) {
		if (admin) {
			alert("admin");
		} else {
			// set-up pseudo requests
		}
	});
});
