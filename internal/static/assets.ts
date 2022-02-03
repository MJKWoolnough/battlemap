import type {FolderItems, FolderRPC, IDName, Uint} from './types.js';
import type {ShellElement, WindowElement} from './windows.js';
import {HTTPRequest} from './lib/conn.js';
import {amendNode, autoFocus, clearNode} from './lib/dom.js';
import {audio, button, div, form, h1, img, input, progress} from './lib/html.js';
import {Pipe} from './lib/inter.js';
import {node} from './lib/nodes.js';
import {ns as svgNS} from './lib/svg.js';
import {DraggableItem, Root, Folder} from './folders.js';
import lang from './language.js';
import {register, shareIcon} from './messaging.js'
import {handleError, isAdmin, rpc} from './rpc.js';
import {labels, loading, menuItems, setAndReturn} from './shared.js';
import {loadingWindow, shell, windows} from './windows.js';

class ImageAsset extends DraggableItem {
	constructor(parent: Folder, id: Uint, name: string) {
		super(parent, id, name);
		amendNode(this.image, {"src": `/images/${id}`});
	}
	get showOnMouseOver() { return true; }
	dragName() { return "imageasset"; }
	show() {
		const w = amendNode(autoFocus(shell.appendChild(windows({"window-icon": imageIcon, "window-title": this.name, "class": "showAsset"}, img({"src": `/images/${this.id}`})))));
		w.addControlButton(shareIcon, () => rpc.broadcastWindow("imageAsset", 0, `[img=100%]/images/${this.id}[/img]`), lang["SHARE"]);
		return w;
	}
}

class AudioAsset extends DraggableItem {
	constructor(parent: Folder, id: Uint, name: string) {
		super(parent, id, name);
		amendNode(this.image, {"src": audioIcon});
	}
	dragName() { return "audioasset"; }
	show() {
		const w = amendNode(autoFocus(shell.appendChild(windows({"window-icon": audioIcon, "window-title": this.name, "class": "showAsset"}, audio({"src": `/audio/${this.id}`, "controls": "controls"})))));
		w.addControlButton(shareIcon, () => rpc.broadcastWindow("audioAsset", 0, `[audio]/audio/${this.id}[/audio]`), lang["SHARE"]);
		return w;
	}
}

type AssetMap = Map<Uint, [Pipe<string>, string]>;

abstract class AssetFolder extends Folder {
	constructor(root: Root, parent: Folder | null, name: string, children: FolderItems) {
		super(root, parent, name, children);
		for (const name in children.items) {
			this.registerItem(children.items[name], name);
		}
	}
	abstract get assetMap(): AssetMap;
	registerItem(id: Uint, name: string) {
		const v = this.assetMap.get(id);
		if (v) {
			v[0].send(v[1] = name);
		} else {
			this.assetMap.set(id, [new Pipe(), name]);
		}
	}
	addItem(id: Uint, name: string) {
		this.registerItem(id, name);
		return super.addItem(id, name);
	}
	removeItem(path: string) {
		const id = super.removeItem(path);
		if (id > 0) {
			const v = this.assetMap.get(id)!;
			v[0].send(v[1] = "");
		}
		return id;
	}
}

class AudioFolder extends AssetFolder {
	get assetMap() {
		return audioAssets;
	}
}

class ImageFolder extends AssetFolder {
	get assetMap() {
		return imageAssets;
	}
}

const imageRoot = new Root({"folders": {}, "items": {}}, lang["TAB_IMAGES"], null, ImageAsset, ImageFolder),
      audioRoot = new Root({"folders": {}, "items": {}}, lang["TAB_AUDIO"], null, AudioAsset, AudioFolder),
      imageIcon = `data:image/svg+xml,%3Csvg xmlns="${svgNS}" viewBox="0 0 100 100"%3E%3Crect x="4" y="4" width="92" height="92" fill="%2344f" /%3E%3Ccircle cx="20" cy="20" r="12" fill="%23ff0" /%3E%3Cpath d="M50,65 l20,-20 a3,2 0,0,1 5,0 l20,20 v30 h-20 z" fill="%2305b" /%3E%3Cpath d="M3,70 l30,-30 a3,2 0,0,1 5,0 l55,55 h-90 z" fill="%23039" /%3E%3Crect x="3" y="3" width="94" height="94" stroke-width="6" rx="8" stroke="%23840" fill="none" /%3E%3C/svg%3E`,
      audioIcon = `data:image/svg+xml,%3Csvg xmlns="${svgNS}" width="53" height="71" viewBox="0 0 53 71"%3E%3Cpath d="M12,56 s-5,-2 -10,5 s7,15 15,0 v-30 l30,-10 v30 s-5,-2 -10,5 s7,15 15,0 v-55 l-40,13 z m5,-29 l30,-10 v-5 l-30,10 v5 z" fill="%23000" stroke="%23fff" stroke-linejoin="round" fill-rule="evenodd" /%3E%3C/svg%3E`,
      audioAssets = new Map<Uint, [Pipe<string>, string]>(),
      imageAssets = new Map<Uint, [Pipe<string>, string]>(),
      getAssetName = (id: Uint, fn: (name: string) => void, assetMap: AssetMap) => {
	const asset = assetMap.get(id) ?? setAndReturn(assetMap, id, [new Pipe(), ""]);
	fn(asset[1]);
	asset[0].receive(fn);
	return () => asset[0].remove(fn);
      },
      uploadAsset = (root: Root, fileType: string, data: FormData, window: WindowElement | ShellElement = shell) => {
	const bar = progress({"style": "width: 100%"}) as HTMLElement;
	return loadingWindow(
		(HTTPRequest(`/${fileType}/`, {
			data,
			"method": "POST",
			"response": "json",
			"onuploadprogress": (e: ProgressEvent) => {
				if (e.lengthComputable) {
					amendNode(bar, {"value": e.loaded, "max": e.total});
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
      },
      createFolders = (rpcFuncs: FolderRPC, root: Root, icon: string, id: string, upload: string, types: string) => {
	const base = div(loading());
	rpcFuncs.list().then(folderList => {
		root.setRPCFuncs(rpcFuncs);
		root.setRoot(folderList);
		root.windowIcon = icon;
		clearNode(base, {"id": `${id}Items`, "class": "folders"}, [
			button({"onclick": () => {
				const f = form({"enctype": "multipart/form-data", "method": "post"}, labels(upload, autoFocus(input({"accept": types, "multiple": "multiple", "name": "asset", "type": "file", "onchange": function(this: HTMLInputElement) {
					uploadAsset(root, id, new FormData(f), window)
					.then(() => window.remove())
					.catch(handleError)
					.finally(() => this.removeAttribute("disabled"));
					this.toggleAttribute("disabled", true);
				      }})))),
				      window = shell.appendChild(windows({"window-icon": icon, "window-title": upload, "class": "assetAdd"}, [h1(upload), f]));
			}}, upload),
			root[node]
		]);
	});
	return base;
      };

export const audioAssetName = (id: Uint, fn: (name: string) => void) => getAssetName(id, fn, audioAssets),
imageAssetName = (id: Uint, fn: (name: string) => void) => getAssetName(id, fn, imageAssets),
uploadImages = uploadAsset.bind(null, imageRoot, "images"),
uploadAudio = uploadAsset.bind(null, audioRoot, "audio");

register("imageAsset", [imageIcon, lang["TAB_IMAGES"]]);
register("audioAsset", [audioIcon, lang["TAB_AUDIO"]]);

menuItems.push(
	[0, () => isAdmin ? [lang["TAB_IMAGES"], createFolders(rpc["images"], imageRoot, imageIcon, "images", lang["UPLOAD_IMAGES"], "image/gif, image/png, image/jpeg, image/webp"), true, imageIcon] : null],
	[1, () => isAdmin ? [lang["TAB_AUDIO"], createFolders(rpc["audio"], audioRoot, audioIcon, "audio", lang["UPLOAD_AUDIO"], "application/ogg, audio/mpeg"), true, audioIcon] : null]
);
