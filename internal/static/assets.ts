import {IDName, Uint, RPC} from './types.js';
import {createHTML, clearElement, autoFocus} from './lib/dom.js';
import {audio, button, div, form, h1, img, input, label, progress} from './lib/html.js';
import {HTTPRequest} from './lib/conn.js';
import {ShellElement, loadingWindow, windows} from './windows.js';
import {handleError} from './misc.js';
import {Root, Folder, DraggableItem, Item} from './folders.js';
import lang from './language.js';

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
		return createHTML(autoFocus(root.shell.appendChild(windows({"window-title": this.name, "class": "showAsset"}, [
			h1(this.name),
			img({"src": `/images/${this.id}`})
		]))));
	}
}

class AudioAsset extends Item {
	show() {
		const root = this.parent.root;
		return createHTML(autoFocus(root.shell.appendChild(windows({"window-title": this.name, "class": "showAsset"}, [
			h1(this.name),
			audio({"src": `/audio/${this.id}`, "controls": "controls"})
		]))));
	}
}

export default function (rpc: RPC, shell: ShellElement, base: Node, fileType: "IMAGES" | "AUDIO") {
	const rpcFuncs = fileType == "IMAGES" ? rpc["images"] : rpc["audio"];
	rpcFuncs.list().then(folderList => {
		const root = new Root(folderList, fileType, rpcFuncs, shell, fileType === "IMAGES" ? ImageAsset : AudioAsset);
		createHTML(clearElement(base), {"id": fileType + "Items", "class": "folders"}, [
			button(lang[`UPLOAD_${fileType}`], {"onclick": () => {
				const f = form({"enctype": "multipart/form-data", "method": "post"}, [
					label({"for": "addAssets"}, lang[`UPLOAD_${fileType}`]),
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
						}), window, lang["UPLOADING"], div({"class": "loadBar"}, [
							div(lang["UPLOADING"]),
							bar
						])).then((assets: IDName[]) => {
							assets.forEach(({id, name}) => root.addItem(id, name));
							window.remove();
						})
						.catch(handleError)
						.finally(() => this.removeAttribute("disabled"));
						this.setAttribute("disabled", "disabled");
					}}))
				      ]),
				      window = shell.appendChild(windows({"window-title": lang[`UPLOAD_${fileType}`], "class": "assetAdd"}, [h1(lang[`UPLOAD_${fileType}`]), f]));
			}}),
			root.node
		]);
	});
};
