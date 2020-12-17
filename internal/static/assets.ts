import {IDName, Uint} from './types.js';
import {createHTML, clearElement, autoFocus} from './lib/dom.js';
import {audio, button, div, form, h1, img, input, label, progress} from './lib/html.js';
import {HTTPRequest} from './lib/conn.js';
import {loadingWindow, windows} from './windows.js';
import {Root, Folder, DraggableItem, Item} from './folders.js';
import lang from './language.js';
import {requestShell} from './misc.js';
import {rpc} from './rpc.js';

class ImageAsset extends DraggableItem {
	constructor(parent: Folder, id: Uint, name: string) {
		super(parent, id, name);
		this.image.setAttribute("src", `/images/${id}`);
	}
	dragName() {
		return "imageasset";
	}
	show() {
		const root = this.parent.root;
		return createHTML(autoFocus(requestShell().appendChild(windows({"window-title": this.name, "class": "showAsset"}, [
			h1(this.name),
			img({"src": `/images/${this.id}`})
		]))));
	}
}

class AudioAsset extends Item {
	show() {
		const root = this.parent.root;
		return createHTML(autoFocus(requestShell().appendChild(windows({"window-title": this.name, "class": "showAsset"}, [
			h1(this.name),
			audio({"src": `/audio/${this.id}`, "controls": "controls"})
		]))));
	}
}

export default function (base: Node, fileType: "IMAGES" | "AUDIO") {
	const rpcFuncs = fileType == "IMAGES" ? rpc["images"] : rpc["audio"];
	rpcFuncs.list().then(folderList => {
		const root = new Root(folderList, lang[fileType === "IMAGES" ? "TAB_IMAGES" : "TAB_AUDIO"], rpcFuncs, fileType === "IMAGES" ? ImageAsset : AudioAsset);
		createHTML(clearElement(base), {"id": fileType.toLowerCase() + "Items", "class": "folders"}, [
			button(lang[fileType === "IMAGES" ? "UPLOAD_IMAGES" : "UPLOAD_AUDIO"], {"onclick": () => {
				const f = form({"enctype": "multipart/form-data", "method": "post"}, [
					label({"for": "addAssets"}, lang[fileType === "IMAGES" ? "UPLOAD_IMAGES" : "UPLOAD_AUDIO"]),
					autoFocus(input({"accept": fileType === "IMAGES" ? "image/gif, image/png, image/jpeg, image/webp" : "application/ogg, audio/mpeg", "id": "addAssets", "multiple": "multiple", "name": "asset", "type": "file", "onchange": function(this: HTMLInputElement) {
						const bar = progress({"style": "width: 100%"}) as HTMLElement;
						loadingWindow(HTTPRequest(`/${fileType.toLowerCase()}/`, {
							"data": new FormData(f),
							"method": "POST",
							"response": "json",
							"onprogress": (e: ProgressEvent) => {
								if (e.lengthComputable) {
									createHTML(bar, {"value": e.loaded, "max": e.total});
									bar.textContent = Math.floor(e.loaded*100/e.total) + "%";
								}
							}
						}) as Promise<IDName[]>, window, lang["UPLOADING"], div({"class": "loadBar"}, [
							div(lang["UPLOADING"]),
							bar
						])).then((assets: IDName[]) => {
							assets.forEach(({id, name}) => root.addItem(id, name));
							window.remove();
						})
						.finally(() => this.removeAttribute("disabled"));
						this.toggleAttribute("disabled", true);
					}}))
				      ]),
				      window = requestShell().appendChild(windows({"window-title": lang[fileType === "IMAGES" ? "UPLOAD_IMAGES" : "UPLOAD_AUDIO"], "class": "assetAdd"}, [h1(lang[fileType === "IMAGES" ? "UPLOAD_IMAGES" : "UPLOAD_AUDIO"]), f]));
			}}),
			root.node
		]);
	});
};
