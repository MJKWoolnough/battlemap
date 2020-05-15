import RPC from './rpc.js';
import {Int, LayerRPC, LayerFolder} from './types.js';
import {createHTML, clearElement} from './lib/dom.js';
import {div, h2, input, label, span, style} from './lib/html.js';
import {Pipe} from './lib/inter.js';
import assets from './assets.js';
import mapList from './mapList.js';
import layerList from './layerList.js';
import characters from './characters.js';
import loadMap from './map.js';
import {shell, desktop, windows} from './windows.js';
import settings from './settings.js';

type savedWindow = {
	out: boolean;
	x: Int;
	y: Int;
	width: Int;
	height: Int;
}

declare const pageLoad: Promise<void>;

pageLoad.then(() => {
	const tabs = (function() {
		const mousemove = function(e: MouseEvent) {
			if (e.clientX > 0) {
				const x = document.body.clientWidth - e.clientX;
				window.localStorage.setItem("panelWidth", x.toString());
				h.style.setProperty("--panel-width", x + "px");
			}
		      },
		      mouseup = () => window.removeEventListener("mousemove", mousemove),
		      c = input({"id": "panelHider", "type": "checkbox"}),
		      t = div({"id": "tabLabels"}),
		      p = div({"id": "panelContainer"}),
		      h = div({"id": "panels", "--panel-width": `${parseInt(window.localStorage.getItem("panelWidth") as string) || 300}px`}, [
			label({"for": "panelHider", "id": "panelGrabber", "onmousedown": () => {
				if (!c.checked) {
					window.addEventListener("mousemove", mousemove);
					window.addEventListener("mouseup", mouseup, {"once": true});
				}
			}}),
			div({"id": "tabs"}, [t, p])
		      ]),
		      windowData: Record<string, savedWindow> = JSON.parse(window.localStorage.getItem("windowData") || "{}"),
		      updateWindowData = () => window.localStorage.setItem("windowData", JSON.stringify(windowData)),
		      mo = new MutationObserver(list => {
			      list.forEach(m => {
				      if (m.target instanceof HTMLElement) {
					      windowData[m.target.getAttribute("window-title") || ""] = {
						"out": true,
						"x": parseInt(m.target.style.getPropertyValue("--window-left")),
						"y": parseInt(m.target.style.getPropertyValue("--window-top")),
						"width": parseInt(m.target.style.getPropertyValue("--window-width") || "0"),
						"height": parseInt(m.target.style.getPropertyValue("--window-height") || "0"),
					      };
				      }
			      });
			      updateWindowData();
		      }),
		      obsInit = {"attributeFilter": ["style"], "attributes": true};
		let n = 0;
		return Object.freeze({
			"add": (title: string, contents: Node, popout = true) => {
				const base = p.appendChild(div(contents)),
				      i = h.lastChild!.insertBefore(input(Object.assign({"id": `tabSelector_${n}`, "name": "tabSelector", "type": "radio"}, n === 0 ? {"checked": "checked"} : {}) as Record<string, string>), t),
				      l = t.appendChild(label({"for": `tabSelector_${n++}`}, [
					title,
					popout ? span({"class": "popout", "title": `Popout ${title}`, "onclick": (e: Event) => {
						const replaced = div();
						p.replaceChild(replaced, base);
						if (windowData[title]) {
							windowData[title]["out"] = true;
						} else {
							windowData[title] = {"out": true, "x": 20, "y": 20, "width": 0, "height": 0};
						}
						updateWindowData();
						const {x, y, width, height} = windowData[title];
						mo.observe(s.appendChild(windows({"window-title": title, "resizable": "true", "--window-left": x + "px", "--window-top": y + "px", "--window-width": width === 0 ? null : width + "px", "--window-height": height === 0 ? null : height + "px", "onremove": () => {
							p.replaceChild(base, replaced);
							l.style.removeProperty("display");
							windowData[title]["out"] = false;
							updateWindowData();
						}}, base)), obsInit);
						e.preventDefault();
						l.style.setProperty("display", "none");
						if (i.checked) {
							(Array.from(t.childNodes) as HTMLLabelElement[]).some(e => {
								if (e.style.getPropertyValue("display") !== "none") {
									e.control!.click();
									return true;
								}
								return false;
							})
						}
					}}) : []
				      ]));
				if (popout && windowData[title] && windowData[title]["out"]) {
					(l.lastChild as HTMLSpanElement).click();
				}
				return base;
			},
			get css() {
				return `
${Array.from({"length": n}, (_, n) => `#tabs > input:nth-child(${n+1}):checked ~ #panelContainer > div:nth-child(${n+1})`).join(",")}{display: block}
${Array.from({"length": n}, (_, n) => `#tabs > input:nth-child(${n+1}):checked ~ #tabLabels > label:nth-child(${n+1})`).join(",")}{border-bottom-color:#fff;z-index:2;background:#fff !important;cursor:default !important}
${Array.from({"length": n}, (_, n) => `#tabs > input:nth-child(${n+1}):checked ~ #tabLabels > label:nth-child(${n+1}):before`).join(",")}{box-shadow: 2px 2px 0 #fff}
${Array.from({"length": n}, (_, n) => `#tabs > input:nth-child(${n+1}):checked ~ #tabLabels > label:nth-child(${n+1}):after`).join(",")}{box-shadow: -2px 2px 0 #fff}
`;
			},
			get html() {return createHTML(null, [c , h]);}
		});
	      }()),
	      mapLoadPipe = new Pipe<Int>(),
	      mapLayers = new Pipe<LayerRPC>(),
	      spinner = (id: string) => h2({"id": id}, ["Loading…", div({"class": "loadSpinner"})]),
	      base = desktop(),
	      s = shell({"snap": 50}, base);
	return RPC(`ws${window.location.protocol.slice(4)}//${window.location.host}/socket`).then(rpc => rpc.waitLogin().then(userLevel => {
		if (userLevel === 1) {
			assets(rpc, s, tabs.add("Images", spinner("imagesLoading")), "Images");
			assets(rpc, s, tabs.add("Audio", spinner("audioLoading")), "Audio");
			characters(rpc, s, tabs.add("Characters", spinner("charactersLoading")));
			mapList(rpc, s, tabs.add("Maps", spinner("maps")), mapLoadPipe.send);
			loadMap(rpc, s, base.appendChild(div({"style": "height: 100%"})), mapLoadPipe.receive, mapLayers.send);
			layerList(s, tabs.add("Layers", div()), mapLayers.receive);
			settings(rpc, tabs.add("Settings", div(), false), true);
			document.head.appendChild(style({"type": "text/css"}, tabs.css));
			base.appendChild(tabs.html);
			clearElement(document.body).appendChild(s);
		} else {
			settings(rpc, tabs.add("Settings", div()), false);
			document.head.appendChild(style({"type": "text/css"}, tabs.css));
			base.appendChild(tabs.html);
			clearElement(document.body).appendChild(s);
		}
	}));
}).catch((e: Error) => {
	console.log(e);
	alert(e);
});
