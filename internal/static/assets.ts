import {Int, RPC, AssetRPC, Folder, FromTo, IDName} from './types.js';
import {createHTML, clearElement} from './lib/html.js';
import {HTTPRequest} from './lib/conn.js';
import {LayerType} from './lib/layers.js';
import {showError, enterKey} from './misc.js';
import SortHTML, {SortHTMLType} from './lib/ordered.js';

const sortStrings = new Intl.Collator().compare,
      stringSorter = (a: Asset | AssetFolder, b: Asset | AssetFolder) => sortStrings(a.name, b.name),
      idSorter = (a: Asset, b: Asset) => b.id - a.id;

let folderID = 0;

class Asset {
	parent: AssetFolder;
	folder: AssetFolder;
	id: Int;
	name: string
	html: Node;
	constructor(parent: AssetFolder, folder: AssetFolder, id: Int, name: string) {
		this.id = id;
		this.name = name;
		this.html = createHTML("li", name);
		this.parent = parent;
		this.folder = folder;
	}
	get root() {
		return this.parent.root;
	}
}

class AssetFolder {
	parent: AssetFolder;
	name: string;
	html: Node;
	folders: SortHTMLType<AssetFolder>;
	assets: SortHTMLType<Asset>;
	constructor(parent: AssetFolder, name: string, folders: Record<string, Folder>, assets: Record<string, Int>) {
		this.parent = parent;
		this.name = name;
		this.folders = SortHTML(createHTML("ul"), stringSorter);
		this.assets = SortHTML(createHTML("ul"), stringSorter);
		const self = this;
		this.html = createHTML("li", [
			createHTML("input", {"type": "checkbox", "class": "expander", "id": `folder_${folderID}`}),
			createHTML("label", {"for": `folder_${folderID++}`}, name),
			createHTML("span", "~", {"class": "renameFolder", "onclick": () => {
				const root = self.root,
				      overlay = root.overlay,
				      oldPath = self.getPath() + "/",
				      parentPath = self.parent.getPath() + "/",
				      paths: HTMLOptionElement[] = [],
				      addPaths = (folder: AssetFolder, breadcrumb: string) => {
					if (breadcrumb === oldPath) {
						return;
					}
					paths.push(createHTML("option", Object.assign({"value": breadcrumb}, parentPath === breadcrumb ? {"selected": "selected"} : {}), breadcrumb));
					folder.folders.forEach(p => addPaths(p, breadcrumb + p.name + "/"));
				      },
				      parents = createHTML("select", {"id": "folderName"}, (addPaths(self.root, "/"), paths)),
				      newName = createHTML("input", {"type": "text", "value": self.name});
				return createHTML(root.overlay.addLayer(), {"class": "renameFolder"}, [
					createHTML("h1", "Move Folder"),
					createHTML("div", `Old Location: ${oldPath.slice(0, -1)}`),
					createHTML("label", {"for": "folderName"}, "New Location: "),
					parents,
					newName,
					createHTML("br"),
					createHTML("button", "Move", {"onclick": () => overlay.loading(root.rpcFuncs.moveFolder(oldPath, parents.value + newName.value)).then(newPath => {
						root.moveFolder(oldPath.slice(0, -1), newPath);
						overlay.removeLayer();
					}).catch(e => showError(newName, e))}),
					createHTML("button", "Cancel", {"onclick": overlay.removeLayer})
				])
			}}),
			createHTML("span", "-", {"class": "removeFolder", "onclick": () => {
				const root = self.root,
				      overlay = root.overlay,
				      path = self.getPath(),
				      pathDiv = createHTML("div", path);
				return createHTML(overlay.addLayer(), {"class": "folderRemove"}, [
					createHTML("h1", "Remove Folder"),
					createHTML("div", "Remove the following folder? NB: This will remove all folders and assets it contains."),
					pathDiv,
					createHTML("button", "Yes, Remove!", {"onclick": () => overlay.loading(root.rpcFuncs.removeFolder(path)).then(() => {
						root.removeFolder(path);
						overlay.removeLayer();
					}).catch(e => showError(pathDiv, e))}),
					createHTML("button", "Cancel", {"onclick": overlay.removeLayer})
				]);
			}}),
			createHTML("span", "+", {"class": "addFolder", "onclick": () => {
				const root = self.root,
				      overlay = root.overlay,
				      path = self.getPath(),
				      folderName = createHTML("input", {"id": "folderName", "onkeypress": enterKey});
				return createHTML(overlay.addLayer(), {"class": "folderAdd"}, [
					createHTML("h1", "Add Folder"),
					createHTML("label", {"for": "folderName"}, `Folder Name: ${path + "/"}`),
					folderName,
					createHTML("br"),
					createHTML("button", "Add Folder", {"onclick": () => overlay.loading(root.rpcFuncs.createFolder(path + folderName.value)).then(folder => {
						root.addFolder(folder);
						overlay.removeLayer();
					}).catch(e => showError(folderName, e))}),
					createHTML("button", "Cancel", {"onclick": overlay.removeLayer})
				]);
			}}),
			this.folders.html,
			this.assets.html
		]);
		Object.entries(folders).forEach(([name, f]) => this.folders.push(new AssetFolder(this, name, f.folders, f.assets)));
		Object.entries(assets).forEach(([name, aid]) => this.assets.push(new Asset(this, this, aid, name)));
	}
	get root(): Root {
		return this.parent.root;
	}
	addAsset(id: Int, name: string) {
		if (!this.getAsset(name)) {
			this.assets.push(new Asset(this.root, this, id, name));
		}
	}
	getAsset(name: string) {
		return this.assets.filter(a => a.name === name).pop();
	}
	removeAsset(name: string) {
		const index = this.assets.findIndex(a => a.name === name);
		if (index !== -1) {
			return (this.assets.splice(index, 1).pop() as Asset).id;
		}
		return -1;
	}
	addFolder(name: string) {
		if (name === "") {
			return this;
		}
		const existing = this.getFolder(name);
		if (existing) {
			return existing;
		}
		const f = new AssetFolder(this, name, {}, {});
		this.folders.push(f);
		return f;
	}
	getFolder(name: string) {
		return this.folders.filter(f => f.name === name).pop();
	}
	removeFolder(name: string) {
		const index = this.folders.findIndex(f => f.name === name);
		if (index !== -1) {
			return this.folders.splice(index, 1).pop();
		}
	}
	getPath() {
		const breadcrumbs = [];
		for (let f: AssetFolder = this; f; f = f.parent) breadcrumbs.push(f.name);
		return breadcrumbs.reverse().join("/");
	}
}


class Root extends AssetFolder {
	fileType: String
	overlay: LayerType;
	rpcFuncs: AssetRPC;
	constructor (rootFolder: Folder, fileType: string, rpcFuncs: AssetRPC, overlay: LayerType) {
		super({} as AssetFolder, fileType, rootFolder.folders, rootFolder.assets); // Deliberate Type hack
		this.parent = null as unknown as AssetFolder; // Deliberate Type hack!
		this.name = "";
		this.assets.sort(idSorter);
		this.fileType = fileType;
		this.html = createHTML("div", [
			fileType,
			Array.from(this.html.childNodes).slice(-3)
		]);
		this.overlay = overlay;
		this.rpcFuncs = rpcFuncs;
	}
	get root() {
		return this;
	}
	resolvePath(path: string): [AssetFolder | undefined, string] {
		const breadcrumbs = path.split("/"),
		      sub: string | undefined  = breadcrumbs.pop();
		let folder: AssetFolder | undefined = this;
		breadcrumbs.every(f => f == "" ? true : folder = (folder as AssetFolder).getFolder(f));
		return [folder, sub || ""];
	}
	addAsset(id: Int, path: string) {
		const li = path.lastIndexOf("/");
		if (li < 0) {
			super.addAsset(id, path);
		} else {
			this.addFolder(path.slice(0, li)).addAsset(id, path.slice(li+1));
		}
	}
	getAsset(path: string) {
		const [folder, name] = this.resolvePath(path);
		if (folder === this) {
			return super.getAsset(name);
		} else if (folder) {
			return folder.getAsset(name);
		}
		return undefined;
	}
	moveAsset(from: string, to: string) {
		this.addAsset(this.removeAsset(from), to);
	}
	removeAsset(path: string) {
		const [folder, name] = this.resolvePath(path);
		if (folder === this) {
			super.removeAsset(name);
		} else if (folder) {
			return folder.removeAsset(name);
		}
		return -1;
	}
	addFolder(path: string) {
		const parts = path.split("/");
		let f = super.addFolder(parts.shift() as string);
		parts.forEach(p => {f = f.addFolder(p)});
		return f;
	}
	moveFolder(from: string, to: string) {
		const f = this.removeFolder(from);
		if (f) {
			const t = this.addFolder(to);
			f.folders.forEach(f => t.folders.push(f));
			f.assets.forEach(a => t.assets.push(a));
			return f;
		}
	}
	removeFolder(path: string) {
		const [folder, name] = this.resolvePath(path);
		if (folder === this) {
			super.removeFolder(name);
		} else if (folder) {
			return folder.removeFolder(name);
		}
	}
}

export default function (rpc: RPC, overlay: LayerType, base: Node, fileType: string) {
	const rpcFuncs = fileType == "Audio" ? rpc["audio"] : rpc["images"];
	rpcFuncs.getAssets().then(rootFolder => {
		const root = new Root(rootFolder, fileType, rpcFuncs, overlay);
		rpcFuncs.waitAssetAdded().then(assets => assets.forEach(({id, name}) => root.addAsset(id, name)));
		rpcFuncs.waitAssetMoved().then(({from, to}) => root.moveAsset(from, to));
		rpcFuncs.waitAssetRemoved().then(asset => root.removeAsset(asset));
		rpcFuncs.waitAssetLinked().then(({id, name}) => root.addAsset(id, name));
		rpcFuncs.waitFolderAdded().then(folder => root.addFolder(folder));
		rpcFuncs.waitFolderMoved().then(({from, to}) => root.moveFolder(from, to));
		rpcFuncs.waitFolderRemoved().then(folder => root.removeFolder(folder));
		createHTML(base, {"id": fileType + "Assets"}, [
			createHTML("button", "Upload Asset(s)", {"onclick": () => createHTML(overlay.addLayer(), {"class": "assetAdd"}, [
				createHTML("h1", "Add Assets"),
				createHTML("form", {"enctype": "multipart/form-data", "method": "post"}, [
					createHTML("label", {"for": "addAssets"}, "Add Asset(s)"),
					createHTML("input", {"accept": "image/gif, image/png, image/jpeg, image/webp, application/ogg, audio/mpeg, text/html, text/plain, application/pdf, app ication/postscript", "id": "addAssets", "multiple": "multiple", "name": "asset", "type": "file", "onchange": function(this: Node) {
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
						])).then((assets: IDName[]) => {
							assets.forEach(({id, name}) => root.addAsset(id, name))
							overlay.removeLayer();
						}, showError.bind(null, this));
					}})
				])
			])}),
			root.html
		]);
	});
};
