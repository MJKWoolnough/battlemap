import {Int, FolderRPC, FolderItems, FromTo, IDName} from './types.js';
import {createHTML, clearElement} from './lib/html.js';
import {br, button, div, h1, input, label, li, option, span, select, ul} from './lib/dom.js';
import {HTTPRequest} from './lib/conn.js';
import {Shell} from './windows.js';
import {showError, enterKey, autoFocus} from './misc.js';
import {SortHTML, stringSort} from './lib/ordered.js';

interface ItemConstructor {
	new (parent: Folder, id: Int, name: string): Item;
}

interface FolderConstructor {
	new (root: Root, parent: Folder | null, name: string, children: FolderItems): Folder;
}

export type FolderSorter = (a: Folder, b: Folder) => number;
export type ItemSorter = (a: Item, b: Item) => number;
export type Sorter = (a: Item | Folder, b: Item | Folder) => number;

const stringSorter = (a: Item | Folder, b: Item | Folder) => stringSort(a.name, b.name),
      idSorter = (a: Item, b: Item) => b.id - a.id,
      sorts = new WeakMap<FolderSorter, WeakMap<ItemSorter, Sorter>>();

export const getPaths = (folder: Folder, breadcrumb: string): string[] => [breadcrumb].concat(...folder.folders.flatMap(p => getPaths(p, breadcrumb + p.name + "/"))), windowOptions = {
	"showTitlebar": true,
	"showClose": true
};

let folderID = 0;

export class Item {
	id: Int;
	name: string;
	parent: Folder;
	html: HTMLElement;
	constructor(parent: Folder, id: Int, name: string) {
		this.id = id;
		this.name = name;
		this.parent = parent;
		this.html = li([
			span(name, {"class": "item", "onclick": this.show.bind(this)}),
			span("~", {"class": "itemRename", "onclick": this.rename.bind(this)}),
			span("+", {"class": "itemLink", "onclick": this.link.bind(this)}),
			span("-", {"class": "itemRemove", "onclick": this.remove.bind(this)}),
		]);
	}
	show() {}
	rename() {
		const root = this.parent.root,
		      shell = root.shell,
		      parentPath = this.parent.getPath() + "/",
		      paths: HTMLOptionElement[] = [],
		      parents = select({"id": "folderName"}, getPaths(root.folder, "/").map(p => option(p, Object.assign({"value": p}, p === parentPath ? {"selected": "selected"} : {})))),
		      newName = autoFocus(input({"type": "text", "value": this.name})),
		      window = shell.addWindow("Move Item", windowOptions);
		return createHTML(window, {"class": "renameItem"}, [
			h1("Move Item"),
			div(`Old Location: ${parentPath}${this.name}`),
			label({"for": "folderName"}, "New Location: "),
			parents,
			newName,
			br(),
			button("Move", {"onclick": () => shell.addLoading(window, root.rpcFuncs.move(parentPath + this.name, parents.value + newName.value)).then(newPath => {
				root.moveItem(parentPath + this.name, newPath);
				shell.removeWindow(window);
			}).catch(e => showError(newName, e))})
		]);
	}
	link() {
		const root = this.parent.root,
		      shell = root.shell,
		      parentPath = this.parent.getPath() + "/",
		      paths: HTMLOptionElement[] = [],
		      parents = select({"id": "folderName"}, getPaths(root.folder, "/").map(p => option(p, Object.assign({"value": p}, p === parentPath ? {"selected": "selected"} : {})))),
		      newName = autoFocus(input({"type": "text", "value": this.name})),
		      window = shell.addWindow("Link Item", windowOptions);
		return createHTML(window, {"class": "linkItem"}, [
			h1("Add Link"),
			div(`Current Location: ${parentPath}${this.name}`),
			label({"for": "folderName"}, "New Link: "),
			parents,
			newName,
			br(),
			button("Link", {"onclick": () => shell.addLoading(window, root.rpcFuncs.link(this.id, parents.value + newName.value)).then(newPath => {
				root.addItem(this.id, newPath);
				shell.removeWindow(window);
			}).catch(e => showError(newName, e))}),
		]);
	}
	remove() {
		const root = this.parent.root,
		      shell = root.shell,
		      path = this.getPath(),
		      pathDiv = div(path),
		      window = shell.addWindow("Remove Item", windowOptions);
		return createHTML(window, {"class": "removeItem"}, [
			h1("Remove Item"),
			div("Remove the following item?"),
			pathDiv,
			autoFocus(button("Yes, Remove!", {"onclick": () => shell.addLoading(window, root.rpcFuncs.remove(path)).then(() => {
				root.removeItem(path);
				shell.removeWindow(window);
			}).catch(e => showError(pathDiv, e))}))
		]);
	}
	getPath() {
		return this.parent.getPath() + "/" + this.name;
	}
}

export class Folder {
	parent: Folder | null;
	name: string;
	html: HTMLElement;
	children: SortHTML<Folder | Item>;
	root: Root;
	constructor(root: Root, parent: Folder | null, name: string, children: FolderItems) {
		this.root = root;
		this.parent = parent;
		this.children = new SortHTML<Folder>(ul({"class": "folders"}), this.sorter);
		this.name = name;
		this.html = li([
			input({"type": "checkbox", "class": "expander", "id": `folder_${folderID}`}),
			label({"for": `folder_${folderID++}`}, name),
			span("~", {"class": "renameFolder", "onclick": this.rename.bind(this)}),
			span("-", {"class": "removeFolder", "onclick": this.remove.bind(this)}),
			span("+", {"class": "addFolder", "onclick": this.newFolder.bind(this)}),
			this.children.html,
		]);
		Object.entries(children.folders).forEach(([name, f]) => this.children.push(new this.root.newFolder(root, this, name, f)));
		Object.entries(children.items).forEach(([name, iid]) => this.children.push(new this.root.newItem(this, iid, name)));
	}
	get folderSorter() {
		return stringSorter;
	}
	get itemSorter() {
		if (this.parent === null) {
			return idSorter;
		}
		return stringSorter;
	}
	get sorter() {
		const fs = this.folderSorter,
		      is = this.itemSorter,
		      m = sorts.get(fs);
		if (m) {
			const fn = m.get(is);
			if (fn) {
				return fn;
			}
		}
		const fn =  (a: Item | Folder, b: Item | Folder) => {
			if (a instanceof Folder) {
				if (b instanceof Folder) {
					return fs(a, b);
				}
				return -1;
			} else if (b instanceof Folder) {
				return 1;
			}
			return is(a, b);
		};
		if (m) {
			m.set(is, fn);
		} else {
			sorts.set(fs, new WeakMap<ItemSorter, Sorter>([[is, fn]]));
		}
		return fn;
	}
	get folders() {
		return this.children.filter(c => c instanceof Folder) as Folder[];
	}
	get items() {
		return this.children.filter(c => c instanceof Item) as Item[];
	}
	rename() {
		const root = this.root,
		      shell = root.shell,
		      oldPath = this.getPath() + "/",
		      parentPath = this.parent ? this.parent.getPath() + "/" : "/",
		      paths: HTMLOptionElement[] = [],
		      parents = select({"id": "folderName"}, getPaths(root.folder, "/").filter(p => !p.startsWith(oldPath)).map(p => option(p, Object.assign({"value": p}, p === parentPath ? {"selected": "selected"} : {})))),
		      newName = autoFocus(input({"type": "text", "value": self.name})),
		      window = shell.addWindow("Move Folder", windowOptions);
		return createHTML(window, {"class": "renameFolder"}, [
			h1("Move Folder"),
			div(`Old Location: ${oldPath.slice(0, -1)}`),
			label({"for": "folderName"}, "New Location: "),
			parents,
			newName,
			br(),
			button("Move", {"onclick": () => shell.addLoading(window, root.rpcFuncs.moveFolder(oldPath, parents.value + "/" + newName.value)).then(newPath => {
				root.moveFolder(oldPath.slice(0, -1), newPath);
				shell.removeWindow(window);
			}).catch(e => showError(newName, e))})
		])
	}
	remove() {
		const root = this.root,
		      shell = root.shell,
		      path = this.getPath(),
		      pathDiv = div(path),
		      window = shell.addWindow("Remove Folder", windowOptions);
		return createHTML(window, {"class": "folderRemove"}, [
			h1("Remove Folder"),
			div("Remove the following folder? NB: This will remove all folders and items it contains."),
			pathDiv,
			autoFocus(button("Yes, Remove!", {"onclick": () => shell.addLoading(window, root.rpcFuncs.removeFolder(path)).then(() => {
				root.removeFolder(path);
				shell.removeWindow(window);
			}).catch(e => showError(pathDiv, e))}))
		]);
	}
	newFolder() {
		const root = this.root,
		      shell = root.shell,
		      path = this.getPath(),
		      folderName = autoFocus(input({"id": "folderName", "onkeypress": enterKey})),
		      window = shell.addWindow("Add Folder", windowOptions);
		return createHTML(window, {"class": "folderAdd"}, [
			h1("Add Folder"),
			label({"for": "folderName"}, `Folder Name: ${path + "/"}`),
			folderName,
			br(),
			button("Add Folder", {"onclick": () => shell.addLoading(window, root.rpcFuncs.createFolder(path + "/" + folderName.value)).then(folder => {
				root.addFolder(folder);
				shell.removeWindow(window);
			}).catch(e => showError(folderName, e))})
		]);
	}
	addItem(id: Int, name: string) {
		if (!this.getItem(name)) {
			this.children.push(new this.root.newItem(this, id, name));
		}
	}
	getItem(name: string) {
		return this.items.filter(i => i.name === name).pop();
	}
	removeItem(name: string) {
		const index = this.items.findIndex(i => i.name === name && i instanceof Item);
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
		const f = new this.root.newFolder(this.root, this, name, {folders: {}, items: {}});
		this.children.push(f);
		return f;
	}
	getFolder(name: string) {
		return this.folders.filter(f => f.name === name).pop();
	}
	removeFolder(name: string) {
		const index = this.children.findIndex(f => f.name === name && f instanceof Folder);
		if (index !== -1) {
			return this.children.splice(index, 1).pop() as Folder;
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
	shell: Shell;
	rpcFuncs: FolderRPC;
	newItem: ItemConstructor;
	newFolder: FolderConstructor;
	html: HTMLElement;
	constructor (rootFolder: FolderItems, fileType: string, rpcFuncs: FolderRPC, shell: Shell, newItem: ItemConstructor = Item, newFolder: FolderConstructor = Folder) {
		this.newItem = newItem;
		this.newFolder = newFolder;
		this.fileType = fileType;
		this.shell = shell;
		this.rpcFuncs = rpcFuncs;
		this.folder = new newFolder(this, null, "", rootFolder);
		this.html = div([
			fileType,
			Array.from(this.folder.html.childNodes).slice(-2)
		]);
		rpcFuncs.waitAdded().then(items => items.forEach(({id, name}) => this.addItem(id, name)));
		rpcFuncs.waitMoved().then(({from, to}) => this.moveItem(from, to));
		rpcFuncs.waitRemoved().then(item => this.removeItem(item));
		rpcFuncs.waitLinked().then(({id, name}) => this.addItem(id, name));
		rpcFuncs.waitFolderAdded().then(folder => this.addFolder(folder));
		rpcFuncs.waitFolderMoved().then(({from, to}) => this.moveFolder(from, to));
		rpcFuncs.waitFolderRemoved().then(folder => this.removeFolder(folder));
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
			f.children.forEach(c => {
				f.parent = t;
				t.children.push(f);
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
