"use strict";
offer(async function(rpc) {
	const {createHTML, clearElement} = await include("jslib/html.js"),
	      {layers} = await include("jslib/layers.js"),
	      {Pipe} = await include("jslib/inter.js"),
	      tabs = (function() {
		const mousemove = function(e) {
			if (getComputedStyle(h).getPropertyValue("right") === "0px" && e.clientX > 0) {
				h.style.setProperty("--panel-width", (document.body.clientWidth - e.clientX) + "px");
			}
		      },
		      mouseup = function() {
			window.removeEventListener("mousemove", mousemove);
			window.removeEventListener("mouseup", mouseup);
		      },
		      c = createHTML("input", {"id": "panelHider", "type": "checkbox"}),
		      t = createHTML("div", {"id": "tabs"}),
		      p = createHTML("div", {"id": "panelContainer"}),
		      h = createHTML("div", {"id": "panels"}, [
			createHTML("label", {"for": "panelHider", "id": "panelGrabber", "onmousedown": () => {
				window.addEventListener("mousemove", mousemove);
				window.addEventListener("mouseup", mouseup);
			}}),
			t,
			p
		      ]);
		return Object.freeze({
			"add": (id, title, contents) => {
				h.insertBefore(createHTML("input", {"id": "tabSelector_" + id, "name": "tabSelector", "type": "radio"}), t);
				t.appendChild(createHTML("label", {"id": "tab_" + id, "for": "tabSelector_" + id}, title));
				return p.appendChild(createHTML("div", {"id": "panel_" + id}, contents));
			},
			get html() {return createHTML(document.createDocumentFragment(), [c , h]);}
		});
	      }()),
	      mapLoadPipe = new Pipe(),
	      assetsFn = await include("assets.js"),
	      mapListFn = await include("maplist.js"),
	      layersFn = await include("layers.js");
	clearElement(document.body);
	const overlay = layers(document.body.appendChild(createHTML("div", {"id": "overlay"})), createHTML("div", {"class": "loadSpinner"}));
	assetsFn(rpc, overlay, tabs.add("assets", "Assets", createHTML("h2", {"id": "assetLoading"}, ["Loading...", createHTML("div", {"class": "loadSpinner"})])));
	mapListFn(rpc, overlay, tabs.add("maps", "Maps", createHTML("h2", {"id": "mapListLoading"}, ["Loading...", createHTML("div", {"class": "loadSpinner"})])), mapLoadPipe.send);
	layersFn(rpc, overlay, tabs.add("layers", "Layers", createHTML("h2", {"id": "layersLoading"}, ["Loading...", createHTML("div", {"class": "loadSpinner"})])), mapLoadPipe.receive);
	tabs.add("tools", "Tools", []);
	document.body.appendChild(tabs.html);
});
