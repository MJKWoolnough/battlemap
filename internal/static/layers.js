offer(async function(rpc, overlay, base, layersFn, loader) {
	const {createHTML, clearLayers} = await include("jslib/html.js");
	layersFn(layers => {
		alert(layers);
	});
});
