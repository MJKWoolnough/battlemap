window.addEventListener("load", function() {
	var rpc = new RPC("/maps");
	rpc.await(0, function(admin) {
		if (admin) {
			alert("admin");
		} else {
			// set-up awaitss
		}
	});
});
