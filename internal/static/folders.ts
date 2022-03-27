import type {FolderItems, FolderRPC, IDName, Uint, WidthHeight} from './types.js';
import type {DragTransfer} from './lib/drag.js';
import {amendNode, autoFocus, clearNode} from './lib/dom.js';
import {br, button, details, div, h1, img, input, li, option, select, span, summary, ul} from './lib/html.js';
import {NodeMap, node, stringSort} from './lib/nodes.js';
import lang from './language.js';
import {enterKey, labels, setAndReturn, queue} from './shared.js';
import {copy, folder, newFolder, rename, remove} from './symbols.js';
import {loadingWindow, shell, windows} from './windows.js';

interface ItemConstructor {
	new (parent: Folder, id: Uint, name: string): Item;
}

interface FolderConstructor {
	new (root: Root, parent: Folder | null, name: string, children: FolderItems): Folder;
}

type FolderSorter = (a: Folder, b: Folder) => number;
type ItemSorter = (a: Item, b: Item) => number;
type Sorter = (a: Item | Folder, b: Item | Folder) => number;

export type FolderDragItem = IDName & WidthHeight;

const stringSorter = (a: Item | Folder, b: Item | Folder) => stringSort(a.name, b.name),
      idSorter = (a: Item, b: Item) => b.id - a.id,
      sorts = new WeakMap<FolderSorter, WeakMap<ItemSorter, Sorter>>(),
      getPaths = (folder: Folder, breadcrumb: string): string[] => [breadcrumb].concat(...(Array.from(folder.children.values()).filter(c => c instanceof Folder) as Folder[]).flatMap(p => getPaths(p, breadcrumb + p.name + "/")));

export abstract class Item {
	id: Uint;
	name: string;
	parent: Folder;
	[node]: HTMLElement;
	nameElem: HTMLSpanElement;
	renamer: SVGSymbolElement;
	copier: SVGSymbolElement;
	remover: SVGSymbolElement;
	constructor(parent: Folder, id: Uint, name: string) {
		this.id = id;
		this.name = name;
		this.parent = parent;
		this[node] = li({"class": "foldersItem"}, [
			this.nameElem = span({"class": "item", "onclick": () => this.show()}, name),
			this.renamer = rename({"title": lang["ITEM_MOVE"], "class": "itemRename", "onclick": () => this.rename()}),
			this.copier = copy({"title": lang["ITEM_COPY_ADD"], "class": "itemCopy", "onclick": () => this.copy()}),
			this.remover = remove({"title": lang["ITEM_REMOVE"], "class": "itemRemove", "onclick": () => this.remove()}),
		]);
	}
	abstract show(): void;
	rename() {
		const self = this,
		      root = this.parent.root,
		      parentPath = this.parent.getPath() + "/",
		      parents = select(getPaths(root.folder, "/").map(p => option(p === parentPath ? {"value": p, "selected": true} : {"value": p}, p))),
		      newName = autoFocus(input({"type": "text", "value": this.name, "onkeypress": enterKey})),
		      w = windows({"window-icon": root.windowIcon, "window-title": lang["ITEM_MOVE"], "class": "renameItem"}, [
			h1(lang["ITEM_MOVE"]),
			div(`${lang["OLD_LOCATION"]}: ${parentPath}${this.name}`),
			labels(`${lang["NEW_LOCATION"]}: `, parents),
			newName,
			br(),
			button({"onclick": function(this: HTMLButtonElement) {
				amendNode(this, {"disabled": true});
				loadingWindow(queue(() => root.rpcFuncs.move(parentPath + self.name, parents.value + newName.value).then(newPath => {
					root.moveItem(parentPath + self.name, newPath);
					w.remove();
				}).finally(() => amendNode(this, {"disabled": false}))), w);
			}}, lang["ITEM_MOVE"])
		      ]);
		amendNode(shell, w);
		return w;
	}
	copy() {
		const self = this,
		      root = this.parent.root,
		      parentPath = this.parent.getPath() + "/",
		      parents = select(getPaths(root.folder, "/").map(p => option(p === parentPath ? {"value": p, "selected": true} : {"value": p}, p))),
		      newName = autoFocus(input({"type": "text", "value": this.name, "onkeypress": enterKey})),
		      w = windows({"window-icon": root.windowIcon, "window-title": lang["ITEM_COPY_ADD"], "class": "copyItem"}, [
			h1(lang["ITEM_COPY_ADD"]),
			div(`${lang["CURRENT_LOCATION"]}: ${parentPath}${this.name}`),
			labels(`${lang["ITEM_COPY_NEW"]}: `, parents),
			newName,
			br(),
			button({"onclick": function(this: HTMLButtonElement) {
				amendNode(this, {"disabled": true});
				loadingWindow(queue(() => root.rpcFuncs.copy(self.id, parents.value + newName.value).then(copied => {
					root.copyItem(self.id, copied.id, copied.path);
					w.remove();
				}).finally(() => amendNode(this, {"disabled": false}))), w);
			}}, lang["ITEM_COPY_ADD"])
		      ]);
		amendNode(shell, w);
		return w;
	}
	remove() {
		const root = this.parent.root,
		      path = this.getPath(),
		      pathDiv = div(path),
		      w = windows({"window-icon": root.windowIcon, "window-title": lang["ITEM_REMOVE"], "class": "removeItem"}, [
			h1(lang["ITEM_REMOVE"]),
			div(lang["ITEM_REMOVE_CONFIRM"]),
			pathDiv,
			autoFocus(button({"onclick": function(this: HTMLButtonElement) {
				amendNode(this, {"disabled": true});
				loadingWindow(queue(() => root.rpcFuncs.remove(path).then(() => {
					root.removeItem(path);
					w.remove();
				})
				.finally(() => amendNode(this, {"disabled": true}))), w);
			}}, lang["ITEM_REMOVE"]))
		      ]);
		amendNode(shell, w);
		return w;
	}
	getPath() {
		return this.parent.getPath() + "/" + this.name;
	}
	delete() {}
	filter(terms: string[]) {
		const name = this.name.toLowerCase();
		let ret = true;
		for (const term of terms) {
			if (!name.includes(term)) {
				ret = false;
				break;
			}
		}
		amendNode(this[node], {"style": {"display": ret ? undefined : "none"}});
		return ret;
	}
}

export abstract class DraggableItem extends Item {
	image = img({"class": "imageIcon", "loading": "lazy"});
	icon: HTMLDivElement = div(this.image);
	#dragKey: string;
	constructor(parent: Folder, id: Uint, name: string) {
		super(parent, id, name);
		this.#dragKey = this.dragTransfer().register(this);
		amendNode(this[node].firstChild!, {
			"draggable": "true",
			"onmouseover": () => amendNode(document.body, amendNode(this.icon, {"style": this.showOnMouseOver ? undefined : {"transform": "translateX(-9999px)"}})),
			"onmousemove": this.showOnMouseOver ? (e: MouseEvent) => amendNode(this.icon, {"style": {"--icon-top": (e.clientY + 5) + "px", "--icon-left": (e.clientX + 5) + "px"}}) : undefined,
			"onmouseout": () => this.removeIcon(),
			"ondragstart": (e: DragEvent) => {
				const img = this.image;
				if (img.naturalWidth === 0 || img.naturalHeight === 0) {
					e.preventDefault();
					return;
				}
				this.dragTransfer().set(e, this.#dragKey, this.icon);
				amendNode(this.icon, {"style": {"transform": "translateX(-9999px)"}});
			}
		});
	}
	get showOnMouseOver() { return false; }
	abstract dragTransfer(): DragTransfer<FolderDragItem>;
	transfer(): FolderDragItem {
		const {id, name, image: {naturalWidth, naturalHeight}} = this;
		return {id, "width": naturalWidth, "height": naturalHeight, name};
	}
	delete() {
		this.removeIcon();
		this.dragTransfer().deregister(this.#dragKey);
	}
	removeIcon() {
		amendNode(this.icon, {"style": {"transform": undefined}}).remove();
	}
}

export class Folder {
	parent: Folder | null;
	name: string;
	[node]: HTMLElement;
	children: NodeMap<string, Folder | Item>;
	root: Root;
	nameElem: HTMLSpanElement;
	renamer: SVGSymbolElement;
	newer: SVGSymbolElement;
	remover: SVGSymbolElement;
	constructor(root: Root, parent: Folder | null, name: string, children: FolderItems) {
		this.root = root;
		this.parent = parent;
		this.children = new NodeMap<string, Folder | Item>(ul({"class": "folders"}), this.sorter);
		this.name = name;
		this[node] = li({"class": "foldersFolder"}, [
			details([
				summary([
					folder({"class": "folderIcon"}),
					this.nameElem = span(name),
					this.renamer = rename({"title": lang["FOLDER_MOVE"], "class": "renameFolder", "onclick": (e: Event) => this.rename(e)}),
					this.newer = newFolder({"title": lang["FOLDER_ADD"], "class": "addFolder", "onclick": (e: Event) => this.newFolder(e)}),
					this.remover = remove({"title": lang["FOLDER_REMOVE"], "class": "removeFolder", "onclick": (e: Event) => this.remove(e)})
				]),
				this.children[node],
			])
		]);
		for (const name in children.folders) {
			this.children.set(name, new this.root.newFolder(root, this, name, children.folders[name]));
		}
		for (const name in children.items) {
			this.children.set(name, new this.root.newItem(this, children.items[name], name));
		}
	}
	get folderSorter() {
		return stringSorter;
	}
	get itemSorter() {
		return this.parent === null ? idSorter : stringSorter;
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
		const fn = (a: Item | Folder, b: Item | Folder) => a instanceof Folder ? b instanceof Folder ? fs(a, b) : -1 : b instanceof Folder ? 1 : is(a, b);
		if (m) {
			m.set(is, fn);
		} else {
			sorts.set(fs, new WeakMap<ItemSorter, Sorter>([[is, fn]]));
		}
		return fn;
	}
	rename(e: Event) {
		e.preventDefault();
		const root = this.root,
		      oldPath = this.getPath() + "/",
		      parentPath = this.parent ? this.parent.getPath() + "/" : "/",
		      parents = select(getPaths(root.folder, "/").filter(p => !p.startsWith(oldPath)).map(p => option(p === parentPath ? {"value": p, "selected": true} : {"value": p}, p))),
		      newName = autoFocus(input({"type": "text", "value": this.name, "onkeypress": enterKey})),
		      w = windows({"window-icon": root.windowIcon, "window-title": lang["FOLDER_MOVE"]}, [
			h1(lang["FOLDER_MOVE"]),
			div(`${lang["OLD_LOCATION"]}: ${oldPath.slice(0, -1)}`),
			labels(`${lang["NEW_LOCATION"]}: `, parents),
			newName,
			br(),
			button({"onclick": function(this: HTMLButtonElement) {
				amendNode(this, {"disabled": true});
				loadingWindow(queue(() => root.rpcFuncs.moveFolder(oldPath, parents.value + "/" + newName.value).then(newPath => {
					root.moveFolder(oldPath.slice(0, -1), newPath);
					w.remove();
				})
				.finally(() => amendNode(this, {"disabled": true}))), w);
			}}, lang["FOLDER_MOVE"])
		      ]);
		amendNode(shell, w);
		return w;
	}
	remove(e: Event) {
		e.preventDefault();
		const root = this.root,
		      path = this.getPath(),
		      pathDiv = div(path),
		      w = windows({"window-icon": root.windowIcon, "window-title": lang["FOLDER_REMOVE"], "class": "folderRemove"}, [
			h1(lang["FOLDER_REMOVE"]),
			div(lang["FOLDER_REMOVE_CONFIRM"]),
			pathDiv,
			autoFocus(button({"onclick": function(this: HTMLButtonElement) {
				amendNode(this, {"disabled": true});
				loadingWindow(queue(() => root.rpcFuncs.removeFolder(path).then(() => {
					root.removeFolder(path);
					w.remove();
				})
				.finally(() => amendNode(this, {"disabled": true}))), w);
			}}, lang["FOLDER_MOVE"]))
		      ]);
		amendNode(shell, w);
		return w;
	}
	newFolder(e: Event) {
		e.preventDefault();
		const root = this.root,
		      path = this.getPath(),
		      folderName = autoFocus(input({"onkeypress": enterKey})),
		      w = windows({"window-icon": root.windowIcon, "window-title": lang["FOLDER_ADD"], "class": "folderAdd"}, [
			h1(lang["FOLDER_ADD"]),
			labels(`${lang["FOLDER_NAME"]}: ${path + "/"}`, folderName),
			br(),
			button({"onclick": function(this: HTMLButtonElement) {
				amendNode(this, {"disabled": true});
				loadingWindow(queue(() => root.rpcFuncs.createFolder(path + "/" + folderName.value).then(folder => {
					root.addFolder(folder);
					w.remove();
				})
				.finally(() => amendNode(this, {"disabled": true}))), w);
			}}, lang["FOLDER_ADD"])
		      ]);
		amendNode(shell, w);
		return w;
	}
	addItem(id: Uint, name: string) {
		return this.getItem(name) ?? setAndReturn(this.children, name, new this.root.newItem(this, id, name));
	}
	getItem(name: string) {
		return this.children.get(name) as (Item | undefined);
	}
	removeItem(name: string) {
		const old = this.children.get(name) as Item;
		if (old) {
			this.children.delete(name);
			return old.id;
		}
		return -1;
	}
	addFolder(name: string) {
		return name === "" ? this : this.getFolder(name) ?? setAndReturn(this.children, name, new this.root.newFolder(this.root, this, name, {folders: {}, items: {}}));
	}
	getFolder(name: string) {
		return this.children.get(name) as Folder | undefined;
	}
	removeFolder(name: string) {
		const old = this.children.get(name) as Folder | undefined;
		if (old) {
			this.children.delete(name);
		}
		return old;
	}
	getPath() {
		const breadcrumbs = [];
		for (let f: Folder | null = this; f; f = f.parent) {
			breadcrumbs.push(f.name);
		}
		return breadcrumbs.reverse().join("/");
	}
	delete() {
		this.children.clear();
	}
	filter(terms: string[]) {
		const name = this.name.toLowerCase();
		let ret = true;
		for (const term of terms) {
			if (!name.includes(term)) {
				ret = false;
				break;
			}
		}
		for (const [, c] of this.children) {
			if (c.filter(terms)) {
				ret = true;
			}
		}
		if (this.name) {
			amendNode(this[node], {"style": {"display": ret ? undefined : "none"}});
		}
		return ret;
	}
}


export class Root {
	fileType: string;
	folder: Folder;
	rpcFuncs: FolderRPC;
	newItem: ItemConstructor;
	newFolder: FolderConstructor;
	windowIcon?: string;
	[node]: HTMLElement;
	constructor (rootFolder: FolderItems, fileType: string, rpcFuncs: FolderRPC | null, newItem: ItemConstructor, newFolder: FolderConstructor = Folder) {
		this.newItem = newItem;
		this.newFolder = newFolder;
		this.fileType = fileType;
		this.folder = undefined as any as Folder;    // INIT HACK
		this[node] = undefined as any as HTMLElement; // INIT HACK
		if (rpcFuncs) {
			this.setRPCFuncs(rpcFuncs);
			this.rpcFuncs = rpcFuncs;
			Root.prototype.setRoot.call(this, rootFolder);
		} else {
			this.rpcFuncs = null as any as FolderRPC;
		}
	}
	setRoot(rootFolder: FolderItems) {
		if (!this.rpcFuncs) {
			return;
		}
		const f = this.folder = new this.newFolder(this, null, "", rootFolder);
		clearNode(this[node] ?? (this[node] = div()), [
			this.fileType,
			f.newer,
			br(),
			input({"placeholder": lang["FILTER"], "oninput": function(this: HTMLInputElement) {
				f.filter(this.value.toLowerCase().split(" "));
			}}),
			f.children[node]
		]);
	}
	setRPCFuncs(rpcFuncs: FolderRPC) {
		if (this.rpcFuncs) {
			return;
		}
		this.rpcFuncs = rpcFuncs;
		rpcFuncs.waitAdded().then(items => {
			for (const {id, name} of items) {
				this.addItem(id, name);
			}
		});
		rpcFuncs.waitMoved().then(({from, to}) => this.moveItem(from, to));
		rpcFuncs.waitRemoved().then(item => this.removeItem(item));
		rpcFuncs.waitCopied().then(({oldID, newID, path}) => this.copyItem(oldID, newID, path));
		rpcFuncs.waitFolderAdded().then(folder => this.addFolder(folder));
		rpcFuncs.waitFolderMoved().then(({from, to}) => this.moveFolder(from, to));
		rpcFuncs.waitFolderRemoved().then(folder => this.removeFolder(folder));
	}
	get root() {
		return this;
	}
	resolvePath(path: string): [Folder | null, string] {
		const breadcrumbs = path.split("/"),
		      sub = breadcrumbs.pop() ?? "";
		let folder: Folder = this.folder;
		for (const b of breadcrumbs) {
			if (b) {
				const f = folder.getFolder(b);
				if (!f) {
					return [null, sub];
				}
				folder = f;
			}
		}
		return [folder, sub];
	}
	addItem(id: Uint, path: string) {
		const [folder, name] = this.resolvePath(path);
		return folder?.addItem(id, name);
	}
	getItem(path: string) {
		const [folder, name] = this.resolvePath(path);
		return folder?.getItem(name);
	}
	moveItem(from: string, to: string) {
		this.addItem(this.removeItem(from), to);
	}
	copyItem(_oldID: Uint, newID: Uint, path: string) {
		this.addItem(newID, path);
	}
	removeItem(path: string) {
		const [folder, name] = this.resolvePath(path);
		return folder?.removeItem(name) ?? -1;
	}
	addFolder(path: string) {
		const parts = path.split("/");
		let f = this.folder.addFolder(parts.shift()!);
		for (const p of parts) {
			f = f.addFolder(p);
		}
		return f;
	}
	moveFolder(from: string, to: string) {
		const f = this.removeFolder(from);
		if (f) {
			const t = this.addFolder(to);
			for (const [name, c] of f.children) {
				c.parent = t;
				t.children.set(name, c);
			}
			return f;
		}
		return undefined;
	}
	removeFolder(path: string) {
		const [folder, name] = this.resolvePath(path);
		return folder?.removeFolder(name);
	}
}
