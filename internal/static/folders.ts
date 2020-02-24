import {Int, FolderRPC, FolderItems, FromTo, IDName, LayerType} from './types.js';
import {createHTML, clearElement} from './lib/html.js';
import {br, button, div, h1, input, label, li, option, span, select, ul} from './lib/dom.js';
import {HTTPRequest} from './lib/conn.js';
import {showError, enterKey} from './misc.js';
import {SortHTML, stringSort} from './lib/ordered.js';

export interface Item {
	id:     Int;
	name:   string;
	parent: Folder;
	html:   HTMLElement;
}

interface ItemConstructor {
	new (parent: Folder, id: Int, name: string): Item;
}

const stringSorter = (a: Item | Folder, b: Item | Folder) => stringSort(a.name, b.name),
      idSorter = (a: Item, b: Item) => b.id - a.id;

export const getPaths = (folder: Folder, breadcrumb: string): string[] => [breadcrumb].concat(...folder.folders.flatMap(p => getPaths(p, breadcrumb + p.name + "/")));

let folderID = 0;

export class Folder {
	parent: Folder | null;
	name: string;
	html: HTMLElement;
	folders = new SortHTML<Folder>(ul(), stringSorter);
	items = new SortHTML<Item>(ul(), stringSorter);
	root: Root;
	constructor(root: Root, parent: Folder | null, name: string, folders: Record<string, FolderItems>, items: Record<string, Int>) {
		this.root = root;
		this.parent = parent;
		this.name = name;
		const self = this;
		this.html = li([
			input({"type": "checkbox", "class": "expander", "id": `folder_${folderID}`}),
			label({"for": `folder_${folderID++}`}, name),
			span("~", {"class": "renameFolder", "onclick": () => {
				const overlay = root.overlay,
				      oldPath = self.getPath() + "/",
				      parentPath = parent ? parent.getPath() + "/" : "/",
				      paths: HTMLOptionElement[] = [],
				      parents = select({"id": "folderName"}, getPaths(root.folder, "/").filter(p => !p.startsWith(oldPath)).map(p => option(p, Object.assign({"value": p}, p === parentPath ? {"selected": "selected"} : {})))),
				      newName = input({"type": "text", "value": self.name});
				return createHTML(overlay.addLayer(), {"class": "renameFolder"}, [
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
				const overlay = root.overlay,
				      path = self.getPath(),
				      pathDiv = div(path);
				return createHTML(overlay.addLayer(), {"class": "folderRemove"}, [
					h1("Remove Folder"),
					div("Remove the following folder? NB: This will remove all folders and items it contains."),
					pathDiv,
					button("Yes, Remove!", {"onclick": () => overlay.loading(root.rpcFuncs.removeFolder(path)).then(() => {
						root.removeFolder(path);
						overlay.removeLayer();
					}).catch(e => showError(pathDiv, e))}),
					button("Cancel", {"onclick": overlay.removeLayer})
				]);
			}}),
			span("+", {"class": "addFolder", "onclick": () => {
				const overlay = root.overlay,
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
			this.items.html
		]);
		Object.entries(folders).forEach(([name, f]) => this.folders.push(new Folder(root, this, name, f.folders, f.items)));
		Object.entries(items).forEach(([name, iid]) => this.items.push(new this.root.newType(this, iid, name)));
	}
	addItem(id: Int, name: string) {
		if (!this.getItem(name)) {
			this.items.push(new this.root.newType(this, id, name));
		}
	}
	getItem(name: string) {
		return this.items.filter(i => i.name === name).pop();
	}
	removeItem(name: string) {
		const index = this.items.findIndex(i => i.name === name);
		if (index !== -1) {
			return this.items.splice(index, 1).pop()!.id;
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
		const f = new Folder(this.root, this, name, {}, {});
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
		for (let f: Folder | null = this; f; f = f.parent) breadcrumbs.push(f.name);
		return breadcrumbs.reverse().join("/");
	}
}


export class Root {
	folder: Folder;
	fileType: String
	overlay: LayerType;
	rpcFuncs: FolderRPC;
	newType: ItemConstructor;
	html: HTMLElement;
	constructor (rootFolder: FolderItems, fileType: string, rpcFuncs: FolderRPC, overlay: LayerType, newType: ItemConstructor) {
		//super(null as unknown as Folder, fileType, rootFolder.folders, rootFolder.items); // Deliberate Type hack
		this.newType = newType;
		this.fileType = fileType;
		this.overlay = overlay;
		this.rpcFuncs = rpcFuncs;
		this.folder = new Folder(this, null, "", rootFolder.folders, rootFolder.items); // Deliberate Type hack
		this.html = div([
			fileType,
			Array.from(this.folder.html.childNodes).slice(-3)
		]);
	}
	get root() {
		return this;
	}
	resolvePath(path: string): [Folder | undefined, string] {
		const breadcrumbs = path.split("/"),
		      sub: string | undefined  = breadcrumbs.pop();
		let folder: Folder | undefined = this.folder;
		breadcrumbs.every(f => f == "" ? true : folder = folder!.getFolder(f));
		return [folder, sub || ""];
	}
	addItem(id: Int, path: string) {
		const [folder, name] = this.resolvePath(path);
		if (folder) {
			folder.addItem(id, name);
		}
	}
	getItem(path: string) {
		const [folder, name] = this.resolvePath(path);
		if (folder) {
			return folder.getItem(name);
		}
		return undefined;
	}
	moveItem(from: string, to: string) {
		this.addItem(this.removeItem(from), to);
	}
	removeItem(path: string) {
		const [folder, name] = this.resolvePath(path);
		if (folder) {
			return folder.removeItem(name);
		}
		return -1;
	}
	addFolder(path: string) {
		const parts = path.split("/");
		let f = this.folder.addFolder(parts.shift()!);
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
			f.items.forEach(i => {
				i.parent = t;
				t.items.push(i)
			});
			return f;
		}
	}
	removeFolder(path: string) {
		const [folder, name] = this.resolvePath(path);
		if (folder) {
			return folder.removeFolder(name);
		}
	}
}

export default function (rpc: FolderRPC, overlay: LayerType, base: Node, fileType: string, newType: ItemConstructor, newItem: (root: Root) => void) {
	return rpc.list().then(rootFolder => {
		const root = new Root(rootFolder, fileType, rpc, overlay, newType);
		rpc.waitAdded().then(items => items.forEach(({id, name}) => root.addItem(id, name)));
		rpc.waitMoved().then(({from, to}) => root.moveItem(from, to));
		rpc.waitRemoved().then(item => root.removeItem(item));
		rpc.waitLinked().then(({id, name}) => root.addItem(id, name));
		rpc.waitFolderAdded().then(folder => root.addFolder(folder));
		rpc.waitFolderMoved().then(({from, to}) => root.moveFolder(from, to));
		rpc.waitFolderRemoved().then(folder => root.removeFolder(folder));
		createHTML(clearElement(base), {"id": fileType + "Items"}, [
			button(`Upload ${fileType}`, {"onclick": () => newItem(root)}),
			root.html
		]);
		return root;
	});
};
