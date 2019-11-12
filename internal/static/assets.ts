import {RPCType} from './lib/rpc_shared.js';
import {createHTML} from './lib/html.js';
import {HTTPRequest} from './lib/conn.js';
import {LayerType} from './lib/layers.js';
import {showError, enterKey} from './misc.js';

export default function(rpc: RPCType, overlay: LayerType, base: Node): void {
	Promise.all([
		rpc.request("assets.getAssets"),
		rpc.request("assets.getTags")
	]).then(([assets, tags]) => {
		console.log(assets);
		console.log(tags);
		base.appendChild(createHTML("button", "Add Tag", {"onclick": () => {
			createHTML(overlay.addLayer(), {"class": "assetAdd"}, [
				createHTML("h1", "Add Tag"),
				createHTML("label", {"for": "newTagName"}, "New Name"),
				createHTML("input", {"id": "newTagName", "onkeypress": enterKey}),
				createHTML("button", "Add Tag", {"onclick": function(this: HTMLElement) {
					overlay.loading(rpc.request("assets.addTag", (this.previousSibling as HTMLInputElement).value)).then(tag => {
						//tagList.add(tag);
						overlay.removeLayer();
					}, showError.bind(null, this));
				}})
			]);
		}}));
		base.appendChild(createHTML("button", "Add", {"onclick": () => {
			createHTML(overlay.addLayer(), {"class": "assetAdd"}, [
				createHTML("h1", "Add Assets"),
				createHTML("form", {"enctype": "multipart/form-data", "method": "post"}, [
					createHTML("label", {"for": "assAssets"}, "Add Asset(s)"),
					createHTML("input", {"accept": "image/gif, image/png, image/jpeg, image/webp, application/ogg, audio/mpeg, text/html, text/plain, application/pdf, application/postscript", "id": "addAssets", "multiple": "multiple", "name": "asset", "type": "file", "onchange": function(this: Node) {
						const bar = createHTML("progress", {"style": "width: 100%"}) as HTMLElement;
						overlay.loading(HTTPRequest("/assets", {
							"data": new FormData(this.parentNode as HTMLFormElement),
							"method": "POST",
							"response": "JSON",
							"onprogress": (e: ProgressEvent) => {
								if (e.lengthComputable) {
									bar.setAttribute("value", e.loaded.toString());
									bar.setAttribute("max", e.total.toString());
									bar.textContent = Math.floor(e.loaded*100/e.total) + "%";
								}
							}
						}), createHTML("div", {"class": "loadBar"}, [
							createHTML("div", "Uploading file(s)"),
							bar
						])).then(assets => {
							
						}, showError.bind(null, this));
					}})
				])
			]);
		}}));
	});
}
