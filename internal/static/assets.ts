import type {IDName, Uint, FolderItems} from './types.js';
import type {ShellElement, WindowElement} from './windows.js';
import {createHTML, clearElement, autoFocus} from './lib/dom.js';
import {audio, button, div, form, h1, img, input, progress} from './lib/html.js';
import {HTTPRequest} from './lib/conn.js';
import {loadingWindow, windows, shell} from './windows.js';
import {Root, Folder, DraggableItem} from './folders.js';
import {labels} from './shared.js';
import lang from './language.js';
import {Pipe} from './lib/inter.js';
import {register, shareIcon} from './messaging.js'
import {rpc, handleError} from './rpc.js';

class ImageAsset extends DraggableItem {
	constructor(parent: Folder, id: Uint, name: string) {
		super(parent, id, name);
		this.image.setAttribute("src", `/images/${id}`);
	}
	dragName() {
		return "imageasset";
	}
	show() {
		const w = createHTML(autoFocus(shell.appendChild(windows({"window-icon": imageIcon, "window-title": this.name, "class": "showAsset"}, img({"src": `/images/${this.id}`})))));
		w.addControlButton(shareIcon, () => rpc.broadcastWindow("imageAsset", 0, `[img=100%]/images/${this.id}[/img]`), lang["SHARE"]);
		return w;
	}
}

class AudioAsset extends DraggableItem {
	constructor(parent: Folder, id: Uint, name: string) {
		super(parent, id, name);
		this.image.setAttribute("src", audioIcon);
	}
	dragName() {
		return "audioasset";
	}
	show() {
		const w = createHTML(autoFocus(shell.appendChild(windows({"window-icon": audioIcon, "window-title": this.name, "class": "showAsset"}, audio({"src": `/audio/${this.id}`, "controls": "controls"})))));
		w.addControlButton(shareIcon, () => rpc.broadcastWindow("audioAsset", 0, `[audio]/audio/${this.id}[/audio]`), lang["SHARE"]);
		return w;
	}
}

class AudioFolder extends Folder {
	constructor(root: Root, parent: Folder | null, name: string, children: FolderItems) {
		super(root, parent, name, children);
		for (const name in children.items) {
			this.registerItem(children.items[name], name);
		}
	}
	registerItem(id: Uint, name: string) {
		const v = audioAssets.get(id);
		if (v) {
			v[0].send(v[1] = name);
		} else {
			audioAssets.set(id, [new Pipe(), name]);
		}
	}
	addItem(id: Uint, name: string) {
		this.registerItem(id, name);
		return super.addItem(id, name);
	}
	removeItem(path: string) {
		const id = super.removeItem(path);
		if (id > 0) {
			const v = audioAssets.get(id)!;
			v[0].send(v[1] = "");
		}
		return id;
	}
}

const imageRoot = new Root({"folders": {}, "items": {}}, lang["TAB_IMAGES"], null, ImageAsset, Folder),
      audioRoot = new Root({"folders": {}, "items": {}}, lang["TAB_AUDIO"], null, AudioAsset, AudioFolder),
      audioAssets = new Map<Uint, [Pipe<string>, string]>(),
      uploadAsset = (root: Root, fileType: string, data: FormData, window: WindowElement | ShellElement = shell) => {
	const bar = progress({"style": "width: 100%"}) as HTMLElement;
	return loadingWindow(
		(HTTPRequest(`/${fileType}/`, {
			data,
			"method": "POST",
			"response": "json",
			"onprogress": (e: ProgressEvent) => {
				if (e.lengthComputable) {
					createHTML(bar, {"value": e.loaded, "max": e.total});
					bar.textContent = Math.floor(e.loaded*100/e.total) + "%";
				}
			}
		}) as Promise<IDName[]>)
		.then((assets: IDName[]) => {
			for (const {id, name} of assets) {
				root.addItem(id, name);
			}
			return assets;
		}),
		window,
		lang["UPLOADING"],
		div({"class": "loadBar"}, [
			div(lang["UPLOADING"]),
			bar
		])
	);
      };

export const audioAssetName = ((id: Uint, fn: (name: string) => void) => {
	let asset = audioAssets.get(id);
	if (!asset) {
		asset = [new Pipe(), ""];
		audioAssets.set(id, asset);
	}
	fn(asset[1]);
	asset[0].receive(fn);
	return () => asset![0].remove(fn);
}),
imageIcon = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"%3E%3Crect x="4" y="4" width="92" height="92" fill="%2344f" /%3E%3Ccircle cx="20" cy="20" r="12" fill="%23ff0" /%3E%3Cpath d="M50,65 l20,-20 a3,2 0,0,1 5,0 l20,20 v30 h-20 z" fill="%2305b" /%3E%3Cpath d="M3,70 l30,-30 a3,2 0,0,1 5,0 l55,55 h-90 z" fill="%23039" /%3E%3Crect x="3" y="3" width="94" height="94" stroke-width="6" rx="8" stroke="%23840" fill="none" /%3E%3C/svg%3E',
audioIcon = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="53" height="71" viewBox="0 0 53 71"%3E%3Cpath d="M12,56 s-5,-2 -10,5 s7,15 15,0 v-30 l30,-10 v30 s-5,-2 -10,5 s7,15 15,0 v-55 l-40,13 z m5,-29 l30,-10 v-5 l-30,10 v5 z" fill="%23000" stroke="%23fff" stroke-linejoin="round" fill-rule="evenodd" /%3E%3C/svg%3E',
uploadImages = uploadAsset.bind(null, imageRoot, "images"),
uploadAudio = uploadAsset.bind(null, audioRoot, "audio");

register("imageAsset", [imageIcon, lang["TAB_IMAGES"]]);
register("audioAsset", [audioIcon, lang["TAB_AUDIO"]]);

export default function (base: Node, fileType: "IMAGES" | "AUDIO") {
	const rpcFuncs = fileType == "IMAGES" ? rpc["images"] : rpc["audio"];
	rpcFuncs.list().then(folderList => {
		const root = fileType === "IMAGES" ? imageRoot : audioRoot;
		root.setRPCFuncs(rpcFuncs);
		root.setRoot(folderList);
		root.windowIcon = fileType === "IMAGES" ? imageIcon : audioIcon;
		createHTML(clearElement(base), {"id": fileType.toLowerCase() + "Items", "class": "folders"}, [
			button(lang[fileType === "IMAGES" ? "UPLOAD_IMAGES" : "UPLOAD_AUDIO"], {"onclick": () => {
				const f = form({"enctype": "multipart/form-data", "method": "post"}, labels(lang[fileType === "IMAGES" ? "UPLOAD_IMAGES" : "UPLOAD_AUDIO"], autoFocus(input({"accept": fileType === "IMAGES" ? "image/gif, image/png, image/jpeg, image/webp" : "application/ogg, audio/mpeg", "id": "addAssets_", "multiple": "multiple", "name": "asset", "type": "file", "onchange": function(this: HTMLInputElement) {
					uploadAsset(root, fileType.toLowerCase(), new FormData(f), window)
					.then(() => window.remove())
					.catch(handleError)
					.finally(() => this.removeAttribute("disabled"));
					this.toggleAttribute("disabled", true);
				      }})))),
				      window = shell.appendChild(windows({"window-icon": fileType === "IMAGES" ? imageIcon : audioIcon, "window-title": lang[fileType === "IMAGES" ? "UPLOAD_IMAGES" : "UPLOAD_AUDIO"], "class": "assetAdd"}, [h1(lang[fileType === "IMAGES" ? "UPLOAD_IMAGES" : "UPLOAD_AUDIO"]), f]));
			}}),
			root.node
		]);
	});
};
