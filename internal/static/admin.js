"use strict";
function mapStart(rpc) {
	rpc.request("Maps.ListMaps", null, function(maps) {
		clearElement(document.body);
		document.body.appendChild(createHTML(
			"div",
			{
				"id": "mapList",
			},
			[
				createHTML(
					"button",
					{
						"onclick": function() {
							const name = prompt("Map Name?", "");
							if (name !== null && name !== "") {
								rpc.request("Maps.AddMap", name, function(map) {
									maps.push(map);
									maps = maps.sort((m, n) => m.Order - n.Order);
								});
							}
						}
					},
					"New Map"
				),
				createHTML("ul", {}, maps.map(m => createHTML(
					"ul",
					{},
					map.Name
				)))
			]
		));
	});
}
