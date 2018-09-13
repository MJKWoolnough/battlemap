"use strict";
offer(async function(rpc) {
	const {createHTML, clearElement, layers} = await include("jslib/html.js"),
	      Pipe = function() {
		const out = [];
		this.send = function(...data) {
			out.forEach(o => o(...data));
		};
		this.receive = out.push.bind(out);
	      },
	      mapLoadPipe = new Pipe();
	clearElement(document.body);
	const overlay = layers(document.body.appendChild(createHTML("div", {"id": "overlay"})), createHTML("div", {"class": "loadSpinner"}));
	Promise.all([
		include("assets.js"),
		include("maplist.js")
	]).then(([assetFn, mapListFn]) => {
		assetFn(rpc, overlay, document.body.appendChild(createHTML("div", createHTML("h2", {"id": "assetLoading"}, ["Loading...", createHTML("div", {"class": "loadSpinner"})]))));
		mapListFn(rpc, overlay, document.body.appendChild(createHTML("div", createHTML("h2", {"id": "mapListLoading"}, ["Loading...", createHTML("div", {"class": "loadSpinner"})]))), mapLoadPipe.send);
	}, alert);
});
