"use strict";
offer(async function(rpc) {
	const {createHTML, clearElement, Layers} = await include("html.js");
	clearElement(document.body);
	const overlay = new Layers(document.body.appendChild(createHTML("div", {"id": "overlay"})));
	include("maplist.js").then(maplist => maplist(
		rpc,
		overlay,
		document.body.appendChild(createHTML(
			"div",
			{
				"id": "mapList"
			},
			createHTML("div", {"class": "loadSpinner"})
		)),
		document.body.appendChild(createHTML(
			"div",
			{
				"id": "mapView"
			},
			createHTML("div", {"class": "loadSpinner"})
		))
	));
});
