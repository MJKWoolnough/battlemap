import type {FolderItems, FolderRPC, Uint} from './types.js';
import {amendNode, autoFocus, clearNode} from './lib/dom.js';
import {br, button, details, div, h1, img, input, li, option, select, span, summary, ul} from './lib/html.js';
import {NodeMap, node, stringSort} from './lib/nodes.js';
import lang from './language.js';
import {enterKey, labels, queue} from './shared.js';
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

const stringSorter = (a: Item | Folder, b: Item | Folder) => stringSort(a.name, b.name),
      idSorter = (a: Item, b: Item) => b.id - a.id,
      sorts = new WeakMap<FolderSorter, WeakMap<ItemSorter, Sorter>>(),
      getPaths = (folder: Folder, breadcrumb: string): string[] => [breadcrumb].concat(...(Array.from(folder.children.values()).filter(c => c instanceof Folder) as Folder[]).flatMap(p => getPaths(p, breadcrumb + p.name + "/")));

export class Item {
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
	show() {}
	rename() {
		const self = this,
		      root = this.parent.root,
		      parentPath = this.parent.getPath() + "/",
		      parents = select(getPaths(root.folder, "/").map(p => option(p === parentPath ? {"value": p, "selected": true} : {"value": p}, p))),
		      window = shell.appendChild(windows({"window-icon": root.windowIcon, "window-title": lang["ITEM_MOVE"]})),
		      newName = autoFocus(input({"type": "text", "value": this.name, "onkeypress": enterKey}));
		return amendNode(window, {"class": "renameItem"}, [
			h1(lang["ITEM_MOVE"]),
			div(`${lang["OLD_LOCATION"]}: ${parentPath}${this.name}`),
			labels(`${lang["NEW_LOCATION"]}: `, parents),
			newName,
			br(),
			button({"onclick": function(this: HTMLButtonElement) {
				amendNode(this, {"disabled": true});
				loadingWindow(queue(() => root.rpcFuncs.move(parentPath + self.name, parents.value + newName.value).then(newPath => {
					root.moveItem(parentPath + self.name, newPath);
					window.remove();
				}).finally(() => amendNode(this, {"disabled": false}))), window);
			}}, lang["ITEM_MOVE"])
		]);
	}
	copy() {
		const self = this,
		      root = this.parent.root,
		      parentPath = this.parent.getPath() + "/",
		      parents = select(getPaths(root.folder, "/").map(p => option(p === parentPath ? {"value": p, "selected": true} : {"value": p}, p))),
		      window = shell.appendChild(windows({"window-icon": root.windowIcon, "window-title": lang["ITEM_COPY_ADD"]})),
		      newName = autoFocus(input({"type": "text", "value": this.name, "onkeypress": enterKey}));
		return amendNode(window, {"class": "copyItem"}, [
			h1(lang["ITEM_COPY_ADD"]),
			div(`${lang["CURRENT_LOCATION"]}: ${parentPath}${this.name}`),
			labels(`${lang["ITEM_COPY_NEW"]}: `, parents),
			newName,
			br(),
			button({"onclick": function(this: HTMLButtonElement) {
				this.toggleAttribute("disabled", true);
				loadingWindow(queue(() => root.rpcFuncs.copy(self.id, parents.value + newName.value).then(copied => {
					root.copyItem(self.id, copied.id, copied.path);
					window.remove();
				})
				.finally(() => this.removeAttribute("disabled"))), window);
			}}, lang["ITEM_COPY_ADD"]),
		]);
	}
	remove() {
		const root = this.parent.root,
		      path = this.getPath(),
		      pathDiv = div(path),
		      window = shell.appendChild(windows({"window-icon": root.windowIcon, "window-title": lang["ITEM_REMOVE"]}));
		return amendNode(window, {"class": "removeItem"}, [
			h1(lang["ITEM_REMOVE"]),
			div(lang["ITEM_REMOVE_CONFIRM"]),
			pathDiv,
			autoFocus(button({"onclick": function(this: HTMLButtonElement) {
				this.toggleAttribute("disabled", true);
				loadingWindow(queue(() => root.rpcFuncs.remove(path).then(() => {
					root.removeItem(path);
					window.remove();
				})
				.finally(() => this.removeAttribute("disabled"))), window);
			}}, lang["ITEM_REMOVE"]))
		]);
	}
	getPath() {
		return this.parent.getPath() + "/" + this.name;
	}
	delete() {}
}

export abstract class DraggableItem extends Item {
	image = img({"class": "imageIcon", "loading": "lazy"});
	icon: HTMLDivElement = div(this.image);
	constructor(parent: Folder, id: Uint, name: string) {
		super(parent, id, name);
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
				e.dataTransfer!.setDragImage(this.icon, -5, -5);
				e.dataTransfer!.setData(this.dragName(), JSON.stringify({"id": this.id, "width": img.naturalWidth, "height": img.naturalHeight, "name": this.name}));
				amendNode(this.icon, {"style": {"transform": "translateX(-9999px)"}});
			}
		});
	}
	get showOnMouseOver() { return false; }
	abstract dragName(): string;
	delete() {
		this.removeIcon();
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
	rename(e: Event) {
		e.preventDefault();
		const root = this.root,
		      oldPath = this.getPath() + "/",
		      parentPath = this.parent ? this.parent.getPath() + "/" : "/",
		      parents = select(getPaths(root.folder, "/").filter(p => !p.startsWith(oldPath)).map(p => option(p === parentPath ? {"value": p, "selected": true} : {"value": p}, p))),
		      window = shell.appendChild(windows({"window-icon": root.windowIcon, "window-title": lang["FOLDER_MOVE"]})),
		      newName = autoFocus(input({"type": "text", "value": this.name, "onkeypress": enterKey}));
		return amendNode(window, [
			h1(lang["FOLDER_MOVE"]),
			div(`${lang["OLD_LOCATION"]}: ${oldPath.slice(0, -1)}`),
			labels(`${lang["NEW_LOCATION"]}: `, parents),
			newName,
			br(),
			button({"onclick": function(this: HTMLButtonElement) {
				this.toggleAttribute("disabled", true);
				loadingWindow(queue(() => root.rpcFuncs.moveFolder(oldPath, parents.value + "/" + newName.value).then(newPath => {
					root.moveFolder(oldPath.slice(0, -1), newPath);
					window.remove();
				})
				.finally(() => this.removeAttribute("disabled"))), window);
			}}, lang["FOLDER_MOVE"])
		])
	}
	remove(e: Event) {
		e.preventDefault();
		const root = this.root,
		      path = this.getPath(),
		      pathDiv = div(path),
		      window = shell.appendChild(windows({"window-icon": root.windowIcon, "window-title": lang["FOLDER_REMOVE"]}));
		return amendNode(window, {"class": "folderRemove"}, [
			h1(lang["FOLDER_REMOVE"]),
			div(lang["FOLDER_REMOVE_CONFIRM"]),
			pathDiv,
			autoFocus(button({"onclick": function(this: HTMLButtonElement) {
				this.toggleAttribute("disabled", true);
				loadingWindow(queue(() => root.rpcFuncs.removeFolder(path).then(() => {
					root.removeFolder(path);
					window.remove();
				})
				.finally(() => this.removeAttribute("disabled"))), window);
			}}, lang["FOLDER_MOVE"]))
		]);
	}
	newFolder(e: Event) {
		e.preventDefault();
		const root = this.root,
		      path = this.getPath(),
		      window = shell.appendChild(windows({"window-icon": root.windowIcon, "window-title": lang["FOLDER_ADD"]})),
		      folderName = autoFocus(input({"onkeypress": enterKey}));
		return amendNode(window, {"class": "folderAdd"}, [
			h1(lang["FOLDER_ADD"]),
			labels(`${lang["FOLDER_NAME"]}: ${path + "/"}`, folderName),
			br(),
			button({"onclick": function(this: HTMLButtonElement) {
				this.toggleAttribute("disabled", true);
				loadingWindow(queue(() => root.rpcFuncs.createFolder(path + "/" + folderName.value).then(folder => {
					root.addFolder(folder);
					window.remove();
				})
				.finally(() => this.removeAttribute("disabled"))), window);
			}}, lang["FOLDER_ADD"])
		]);
	}
	addItem(id: Uint, name: string) {
		const item = this.getItem(name);
		if (item) {
			return item;
		}
		const newItem = new this.root.newItem(this, id, name);
		this.children.set(name, newItem);
		return newItem;
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
		if (name === "") {
			return this;
		}
		const existing = this.getFolder(name);
		if (existing) {
			return existing;
		}
		const f = new this.root.newFolder(this.root, this, name, {folders: {}, items: {}});
		this.children.set(name, f);
		return f;
	}
	getFolder(name: string) {
		return this.children.get(name) as Folder | undefined;
	}
	removeFolder(name: string) {
		const old = this.children.get(name) as Folder;
		if (old) {
			this.children.delete(name);
			return old;
		}
		return undefined;
	}
	getPath() {
		const breadcrumbs = [];
		for (let f: Folder | null = this; f; f = f.parent) breadcrumbs.push(f.name);
		return breadcrumbs.reverse().join("/");
	}
	delete() {
		this.children.clear();
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
	constructor (rootFolder: FolderItems, fileType: string, rpcFuncs: FolderRPC | null, newItem: ItemConstructor = Item, newFolder: FolderConstructor = Folder) {
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
		this.folder = new this.newFolder(this, null, "", rootFolder);
		clearNode(this[node] ?? (this[node] = div()), [
			this.fileType,
			this.folder.newer,
			this.folder.children[node]
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
		      sub = breadcrumbs.pop() || "";
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
		if (folder) {
			return folder.addItem(id, name);
		}
		return undefined;
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
	copyItem(_oldID: Uint, newID: Uint, path: string) {
		this.addItem(newID, path);
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
		if (folder) {
			return folder.removeFolder(name);
		}
		return undefined;
	}
}
