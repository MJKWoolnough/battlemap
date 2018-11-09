offer(async function(rpc, overlay, base, mapFn, loader) {
	const {createHTML, clearElement} = await include("jslib/html.js"),
	      layerList = (function() {
		let currentSelectedLayer = -1;
		const h = createHTML("ul", {"id": "layerList"}),
		      layers = [],
		      layer = function(l) {
			const h = createHTML("li", [
				createHTML("span", "▲", {"class": "layerMoveUp", "onclick": function() {
					const pos = layers.indexOf(am);
					if (pos === 0) {
						return;
					}
					const other = layers[pos-1];
					overlay.loading(rpc.request("Maps.SwapLayerOrder", [l.ID, other.id])).then(([thisOrder, otherOrder]) => {
						l.Order = thisOrder;
						other.order = otherOrder;
						layers.splice(layers.indexOf(al), 1);
						layerList.add(al);
					}).catch(alert);
				}}),
				createHTML("span", "▼", {"class": "layerMoveDown", "onclick": function() {
					const pos = layers.indexOf(am);
					if (pos === layers.length - 1) {
						return;
					}
					const other = layers[pos+1];
					overlay.loading(rpc.request("Maps.SwapLayerOrder", [l.ID, other.id])).then(([thisOrder, otherOrder]) => {
						l.Order = thisOrder;
						other.order = otherOrder;
						layers.splice(layers.indexOf(other), 1);
						layerList.add(other);
					}).catch(alert);
				}}),
				createHTML("span", m.Name, {"class": "layerName", "onclick": function() {
					// TODO
				}}, alert),
				createHTML("span", "⚙", {"class": "layerSettings", "onclick": function() {
					createHTML(overlay.addLayer(), {"class": "layerAlterSettings"}, [
						createHTML("h1", [
							createHTML("span", "Alter Layer Settings: "),
							createHTML("span", l.Name),
							createHTML("span", "✍", {"class": "layerRename", "onclick": function() {
								const that = this;
								createHTML(overlay.addLayer(), {"class": "layerRenamer"}, [
									createHTML("h1", "Rename Layer: " + l.Name),
									createHTML("label", {"for": "layerRename"}, "New Name"),
									createHTML("input", {"id": "layerRename", "type": "text", "value": l.Name, "onkeypress": enterKey}),
									createHTML("button", "Rename", {"onclick": function() {
										const oldName = l.Name,
										      newName = this.previousSibling.value;
										if (oldName === newName) {
											overlay.removeLayer();
											return;
										}
										if (newName === "") {
											showError(this, new Error("name cannot be nothing"));
											return;
										}
										l.Name = newName;
										overlay.loading(rpc.request("Maps.RenameLayer", l)).then(name => {
											overlay.removeLayer();
											l.Name = name;
											h.childNodes[2].textContent = name;
										}, e => {
											l.Name = oldName;
											showError(this, e);
										});
									}})
								]);
							}}),
							l.ID <= 3 ? [] : createHTML("span", "⌫", {"class": "layerDelete", "onclick": function() {
								createHTML(overlay.addLayer(), {"class": "layerDeleter"}, [
									createHTML("span", `Are you sure you wish to delete this layer: ${l.Name}? This cannot be undone!`),
									createHTML("br"),
									createHTML("button", "Yes", {"onclick": function() {
										overlay.loading(rpc.request("Maps.RemoveLayer", l.ID)).then(() => {
											layerList.remove(al);
											overlay.removeLayer();
											overlay.removeLayer();
										}, showError.bind(null, this.nextSibling));
									}}),
									createHTML("button", "No", {"onclick": overlay.removeLayer})
								]);
							}})
						])
						// TODO - OTHER SETTINGS
					]);
				}})
			      ]),
			      al = Object.freeze({
				get id() {return l.ID;},
				get order() {return l.Order;},
				set order(o) {l.Order = o;},
				get html() {return h;}
			      });
			      return al;
		      };
		return Object.freeze({
			"add": l => {
				const al = l.hasOwnProperty("id") ? l : layer(id);
				let pos = 0;
				for (; pos < layers.length; pos++) {
					if (al.order < layers[pos].order) {
						break;
					}
				}
				if (pos === layers.length) {
					h.appendChild(al.html)
				} else {
					h.insertBefore(al.html, h.childNodes[pos]);
				}
				layers.splice(pos, 0, al)
			},
			"remove": l => {
				h.removeChild(l.html);
				layers.splice(layers.indexOf(l), 1);
			}
		});
	      }());
	mapFn(currentAdminMap => rpc.request("Maps.GetLayers", currentAdminMap).then(layers => {
		document.getElementById("layersLoading").innerText = "Layers";
		createHTML(base, [
			createHTML("button", "Add", {"onclick": function() {

			}}),
		]);
	}));
});
