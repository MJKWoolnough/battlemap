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
			"html": createHTML(document.createDocumentFragment(), [createHTML("input", {"id": "panelHider", "type": "checkbox"}) , h])
		});
	      }()),
	      mapLoadPipe = new Pipe();
	Promise.all([
		include("assets.js"),
		include("maplist.js")
	]).then(([assetFn, mapListFn]) => {
		clearElement(document.body);
		const overlay = layers(document.body.appendChild(createHTML("div", {"id": "overlay"})), createHTML("div", {"class": "loadSpinner"}));
		assetFn(rpc, overlay, tabs.add("assets", "Assets", createHTML("h2", {"id": "assetLoading"}, ["Loading...", createHTML("div", {"class": "loadSpinner"})])));
		mapListFn(rpc, overlay, tabs.add("maps", "Maps", createHTML("h2", {"id": "mapListLoading"}, ["Loading...", createHTML("div", {"class": "loadSpinner"})])), mapLoadPipe.send);
		tabs.add("layers", "Layers", []);
		tabs.add("tools", "Tools", []);
		document.body.appendChild(tabs.html);
	}, alert);
});
