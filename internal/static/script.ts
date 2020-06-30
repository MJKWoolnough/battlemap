import RPC from './rpc.js';
import {Int, LayerRPC, LayerFolder} from './types.js';
import {createHTML, clearElement, autoFocus} from './lib/dom.js';
import {div, h2, input, label, span, style} from './lib/html.js';
import {Pipe} from './lib/inter.js';
import assets from './assets.js';
import mapList from './mapList.js';
import layerList from './layerList.js';
import characters from './characterList.js';
import loadMap from './adminMap.js';
import loadUserMap from './map.js';
import {shell, desktop, windows} from './windows.js';
import settings from './settings.js';
import tools from './tools.js';
import characterStore from './characters.js';

type savedWindow = {
	out: boolean;
	x: Int;
	y: Int;
	width: Int;
	height: Int;
}

declare const pageLoad: Promise<void>;

const tabs = (function() {
	let n = 0;
	const mousemove = function(e: MouseEvent) {
		if (e.clientX > 0) {
			const x = document.body.clientWidth - e.clientX;
			window.localStorage.setItem("panelWidth", x.toString());
			h.style.setProperty("--panel-width", x + "px");
		}
	      },
	      mouseup = () => window.removeEventListener("mousemove", mousemove),
	      c = input({"id": "panelHider", "type": "checkbox", "checked": window.localStorage.getItem("panelShow") === "" ? "checked" : undefined, "onchange": () => {
		if (c.checked) {
			window.localStorage.setItem("panelShow", "");
		} else {
			window.localStorage.removeItem("panelShow");
		}
	      }}),
	      t = div({"id": "tabLabels"}),
	      p = div({"id": "panelContainer"}),
	      h = div({"id": "panels", "--panel-width": `${parseInt(window.localStorage.getItem("panelWidth")!) || 300}px`}, [
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
	      obsInit = {"attributeFilter": ["style"], "attributes": true},
	      tabs: HTMLLabelElement[] = [],
	      o = Object.freeze({
		"add": (title: string, contents: Node, popout = true) => {
			const base = p.appendChild(div(contents)),
			      i = h.lastChild!.insertBefore(input(Object.assign({"id": `tabSelector_${n}`, "name": "tabSelector", "type": "radio"}, n === 0 ? {"checked": "checked"} : {}) as Record<string, string>), t),
			      l = t.appendChild(label({"tabindex": "-1", "for": `tabSelector_${n}`, "onkeyup": (e: KeyboardEvent) => {
				let a = pos, tl = tabs.length;
				switch (e.key) {
				case "ArrowLeft":
					do {
						a = (((a - 1) % tl) + tl) % tl;
					} while (a !== pos && tabs[a].style.getPropertyValue("display") === "none");
					break;
				case "ArrowRight":
					do {
						a = (a + 1) % tl;
					} while (a !== pos && tabs[a].style.getPropertyValue("display") === "none");
					break;
				case "Enter":
					l.control!.click();
				default:
					return;
				}
				tabs[a].focus();
			      }}, [
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
					mo.observe(s.appendChild(autoFocus(windows({"window-title": title, "resizable": "true", "--window-left": x + "px", "--window-top": y + "px", "--window-width": width === 0 ? null : width + "px", "--window-height": height === 0 ? null : height + "px", "onremove": () => {
						p.replaceChild(base, replaced);
						l.style.removeProperty("display");
						windowData[title]["out"] = false;
						updateWindowData();
					}}, base))), obsInit);
					e.preventDefault();
					l.style.setProperty("display", "none");
					if (i.checked) {
						o.selectFirst()
					}
				}}) : []
			      ])),
			      pos = n++;
			tabs.push(l);
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
		get html() {return createHTML(null, [c , h]);},
		selectFirst() {
			tabs.some(e => {
				if (e.style.getPropertyValue("display") !== "none") {
					e.control!.click();
					return true;
				}
				return false;
			});
		}
	});
	return o;
      }()),
      mapLoadPipe = new Pipe<Int>(),
      mapLayers = new Pipe<LayerRPC>(),
      spinner = (id: string) => h2({"id": id}, ["Loading…", div({"class": "loadSpinner"})]),
      base = desktop(),
      s = shell({"snap": 50}, base);

pageLoad.then(() => RPC(`ws${window.location.protocol.slice(4)}//${window.location.host}/socket`).then(rpc => rpc.waitLogin().then(userLevel => {
	characterStore(rpc);
	if (userLevel === 1) {
		assets(rpc, s, tabs.add("Images", spinner("imagesLoading")), "Images");
		assets(rpc, s, tabs.add("Audio", spinner("audioLoading")), "Audio");
		characters(rpc, s, tabs.add("Characters", spinner("charactersLoading")));
		mapList(rpc, s, tabs.add("Maps", spinner("maps")), mapLoadPipe.send);
		layerList(s, tabs.add("Layers", div()), mapLayers.receive);
		tools(rpc, s, tabs.add("Tools", div()));
		settings(rpc, s, tabs.add("Settings", div(), false), true);
		loadMap(rpc, s, base.appendChild(div()), mapLoadPipe.receive, mapLayers.send);
		document.head.appendChild(style({"type": "text/css"}, tabs.css));
		base.appendChild(tabs.html);
		clearElement(document.body).appendChild(s);
		tabs.selectFirst();
	} else {
		settings(rpc, s, tabs.add("Settings", div()), false);
		loadUserMap(rpc, base.appendChild(div({"style": "height: 100%"})));
		document.head.appendChild(style({"type": "text/css"}, tabs.css));
		base.appendChild(tabs.html);
		clearElement(document.body).appendChild(s);
	}
	s.realignWindows();
	window.addEventListener("resize", () => s.realignWindows(), {"passive": true});
}))).catch((e: Error) => {
	console.log(e);
	alert(e);
});
