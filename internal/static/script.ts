import RPC from './rpc.js';
import layers from './lib/layers.js';
import {createHTML, clearElement} from './lib/html.js';
import {div, h2, input, label} from './lib/dom.js';
import {Pipe} from './lib/inter.js';
import assets from './assets.js';

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
				(h.lastChild as Node).insertBefore(input(Object.assign({"id": `tabSelector_${n}`, "name": "tabSelector", "type": "radio"}, n === 0 ? {"checked": "checked"} : {})), t);
				t.appendChild(label({"for": `tabSelector_${n++}`}, title));
				return p.appendChild(div(contents));
			},
			get html() {return createHTML(null, [c , h]);}
		});
	      }()),
	      mapLoadPipe = new Pipe(),
	      spinner = (id: string) => h2({"id": id}, ["Loading…", div({"class": "loadSpinner"})]),
	      overlay = layers(clearElement(document.body).appendChild(div({"id": "overlay"})), spinner("loading"));
	return RPC(`ws${window.location.protocol.slice(4)}//${window.location.host}/socket`).then(rpc => rpc.waitLogin().then(userLevel => {
		if (userLevel === 1) {
			assets(rpc, overlay, tabs.add("Images", spinner("imagesLoading")), "Images");
			assets(rpc, overlay, tabs.add("Audio", spinner("audioLoading")), "Audio");
			document.body.appendChild(tabs.html);
		} else {
			return Promise.reject("Need to be logged in");
		}
	}));
}).catch((e: Error) => {
	console.log(e);
	alert(e);
});
