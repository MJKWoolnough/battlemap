window.addEventListener("load", function() {
	var rpc = new RPC("/maps");
	rpc.psuedoRequest(0, function(admin) {
		if (admin) {
			alert("admin");
		} else {
			alert("user");
		}
	});
});
