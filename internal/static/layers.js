offer(async function(rpc, overlay, base, mapFn, loader) {
	const {createHTML, clearLayers} = await include("jslib/html.js");
	mapFn(currentAdminMap => {
		rpc.request("Maps.GetLayers", currentAdminMap).then(layers => {
			
		});
	});
});
