"use strict";
offer(async function(rpc, overlay, target, mapView) {	
	const {createHTML, clearElement} = await include("html.js"),
	      moveMap = function(node, map, dir) {
		if (dir === -1) {
			if (node.previousSibling !== undefined) {
				node.parentNode.insertBefore(node, node.previousSibling);
			}
		} else if (dir === 1) {
			if (node.nextSibling !== undefined) {
				node.parentNode.insertBefore(node.previousSibling, node);
			}
		}
	      },
	      configureMap = function(node, map) {

	      },
	      createMapLi = function(m) {
		createHTML(
			"li",
			{},
			[
				createHTML(
					"span",
					{
						"class": "moveMapUp",

						"onclick": function() {
							moveMap(this.parentNode, m, -1);
						}
					},
					"▲"
				),
				createHTML(
					"span",
					{
						"class": "moveMapDown",

						"onclick": function() {
							moveMap(this.parentNode, m, 1);
						}
					},
					"▼"
				),
				createHTML("span", map.Name),
				createHTML(
					"span",
					{
						"class": "configureMap",

						"onclick": function() {
							configureMap.call(this.parentNode, m);
						}
					},
					"⚙"
				),
				createHTML(
					"span",
					{
						"class": "removeMap",

						"onclick": function() {
							removeMap.call(this.parentNode, m);
						}
					},
					"⌫"
				)
			]
		);
	      },
	      listMaps = function(maps) {
		clearElement(target);
		[
			createHTML(
				"button",
				{
					"onclick": function() {
						if (name !== null && name !== "") {
							clearElement(this.nextSibling);
							rpc.request("Maps.AddMap", {"Name": name, "Width": width, "Height": height}).then(map => {
								maps.push(map);
								maps = maps.sort((m, n) => m.Order - n.Order);
								listMaps(maps);
							});
						}
					}
				},
				"+"
			),
			createHTML("ul", {"id": "maps"}, maps.map(m => createMapLi(m)))
		].forEach(e => target.appendChild(e));
	      };
	rpc.request("Maps.ListMaps").then(maps => listMaps(maps))
});
