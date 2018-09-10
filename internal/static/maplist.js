"use strict";
offer(async function(rpc, overlay, base, loader) {
	const {createHTML, clearElement} = await include("html.js"),
	      {showError, clearError, enterKey} = await include("misc.js"),
	      mapList = (function() {
		const h = createHTML("ul"),
		      maps = [],
		      map = function(m) {
			const h = createHTML("li", [
				createHTML("span", "▲", {"class": "mapMoveUp", "onclick": function() {
					const pos = maps.indexOf(am);
					if (pos === 0) {
						return;
					}
					const other = maps[pos-1];
					overlay.loading(rpc.request("Maps.SwapMapOrder", [m.ID, other.id])).then(([thisOrder, otherOrder]) => {
						m.Order = thisOrder;
						other.order = otherOrder;
						maps.splice(maps.indexOf(am), 1);
						mapList.add(am);
					}).catch(alert);
				}}),
				createHTML("span", "▼", {"class": "mapMoveDown", "onclick": function() {
					const pos = maps.indexOf(am);
					if (pos === maps.length - 1) {
						return;
					}
					const other = maps[pos+1];
					overlay.loading(rpc.request("Maps.SwapMapOrder", [m.ID, other.id])).then(([thisOrder, otherOrder]) => {
						m.Order = thisOrder;
						other.order = otherOrder;
						maps.splice(maps.indexOf(other), 1);
						mapList.add(other);
					}).catch(alert);
				}}),
				createHTML("span", m.Name, {"onclick": function() {
					if (currentAdminMap !== m.ID) {
						overlay.loading(rpc.request("Maps.SetCurrentAdminMap", m.ID)).then(() => {
							if (currentAdminMap >= 0) {
								maps.find(m => m.id === currentAdminMap).html.classList.remove("adminMap")
							}
							h.classList.add("adminMap");
							currentAdminMap = m.ID;
							loader(m.ID);
						});
					}
				}}, alert),
				createHTML("span", "⚙", {"class": "mapSettings", "onclick": function() {
					createHTML(overlay.addLayer(), {"class": "mapAlterSettings"}, [
						createHTML("h1", [
							createHTML("span", "Alter Map Settings: "),
							createHTML("span", m.Name),
							createHTML("span", "✍", {"class": "mapRename", "onclick": function() {

							}}),
							currentAdminMap === m.ID || currentUserMap === m.ID ? [] : createHTML("span", "⌫", {"class": "mapDelete", "onclick": function() {

							}})
						]),
						createHTML("label", {"for": "mapWidth"}, "Map Width"),
						createHTML("input", {"id": "mapWidth", "minimum": "10", "step": "1", "type": "number", "value": "50"}),
						createHTML("br"),
						createHTML("label", {"for": "mapHeight"}, "Map Height"),
						createHTML("input", {"id": "mapHeight", "minimum": "10", "step": "1", "type": "number", "value": "50"}),
						createHTML("br"),
						createHTML("button", "Update", {"onclick": function() {

						}})
					]);
				}}),
				createHTML("span", "🖧", {"onclick": function() {
					if (currentUserMap !== m.ID) {
						overlay.loading(rpc.request("Maps.SetCurrentUserMap", m.ID)).then(() => {
							if (currentUserMap >= 0) {
								maps.find(m => m.id === currentUserMap).html.classList.remove("userMap");
							}
							h.classList.add("userMap");
							currentUserMap = m.ID;
						}, alert);
					}
				}})
			      ]),
			      am = Object.freeze({
				get id() {return m.ID;},
				get order() {return m.Order;},
				set order(o) {m.Order = o;},
				get html() {return h;}
			      });
			return am;
		      },
		      am = Object.freeze({
			"add": m => {
				const am = m.hasOwnProperty("id") ? m : map(m);
				let pos = 0;
				for (; pos < maps.length; pos++) {
					if (am.order < maps[pos].order) {
						break;
					}
				}
				if (pos === maps.length) {
					h.appendChild(am.html)
				} else {
					h.insertBefore(am.html, h.childNodes[pos]);
				}
				maps.splice(pos, 0, am)
			},
			"remove": am => {
				h.removeChild(am.html);
				maps.splice(maps.indexOf(am), 1);
			},
			"currentAdminMap": function(mid) {
				if (currentAdminMap >= 0) {
					maps.find(m => m.ID === currentAdminMap).html.classList.remove("adminMap");
				}
				currentAdminMap = mid;
				if (currentAdminMap >= 0 && maps.length > 0) {
					const m = maps.find(m => m.id === mid);
					if (m) {
						m.html.classList.add("adminMap");
					}
				}
			},
			"currentUserMap": function(mid) {
				if (currentUserMap >= 0) {
					maps.find(m => m.ID === currentUserMap).html.classList.remove("userMap");
				}
				currentUserMap = mid;
				if (currentUserMap >= 0 && maps.length > 0) {
					const m = maps.find(m => m.id === mid);
					if (m) {
						m.html.classList.add("userMap");
					}
				}
			},
			get html() {return h;}
		      });
		let currentUserMap = -1, currentAdminMap = -1;
		return am;
	      }());
	Promise.all([
		rpc.request("Maps.ListMaps"),
		rpc.request("Maps.CurrentAdminMap"),
		rpc.request("Maps.CurrentUserMap")
	]).then(([maps, currentAdminMap, currentUserMap]) => {
		const ml = document.getElementById("mapListLoading");
		if (ml) {
			ml.textContent = "Maps";
		}
		maps.forEach(mapList.add);
		mapList.currentAdminMap(currentAdminMap);
		mapList.currentUserMap(currentUserMap);
		createHTML(base, {"id": "mapList"}, [
			createHTML("button", "Add Map", {"onclick": function() {
				createHTML(overlay.addLayer(), {"class": "mapAdd"}, [
					createHTML("h1", "Add Map"),
					createHTML("label", {"for": "mapName"}, "Map Name"),
					createHTML("input", {"id": "mapName"}),
					createHTML("br"),
					createHTML("label", {"for": "mapWidth"}, "Map Width"),
					createHTML("input", {"id": "mapWidth", "minimum": "10", "step": "1", "type": "number", "value": "50"}),
					createHTML("br"),
					createHTML("label", {"for": "mapHeight"}, "Map Height"),
					createHTML("input", {"id": "mapHeight", "minimum": "10", "step": "1", "type": "number", "value": "50"}),
					createHTML("br"),
					createHTML("button", "Create Map", {"onclick": function() {
						const [name, widthElm, heightElm] = Array.from(this.parentNode.getElementsByTagName("input")),
						      width = parseInt(widthElm.value),
						      height = parseInt(heightElm.value);
						let error = false;
						if (name.value === "") {
							showError(name, new Error("Need Map Name"));
							error = true;
						} else {
							clearError(name);
						}
						if (width < 10 || width !== width) {
							showError(widthElm, new Error("Width must be Greater Than or Equal To 10"));
							error = true;
						} else {
							clearError(widthElm);
						}
						if (height < 10 || height !== height) {
							showError(heightElm, new Error("Height must be Greater Than or Equal To 10"));
							error = true;
						} else {
							clearError(heightElm);
						}
						if (!error) {
							overlay.loading(rpc.request("Maps.AddMap", {"Name": name.value, "Width": width, "Height": height})).then(map => {
								mapList.add(map);
								overlay.removeLayer();
							}, showError.bind(null, this));
						}
					}})
				]);
			}}),
			base.appendChild(mapList.html)
		]);
		loader(currentAdminMap);
	}, alert);
});
