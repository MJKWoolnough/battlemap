import RPC from './rpc.js';
import layers from './lib/layers.js';
import {createHTML, clearElement} from './lib/html.js';
import {Pipe} from './lib/inter.js';
import assets from './assets.js';

declare const pageLoad: Promise<void>;

pageLoad.then(() => {
	const tabs = (function() {
		const mousemove = function(e: MouseEvent) {
			if (e.clientX > 0) {
				h.style.setProperty("--panel-width", (document.body.clientWidth - e.clientX) + "px");
			}
		      },
		      mouseup = function() {
			window.removeEventListener("mousemove", mousemove);
			window.removeEventListener("mouseup", mouseup);
		      },
		      c = createHTML("input", {"id": "panelHider", "type": "checkbox"}),
		      t = createHTML("div", {"id": "tabLabels"}),
		      p = createHTML("div", {"id": "panelContainer"}),
		      h = createHTML("div", {"id": "panels"}, [
			createHTML("label", {"for": "panelHider", "id": "panelGrabber", "onmousedown": () => {
				if (!c.checked) {
					window.addEventListener("mousemove", mousemove);
					window.addEventListener("mouseup", mouseup);
				}
			}}),
			createHTML("div", {"id": "tabs"}, [t, p])
		      ]);
		let n = 0;
		return Object.freeze({
			"add": (title: string, contents: Node) => {
				(h.lastChild as Node).insertBefore(createHTML("input", Object.assign({"id": `tabSelector_${n}`, "name": "tabSelector", "type": "radio"}, n === 0 ? {"checked": "checked"} : {})), t);
				t.appendChild(createHTML("label", {"for": `tabSelector_${n++}`}, title));
				return p.appendChild(createHTML("div", contents));
			},
			get html() {return createHTML(document.createDocumentFragment(), [c , h]);}
		});
	      }()),
	      mapLoadPipe = new Pipe(),
	      spinner = (id: string) => createHTML("h2", {"id": id}, ["Loading…", createHTML("div", {"class": "loadSpinner"})]),
	      overlay = layers(clearElement(document.body).appendChild(createHTML("div", {"id": "overlay"})), spinner("loading"));
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
