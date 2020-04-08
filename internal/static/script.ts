import RPC from './rpc.js';
import {Int, LayerRPC, LayerFolder} from './types.js';
import {createHTML, clearElement} from './lib/dom.js';
import {div, h2, input, label, style} from './lib/html.js';
import {Pipe} from './lib/inter.js';
import assets from './assets.js';
import mapList from './mapList.js';
import layerList from './layerList.js';
import loadMap from './map.js';
import {Shell} from './windows.js';

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
		      mouseup = function() {
			window.removeEventListener("mousemove", mousemove);
			window.removeEventListener("mouseup", mouseup);
		      },
		      c = input({"id": "panelHider", "type": "checkbox"}),
		      t = div({"id": "tabLabels"}),
		      p = div({"id": "panelContainer"}),
		      h = div({"id": "panels", "style": `--panel-width: ${parseInt(window.localStorage.getItem("panelWidth") as string) || 300}px;`}, [
			label({"for": "panelHider", "id": "panelGrabber", "onmousedown": () => {
				if (!c.checked) {
					window.addEventListener("mousemove", mousemove);
					window.addEventListener("mouseup", mouseup);
				}
			}}),
			div({"id": "tabs"}, [t, p])
		      ]);
		let n = 0;
		return Object.freeze({
			"add": (title: string, contents: Node) => {
				h.lastChild!.insertBefore(input(Object.assign({"id": `tabSelector_${n}`, "name": "tabSelector", "type": "radio"}, n === 0 ? {"checked": "checked"} : {}) as Record<string, string>), t);
				t.appendChild(label({"for": `tabSelector_${n++}`}, title));
				return p.appendChild(div(contents));
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
	      base = div(),
	      shell = new Shell({"desktop": base});
	return RPC(`ws${window.location.protocol.slice(4)}//${window.location.host}/socket`).then(rpc => rpc.waitLogin().then(userLevel => {
		if (userLevel === 1) {
			assets(rpc, shell, tabs.add("Images", spinner("imagesLoading")), "Images");
			assets(rpc, shell, tabs.add("Audio", spinner("audioLoading")), "Audio");
			mapList(rpc, shell, tabs.add("Maps", spinner("maps")), mapLoadPipe.send);
			loadMap(rpc, shell, base.appendChild(div()), mapLoadPipe.receive, mapLayers.send);
			layerList(shell, tabs.add("Layers", div()), mapLayers.receive);
			document.head.appendChild(style({"type": "text/css"}, tabs.css));
			base.appendChild(tabs.html);
			clearElement(document.body).appendChild(shell.html);
		} else {
			return Promise.reject("Need to be logged in");
		}
	}));
}).catch((e: Error) => {
	console.log(e);
	alert(e);
});
