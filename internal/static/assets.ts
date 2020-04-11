import {Int, RPC} from './types.js';
import {createHTML, clearElement, autoFocus} from './lib/dom.js';
import {audio, button, div, form, h1, img, input, label, progress} from './lib/html.js';
import {HTTPRequest} from './lib/conn.js';
import {Shell} from './windows.js';
import {showError} from './misc.js';
import {Root, Folder, Item, windowOptions} from './folders.js';

class ImageAsset extends Item {
	icon: HTMLDivElement;
	constructor(parent: Folder, id: Int, name: string) {
		super(parent, id, name);
		this.icon = div(img({"src": `/images/${this.id}`, "class": "imageIcon"}));
		createHTML(this.node.firstChild!, {
			"draggable": "true",
			"onmousemove": (e: MouseEvent) => {
				this.icon.style.setProperty("--icon-top", (e.clientY + 5) + "px");
				this.icon.style.setProperty("--icon-left",(e.clientX + 5) + "px");
				if (!this.icon.parentNode) {
					document.body.appendChild(this.icon);
				}
			},
			"onmouseout": () => {
				if (this.icon.parentNode) {
					document.body.removeChild(this.icon);
				}
				this.icon.style.removeProperty("transform");
			},
			"ondragstart": (e: DragEvent) => {
				const img = this.icon.firstChild as HTMLImageElement;
				if (img.naturalWidth === 0 || img.naturalHeight === 0) {
					e.preventDefault();
				}
				e.dataTransfer!.setDragImage(this.icon, -5, -5);
				e.dataTransfer!.setData("imageAsset", JSON.stringify({id: this.id.toString(), width: img.naturalWidth, height: img.naturalHeight}));
				this.icon.style.setProperty("transform", "translateX(-9999px)");
			}
		});
	}
	show() {
		const root = this.parent.root;
		return createHTML(autoFocus(root.shell.addWindow(this.name, windowOptions)), {"class": "showAsset"}, [
			h1(this.name),
			img({"src": `/images/${this.id}`})
		]);
	}
}

class AudioAsset extends Item {
	show() {
		const root = this.parent.root;
		return createHTML(autoFocus(root.shell.addWindow(this.name, windowOptions)), {"class": "showAsset"}, [
			h1(this.name),
			audio({"src": `/audio/${this.id}`, "controls": "controls"})
		]);
	}
}

export default function (rpc: RPC, shell: Shell, base: Node, fileType: "Images" | "Audio") {
	const rpcFuncs = fileType == "Audio" ? rpc["audio"] : rpc["images"];
	rpcFuncs.list().then(folderList => {
		const root = new Root(folderList, fileType, rpcFuncs, shell, fileType === "Images" ? ImageAsset : AudioAsset);
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
