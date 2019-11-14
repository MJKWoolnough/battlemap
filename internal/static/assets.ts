import {RPC, Tag, Asset} from './types.js';
import {createHTML} from './lib/html.js';
import {HTTPRequest} from './lib/conn.js';
import {LayerType} from './lib/layers.js';
import {showError, enterKey} from './misc.js';

export default function(rpc: RPC, overlay: LayerType, base: Node): void {
	const addTag = (() => {
		return (tag: Tag) => {
			console.log(tag);
		};
	})(),
	      addAsset = (() => {
		return (asset: Asset) => {
			console.log(asset);
		};
	})();
	Promise.all([
		rpc.getTags(),
		rpc.getAssets()
	]).then(([tags, assets]) => {
		Object.values(tags).forEach(addTag);
		Object.values(assets).forEach(addAsset);
		base.appendChild(createHTML("button", "Add Tag", {"onclick": () => {
			createHTML(overlay.addLayer(), {"class": "assetAdd"}, [
				createHTML("h1", "Add Tag"),
				createHTML("label", {"for": "newTagName"}, "New Name"),
				createHTML("input", {"id": "newTagName", "onkeypress": enterKey}),
				createHTML("button", "Add Tag", {"onclick": function(this: HTMLElement) {
					const name = (this.previousSibling as HTMLInputElement).value;
					overlay.loading(rpc.addTag(name).then(tag => {
						addTag({id: tag, name: name, assets: []});
						overlay.removeLayer();
					}, showError.bind(null, this)));
				}})
			]);
		}}));
		base.appendChild(createHTML("button", "Add", {"onclick": () => {
			createHTML(overlay.addLayer(), {"class": "assetAdd"}, [
				createHTML("h1", "Add Assets"),
				createHTML("form", {"enctype": "multipart/form-data", "method": "post"}, [
					createHTML("label", {"for": "addAssets"}, "Add Asset(s)"),
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
						])).then((assets: Asset[]) => {
							assets.forEach(addAsset)
							overlay.removeLayer();
						}, showError.bind(null, this));
					}})
				])
			]);
		}}));
	});
}
