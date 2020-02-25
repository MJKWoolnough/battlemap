import {Int, RPC, LayerType} from './types.js';
import {createHTML} from './lib/html.js';
import {audio, button, div, form, h1, img, input, label, progress} from './lib/dom.js';
import {HTTPRequest} from './lib/conn.js';
import {showError} from './misc.js';
import folderInit, {Root, Item} from './folders.js';

class Asset extends Item {
	show() {
		const root = this.parent.root,
		      overlay = root.overlay;
		return createHTML(root.overlay.addLayer(), {"class": "showAsset"}, [
			h1(this.name),
			root.fileType === "Images" ? [
				img({"src": `/images/${this.id}`})
			] : [
				audio({"src": `/audio/${this.id}`, "controls": "controls"})
			]
		]);
	}
}

export default function (rpc: RPC, overlay: LayerType, base: Node, fileType: "Images" | "Audio") {
	folderInit(fileType == "Audio" ? rpc["audio"] : rpc["images"], overlay, base, fileType, Asset, (root: Root)  => button(`Upload ${fileType}`, {"onclick": () => createHTML(overlay.addLayer(), {"class": "assetAdd"}, [
		h1(`Upload ${fileType}`),
		form({"enctype": "multipart/form-data", "method": "post"}, [
			label({"for": "addAssets"}, "Add Asset(s)"),
			input({"accept": fileType === "Images" ? "image/gif, image/png, image/jpeg, image/webp" : "application/ogg, audio/mpeg", "id": "addAssets", "multiple": "multiple", "name": "asset", "type": "file", "onchange": function(this: Node) {
				const bar = progress({"style": "width: 100%"}) as HTMLElement;
				overlay.loading(HTTPRequest(`/${fileType.toLowerCase()}/`, {
					"data": new FormData(this.parentNode as HTMLFormElement),
					"method": "POST",
					"response": "json",
					"onprogress": (e: ProgressEvent) => {
						if (e.lengthComputable) {
							bar.setAttribute("value", e.loaded.toString());
							bar.setAttribute("max", e.total.toString());
							bar.textContent = Math.floor(e.loaded*100/e.total) + "%";
						}
					}
				}), div({"class": "loadBar"}, [
					div("Uploading file(s)"),
					bar
				])).then((assets: Record<string, Int>) => {
					Object.entries(assets).forEach(([name, id]) => root.addItem(id, name))
					overlay.removeLayer();
				}, showError.bind(null, this));
			}})
		])
	])}));
};
