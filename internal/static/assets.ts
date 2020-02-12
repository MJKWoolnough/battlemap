import {Int, RPC, AssetRPC, Folder, FromTo, IDName, LayerType} from './types.js';
import {createHTML, clearElement} from './lib/html.js';
import {audio, br, button, div, form, h1, img, input, label, li, option, progress, span, select, ul} from './lib/dom.js';
import {HTTPRequest} from './lib/conn.js';
import {showError, enterKey} from './misc.js';
import {sortHTML, stringSort, SortHTMLType} from './lib/ordered.js';

const stringSorter = (a: Asset | AssetFolder, b: Asset | AssetFolder) => stringSort(a.name, b.name),
      idSorter = (a: Asset, b: Asset) => b.id - a.id,
      getPaths = (folder: AssetFolder, breadcrumb: string): string[] => [breadcrumb].concat(...folder.folders.flatMap(p => getPaths(p, breadcrumb + p.name + "/")));

let folderID = 0;

class Asset {
	parent: AssetFolder;
	id: Int;
	name: string
	html: Node;
	constructor(parent: AssetFolder, id: Int, name: string) {
		this.id = id;
		this.name = name;
		const self = this;
		this.html = li([
			span(name, {"class": "asset", "onclick": () => {
				const root = self.root,
				      overlay = root.overlay;
				return createHTML(root.overlay.addLayer(), {"class": "showAsset"}, [
					h1(self.name),
					root.fileType === "Images" ? [
						img({"src": `/images/${self.id}`})
					] : [
						audio({"src": `/audio/${self.id}`, "controls": "controls"})
					]
				]);
			}}),
			span("~", {"class": "assetRename", "onclick": () => {
				const root = self.root,
				      overlay = root.overlay,
				      parentPath = self.parent.getPath() + "/",
				      paths: HTMLOptionElement[] = [],
				      parents = select({"id": "folderName"}, getPaths(self.root, "/").map(p => option(p, Object.assign({"value": p}, p === parentPath ? {"selected": "selected"} : {})))),
				      newName = input({"type": "text", "value": self.name});
				return createHTML(root.overlay.addLayer(), {"class": "renameAsset"}, [
					h1("Move Folder"),
					div(`Old Location: ${parentPath}${self.name}`),
					label({"for": "folderName"}, "New Location: "),
					parents,
					newName,
					br(),
					button("Move", {"onclick": () => overlay.loading(root.rpcFuncs.moveAsset(parentPath + self.name, parents.value + newName.value)).then(newPath => {
						root.moveAsset(parentPath + self.name, newPath);
						overlay.removeLayer();
					}).catch(e => showError(newName, e))}),
					button("Cancel", {"onclick": overlay.removeLayer})
				])

			}}),
			span("+", {"class": "assetLink", "onclick": () => {
				const root = self.root,
				      overlay = root.overlay,
				      parentPath = self.parent.getPath() + "/",
				      paths: HTMLOptionElement[] = [],
				      parents = select({"id": "folderName"}, getPaths(self.root, "/").map(p => option(p, Object.assign({"value": p}, p === parentPath ? {"selected": "selected"} : {})))),
				      newName = input({"type": "text", "value": self.name});
				return createHTML(root.overlay.addLayer(), {"class": "linkAsset"}, [
					h1("Add Link"),
					div(`Current Location: ${parentPath}${self.name}`),
					label({"for": "folderName"}, "New Link: "),
					parents,
					newName,
					br(),
					button("Link", {"onclick": () => overlay.loading(root.rpcFuncs.linkAsset(self.id, parents.value + newName.value)).then(newPath => {
						root.addAsset(self.id, newPath);
						overlay.removeLayer();
					}).catch(e => showError(newName, e))}),
					button("Cancel", {"onclick": overlay.removeLayer})
				])

			}}),
			span("-", {"class": "assetRemove", "onclick": () => {
				const root = self.parent.root,
				      overlay = root.overlay,
				      path = self.parent.getPath() + "/" + self.name,
				      pathDiv = div(path);
				return createHTML(overlay.addLayer(), {"class": "removeAsset"}, [
					h1("Remove Asset"),
					div("Remove the following asset?"),
					pathDiv,
					button("Yes, Remove!", {"onclick": () => overlay.loading(root.rpcFuncs.removeAsset(path)).then(() => {
						root.removeAsset(path);
						overlay.removeLayer();
					}).catch(e => showError(pathDiv, e))}),
					button("Cancel", {"onclick": overlay.removeLayer})
				]);
			}})
		]);
		this.parent = parent;
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
		this.folders = sortHTML(ul(), stringSorter);
		this.assets = sortHTML(ul(), stringSorter);
		const self = this;
		this.html = li([
			input({"type": "checkbox", "class": "expander", "id": `folder_${folderID}`}),
			label({"for": `folder_${folderID++}`}, name),
			span("~", {"class": "renameFolder", "onclick": () => {
				const root = self.root,
				      overlay = root.overlay,
				      oldPath = self.getPath() + "/",
				      parentPath = self.parent.getPath() + "/",
				      paths: HTMLOptionElement[] = [],
				      parents = select({"id": "folderName"}, getPaths(self.root, "/").filter(p => !p.startsWith(oldPath)).map(p => option(p, Object.assign({"value": p}, p === parentPath ? {"selected": "selected"} : {})))),
				      newName = input({"type": "text", "value": self.name});
				return createHTML(root.overlay.addLayer(), {"class": "renameFolder"}, [
					h1("Move Folder"),
					div(`Old Location: ${oldPath.slice(0, -1)}`),
					label({"for": "folderName"}, "New Location: "),
					parents,
					newName,
					br(),
					button("Move", {"onclick": () => overlay.loading(root.rpcFuncs.moveFolder(oldPath, parents.value + newName.value)).then(newPath => {
						root.moveFolder(oldPath.slice(0, -1), newPath);
						overlay.removeLayer();
					}).catch(e => showError(newName, e))}),
					button("Cancel", {"onclick": overlay.removeLayer})
				])
			}}),
			span("-", {"class": "removeFolder", "onclick": () => {
				const root = self.root,
				      overlay = root.overlay,
				      path = self.getPath(),
				      pathDiv = div(path);
				return createHTML(overlay.addLayer(), {"class": "folderRemove"}, [
					h1("Remove Folder"),
					div("Remove the following folder? NB: This will remove all folders and assets it contains."),
					pathDiv,
					button("Yes, Remove!", {"onclick": () => overlay.loading(root.rpcFuncs.removeFolder(path)).then(() => {
						root.removeFolder(path);
						overlay.removeLayer();
					}).catch(e => showError(pathDiv, e))}),
					button("Cancel", {"onclick": overlay.removeLayer})
				]);
			}}),
			span("+", {"class": "addFolder", "onclick": () => {
				const root = self.root,
				      overlay = root.overlay,
				      path = self.getPath(),
				      folderName = input({"id": "folderName", "onkeypress": enterKey});
				return createHTML(overlay.addLayer(), {"class": "folderAdd"}, [
					h1("Add Folder"),
					label({"for": "folderName"}, `Folder Name: ${path + "/"}`),
					folderName,
					br(),
					button("Add Folder", {"onclick": () => overlay.loading(root.rpcFuncs.createFolder(path + folderName.value)).then(folder => {
						root.addFolder(folder);
						overlay.removeLayer();
					}).catch(e => showError(folderName, e))}),
					button("Cancel", {"onclick": overlay.removeLayer})
				]);
			}}),
			this.folders.html,
			this.assets.html
		]);
		Object.entries(folders).forEach(([name, f]) => this.folders.push(new AssetFolder(this, name, f.folders, f.assets)));
		Object.entries(assets).forEach(([name, aid]) => this.assets.push(new Asset(this, aid, name)));
	}
	get root(): Root {
		return this.parent.root;
	}
	addAsset(id: Int, name: string) {
		if (!this.getAsset(name)) {
			this.assets.push(new Asset(this, id, name));
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
		super(null as unknown as AssetFolder, fileType, rootFolder.folders, rootFolder.assets); // Deliberate Type hack
		this.name = "";
		this.assets.sort(idSorter);
		this.fileType = fileType;
		this.html = div([
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
		const [folder, name] = this.resolvePath(path);
		if (folder === this) {
			super.addAsset(id, name);
		} else if (folder) {
			folder.addAsset(id, name);
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
			return super.removeAsset(name);
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
			f.folders.forEach(f => {
				f.parent = t;
				t.folders.push(f);
			});
			f.assets.forEach(a => {
				a.parent = t;
				t.assets.push(a)
			});
			return f;
		}
	}
	removeFolder(path: string) {
		const [folder, name] = this.resolvePath(path);
		if (folder === this) {
			return super.removeFolder(name);
		} else if (folder) {
			return folder.removeFolder(name);
		}
	}
}

export default function (rpc: RPC, overlay: LayerType, base: Node, fileType: "Images" | "Audio") {
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
		createHTML(clearElement(base), {"id": fileType + "Assets"}, [
			button(`Upload ${fileType}`, {"onclick": () => createHTML(overlay.addLayer(), {"class": "assetAdd"}, [
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
							Object.entries(assets).forEach(([name, id]) => root.addAsset(id, name))
							overlay.removeLayer();
						}, showError.bind(null, this));
					}})
				])
			])}),
			root.html
		]);
	});
};
