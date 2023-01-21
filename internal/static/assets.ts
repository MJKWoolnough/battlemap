import type {FolderItems, FolderRPC, IDName, Uint} from './types.js';
import type {Bind} from './lib/dom.js';
import type {ShellElement, WindowElement} from './windows.js';
import {HTTPRequest} from './lib/conn.js';
import {add, ids} from './lib/css.js';
import {amendNode, clearNode} from './lib/dom.js';
import {DragFiles, DragTransfer} from './lib/drag.js';
import {audio, button, div, form, h1, img, input, progress} from './lib/html.js';
import {Pipe} from './lib/inter.js';
import {autoFocus, setAndReturn} from './lib/misc.js';
import {node} from './lib/nodes.js';
import {ns as svgNS} from './lib/svg.js';
import {DragFolder, DraggableItem, Folder, Root} from './folders.js';
import {dragOver, folderDragging, folders} from './ids.js';
import lang from './language.js';
import {bbcodeDrag, register} from './messaging.js';
import {handleError, inited, isAdmin, rpc} from './rpc.js';
import {labels, loading, menuItems} from './shared.js';
import {shareStr} from './symbols.js';
import {loadingWindow, shell, windows} from './windows.js';

class ImageAsset extends DraggableItem {
	#bbcodeID: string;
	constructor(parent: Folder, id: Uint, name: string) {
		super(parent, id, name, dragImage, true);
		amendNode(this.image, {"src": `/images/${id}`});
		this.#bbcodeID = bbcodeDrag.register(() => () => `[img]/images/${id}[/img]`);
	}
	show() {
		const w = windows({"window-icon": imageIcon, "window-title": this.name, "hide-minimise": false, "class": showAsset}, img({"src": `/images/${this.id}`, "draggable": "true", "ondragstart": this}));
		w.addControlButton(shareStr, () => rpc.broadcastWindow("imageAsset", 0, `[img=100%]/images/${this.id}[/img]`), lang["SHARE"]);
		amendNode(shell, w);
		return w;
	}
	ondragstart(e: DragEvent) {
		super.ondragstart(e);
		if (!e.defaultPrevented) {
			bbcodeDrag.set(e, this.#bbcodeID);
		}
	}
	delete() {
		bbcodeDrag.deregister(this.#bbcodeID);
	}
}

class AudioAsset extends DraggableItem {
	#bbcodeID: string;
	constructor(parent: Folder, id: Uint, name: string) {
		super(parent, id, name, dragAudio);
		amendNode(this.image, {"src": audioIcon});
		this.#bbcodeID = bbcodeDrag.register(() => () => `[audio]/images/${id}[/audio]`);
	}
	show() {
		const w = windows({"window-icon": audioIcon, "window-title": this.name, "hide-minimise": false, "class": showAsset}, audio({"src": `/audio/${this.id}`, "controls": "controls", "draggable": "true", "ondragstart": this}));
		w.addControlButton(shareStr, () => rpc.broadcastWindow("audioAsset", 0, `[audio]/audio/${this.id}[/audio]`), lang["SHARE"]);
		amendNode(shell, w);
		return w;
	}
	ondragstart(e: DragEvent) {
		super.ondragstart(e);
		if (!e.defaultPrevented) {
			bbcodeDrag.set(e, this.#bbcodeID);
		}
	}
	delete() {
		bbcodeDrag.deregister(this.#bbcodeID);
	}
}

type AssetMap = Map<Uint, [Pipe<string>, string]>;

abstract class AssetFolder<T extends ImageAsset | AudioAsset> extends DragFolder<T> {
	#dragUpload: DragFiles;
	#upload: (data: FormData, shell: ShellElement, path: string) => void;
	constructor(root: Root, parent: Folder | null, name: string, children: FolderItems, dragTransfer: DragTransfer<T>, dragFolder: DragTransfer<Folder>, dragUpload: DragFiles, upload: (data: FormData, shell: ShellElement, path: string) => void) {
		super(root, parent, name, children, dragTransfer, dragFolder);
		this.#dragUpload = dragUpload;
		this.#upload = upload;
		for (const name in children.items) {
			this.#registerItem(children.items[name], name);
		}
	}
	abstract assetMap(): AssetMap;
	#registerItem(id: Uint, name: string) {
		const am = this.assetMap(),
		      v = am.get(id);
		if (v) {
			v[0].send(v[1] = name);
		} else {
			am.set(id, [new Pipe(), name]);
		}
	}
	addItem(id: Uint, name: string) {
		this.#registerItem(id, name);
		return super.addItem(id, name);
	}
	ondragenter(e: DragEvent) {
		super.ondragenter(e);
		if (this.#dragUpload.is(e)) {
			amendNode(this[node], {"class": [dragOver]});
			amendNode(this.root[node], {"class": [folderDragging]});
		}
	}
	ondragover(e: DragEvent) {
		super.ondragover(e);
		if (this.#dragUpload.is(e)) {
			e.preventDefault();
			e.dataTransfer.dropEffect = "copy";
		}
	}
	ondrop(e: DragEvent) {
		super.ondrop(e);
		if (this.#dragUpload.is(e)) {
			this.#upload(this.#dragUpload.asForm(e, "asset"), shell, this.getPath());
		}
	}
}

class AudioFolder extends AssetFolder<AudioAsset> {
	constructor(root: Root, parent: Folder | null, name: string, children: FolderItems) {
		super(root, parent, name, children, dragAudio, dragAudioFolder, dragAudioFiles, uploadAudio);
	}
	assetMap() { return audioAssets; }
}

class ImageFolder extends AssetFolder<ImageAsset> {
	constructor(root: Root, parent: Folder | null, name: string, children: FolderItems) {
		super(root, parent, name, children, dragImage, dragImageFolder, dragImageFiles, uploadImages);
	}
	assetMap() { return imageAssets; }
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
      uploadAsset = (root: Root, fileType: string, data: FormData, window: WindowElement | ShellElement = shell, path = "/") => {
	const bar = progress({"style": "width: 100%"});
	return loadingWindow(
		HTTPRequest<IDName[]>(`/${fileType}/?path=${encodeURIComponent(path)}`, {
			data,
			"method": "POST",
			"response": "json",
			"onuploadprogress": (e: ProgressEvent) => {
				if (e.lengthComputable) {
					clearNode(bar, {"value": e.loaded, "max": e.total}, Math.floor(e.loaded*100/e.total) + "%");
				}
			}
		}).then((assets: IDName[]) => {
			for (const {id, name} of assets) {
				root.addItem(id, name);
			}
			return assets;
		}),
		window,
		lang["UPLOADING"],
		div([
			div(lang["UPLOADING"]),
			bar
		])
	);
      },
      createFolders = (rpcFuncs: FolderRPC, root: Root, icon: string, id: string, upload: Bind, types: DragFiles) => {
	const base = div(loading()),
	      accept = types.mimes.join(", ");
	rpcFuncs.list().then(folderList => {
		root.setRPCFuncs(rpcFuncs);
		root.setRoot(folderList);
		root.windowIcon = icon;
		clearNode(base, {"class": `${assets} ${folders}`}, [
			button({"onclick": () => {
				const file = input({accept, "multiple": "multiple", "name": "asset", "type": "file", "onchange": () => {
					uploadAsset(root, id, new FormData(f), w)
					.then(() => w.remove())
					.catch(handleError)
					.finally(() => amendNode(file, {"disabled": false}));
					amendNode(file, {"disabled": true});
				      }}),
				      f = form({"enctype": "multipart/form-data", "method": "post"}, labels(upload, file)),
				      w = windows({"window-icon": icon, "window-title": upload}, [h1(upload), f]);
				amendNode(shell, w);
				autoFocus(file);
			}}, upload),
			root[node]
		]);
	});
	return base;
      },
      dragImageFolder = new DragTransfer<ImageFolder>("imagefolder"),
      dragAudioFolder = new DragTransfer<ImageFolder>("audiofolder"),
      [assets, showAsset] = ids(2);

export const audioAssetName = (id: Uint, fn: (name: string) => void) => getAssetName(id, fn, audioAssets),
imageAssetName = (id: Uint, fn: (name: string) => void) => getAssetName(id, fn, imageAssets),
uploadImages = uploadAsset.bind(null, imageRoot, "images"),
uploadAudio = uploadAsset.bind(null, audioRoot, "audio"),
dragImageFiles = new DragFiles("image/gif", "image/png", "image/jpeg", "image/webp", "video/apng"),
dragAudioFiles = new DragFiles("application/ogg", "audio/mpeg"),
dragAudio = new DragTransfer<AudioAsset>("audioasset"),
dragImage = new DragTransfer<ImageAsset>("imageasset");

register("imageAsset", [imageIcon, lang["TAB_IMAGES"]]);
register("audioAsset", [audioIcon, lang["TAB_AUDIO"]]);

menuItems.push(
	[0, () => isAdmin ? [lang["TAB_IMAGES"], createFolders(rpc["images"], imageRoot, imageIcon, "images", lang["UPLOAD_IMAGES"], dragImageFiles), true, imageIcon] : null],
	[1, () => isAdmin ? [lang["TAB_AUDIO"], createFolders(rpc["audio"], audioRoot, audioIcon, "audio", lang["UPLOAD_AUDIO"], dragAudioFiles), true, audioIcon] : null]
);

inited.then(() => {
	if (isAdmin) {
		add({
			[`.${assets}`]: {
				" ul": {
					"margin": 0,
					"padding-left": "calc(1em + 4px)",
					"list-style": "none"
				},
				">div>ul": {
					"padding-left": 0
				}
			},
			[`.${showAsset}`]: {
				"max-height": "100%",
				"max-width": "100%",
				"min-height": "10px",
				"overflow": "clip",
				" img": {
					"max-height": "calc(100vh - 20px)",
					"max-width": "calc(100vw - 1em - 6px)"
				}
			}
		});
	}
});
