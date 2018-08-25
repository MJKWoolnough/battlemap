function buildMapList(rpc, maps, target, mapView) {	
	rpc.request("Maps.ListMaps", null, function(maps) {
		const moveMap = function(node, map, dir) {

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
		      };
		clearElement(target);
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
				"+"
			),
			createHTML("ul", {"id": "maps"}, maps.map(m => createMapLi(m)))
		].forEach(e => target.appendChild(e));
	});
}
