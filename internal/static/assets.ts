import {IDName, Uint, RPC} from './types.js';
import {createHTML, clearElement, autoFocus} from './lib/dom.js';
import {audio, button, div, form, h1, img, input, label, progress} from './lib/html.js';
import {HTTPRequest} from './lib/conn.js';
import {ShellElement, loadingWindow, windows} from './windows.js';
import {handleError} from './misc.js';
import {Root, Folder, DraggableItem, Item} from './folders.js';

class ImageAsset extends DraggableItem {
	constructor(parent: Folder, id: Uint, name: string) {
		super(parent, id, name);
		(this.icon.firstChild as HTMLImageElement).setAttribute("src", `/images/${this.id}`);
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

export default function (rpc: RPC, shell: ShellElement, base: Node, fileType: "Images" | "Audio") {
	const rpcFuncs = fileType == "Audio" ? rpc["audio"] : rpc["images"];
	rpcFuncs.list().then(folderList => {
		const root = new Root(folderList, fileType, rpcFuncs, shell, fileType === "Images" ? ImageAsset : AudioAsset);
		createHTML(clearElement(base), {"id": fileType + "Items", "class": "folders"}, [
			button(`Upload ${fileType}`, {"onclick": () => {
				const window = shell.appendChild(windows({"window-title": `Upload ${fileType}`, "class": "assetAdd"}, [
					h1(`Upload ${fileType}`),
					form({"enctype": "multipart/form-data", "method": "post"}, [
						label({"for": "addAssets"}, "Add Asset(s)"),
						autoFocus(input({"accept": fileType === "Images" ? "image/gif, image/png, image/jpeg, image/webp" : "application/ogg, audio/mpeg", "id": "addAssets", "multiple": "multiple", "name": "asset", "type": "file", "onchange": function(this: HTMLInputElement) {
							this.setAttribute("disabled", "disabled");
							const bar = progress({"style": "width: 100%"}) as HTMLElement;
							loadingWindow(HTTPRequest(`/${fileType.toLowerCase()}/`, {
								"data": new FormData(this.parentNode as HTMLFormElement),
								"method": "POST",
								"response": "json",
								"onprogress": (e: ProgressEvent) => {
									if (e.lengthComputable) {
										createHTML(bar, {"value": e.loaded, "max": e.total});
										bar.textContent = Math.floor(e.loaded*100/e.total) + "%";
									}
								}
							}), window, "Uploading", div({"class": "loadBar"}, [
								div("Uploading file(s)"),
								bar
							])).then((assets: IDName[]) => {
								assets.forEach(({id, name}) => root.addItem(id, name));
								window.remove();
							})
							.catch(handleError)
							.finally(() => this.removeAttribute("disabled"));
						}}))
					])
				]));
			}}),
			root.node
		]);
	});
};
