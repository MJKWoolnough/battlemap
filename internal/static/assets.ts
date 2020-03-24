import {Int, RPC} from './types.js';
import {createHTML, clearElement, autoFocus} from './lib/html.js';
import {audio, button, div, form, h1, img, input, label, progress} from './lib/dom.js';
import {HTTPRequest} from './lib/conn.js';
import {Shell} from './windows.js';
import {showError} from './misc.js';
import {Root, Item, windowOptions} from './folders.js';

class Asset extends Item {
	show() {
		const root = this.parent.root;
		return createHTML(autoFocus(root.shell.addWindow(this.name, windowOptions)), {"class": "showAsset"}, [
			h1(this.name),
			root.fileType === "Images" ? [
				img({"src": `/images/${this.id}`})
			] : [
				audio({"src": `/audio/${this.id}`, "controls": "controls"})
			]
		]);
	}
}

export default function (rpc: RPC, shell: Shell, base: Node, fileType: "Images" | "Audio") {
	const rpcFuncs = fileType == "Audio" ? rpc["audio"] : rpc["images"];
	rpcFuncs.list().then(folderList => {
		const root = new Root(folderList, fileType, rpcFuncs, shell, Asset);
		createHTML(clearElement(base), {"id": fileType + "Items", "class": "folders"}, [
			button(`Upload ${fileType}`, {"onclick": () => createHTML(shell.addWindow(`Upload ${fileType}`, windowOptions), {"class": "assetAdd"}, [
				h1(`Upload ${fileType}`),
				form({"enctype": "multipart/form-data", "method": "post"}, [
					label({"for": "addAssets"}, "Add Asset(s)"),
					autoFocus(input({"accept": fileType === "Images" ? "image/gif, image/png, image/jpeg, image/webp" : "application/ogg, audio/mpeg", "id": "addAssets", "multiple": "multiple", "name": "asset", "type": "file", "onchange": function(this: HTMLInputElement) {
						const bar = progress({"style": "width: 100%"}) as HTMLElement;
						shell.addLoading(this.parentNode!.parentNode as HTMLDivElement, HTTPRequest(`/${fileType.toLowerCase()}/`, {
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
						}), "Uploading", div({"class": "loadBar"}, [
							div("Uploading file(s)"),
							bar
						])).then((assets: Record<string, Int>) => {
							Object.entries(assets).forEach(([name, id]) => root.addItem(id, name))
							shell.removeWindow(this.parentNode!.parentNode as HTMLDivElement);
						}, showError.bind(null, this));
					}}))
				])
			])}),
			root.node
		]);
	});
};
