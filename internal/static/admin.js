"use strict";
function mapStart(rpc) {
	clearElement(document.body);
	const mapList = document.body.appendChild(createHTML(
		"div",
		{"id": "mapList"},
		createHTML("div", {"class": "loadSpinner"})
	      )),
	      mapView = document.body.appendChild(createHTML(
		"div",
		{"id": "mapView"},
		createHTML("div", {"class": "loadSpinner"})
	      ));
	include("maplist.js", function(maps) {
		buildMapList(rpc, maps, mapList, mapView);
	});
}
