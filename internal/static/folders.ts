import type {Uint, FolderRPC, FolderItems} from './types.js';
import {createHTML, autoFocus, clearElement} from './lib/dom.js';
import {br, button, details, div, h1, img, input, li, option, select, span, summary, ul} from './lib/html.js';
import {symbol, g, path} from './lib/svg.js';
import {loadingWindow, windows, shell} from './windows.js';
import {enterKey, queue, labels} from './shared.js';
import {SortNode, stringSort} from './lib/ordered.js';
import {addSymbol} from './symbols.js';
import lang from './language.js';

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
      getPaths = (folder: Folder, breadcrumb: string): string[] => [breadcrumb].concat(...folder.folders.flatMap(p => getPaths(p, breadcrumb + p.name + "/"))),
      rename = addSymbol("rename", symbol({"viewBox": "0 0 30 20"}, path({"d": "M1,5 v10 h28 v-10 Z M17,1 h10 m-5,0 V19 m-5,0 h10", "style": "stroke: currentColor", "stroke-linejoin": "round", "fill": "none"}))),
      copy = addSymbol("copy", symbol({"viewBox": "0 0 34, 37"}, path({"d": "M14,6 h-13 v30 h21 v-22 z v8 h8 M12,6 v-5 h13 l8,8 v22 h-11 m11,-22 h-8 v-8 M6,20 h11 m-11,5 h11 m-11,5 h11", "style": "stroke: currentColor", "fill": "none"}))),
      remove = addSymbol("remove", symbol({"viewBox": "0 0 32 34"}, path({"d": "M10,5 v-3 q0,-1 1,-1 h10 q1,0 1,1 v3 m8,0 h-28 q-1,0 -1,1 v2 q0,1 1,1 h28 q1,0 1,-1 v-2 q0,-1 -1,-1 m-2,4 v22 q0,2 -2,2 h-20 q-2,0 -2,-2 v-22 m2,3 v18 q0,1 1,1 h3 q1,0 1,-1 v-18 q0,-1 -1,-1 h-3 q-1,0 -1,1 m7.5,0 v18 q0,1 1,1 h3 q1,0 1,-1 v-18 q0,-1 -1,-1 h-3 q-1,0 -1,1 m7.5,0 v18 q0,1 1,1 h3 q1,0 1,-1 v-18 q0,-1 -1,-1 h-3 q-1,0 -1,1", "style": "stroke: currentColor", "fill": "none"}))),
      newFolder = addSymbol("newFolder", symbol({"viewBox": "0 0 24 20"}, path({"d": "M1,4 h22 v15 h-22 Z m2,0 l3,-3 h5 l3,3 m3,2 v12 m-6,-6 h12", "style": "stroke: currentColor", "fill": "none", "stroke-linejoin": "round"}))),
      folder = addSymbol("folder", symbol({"viewBox": "0 0 37 28"}, g({"stroke-width": 2, "style": "stroke: currentColor", "fill": "none", "stroke-linejoin": "round"}, [
	path({"d": "M32,27 h-30 v-20 h2 l5,-5 h5 l5,5 h13 v2"}),
	path({"d": "M31,27 h1 v-20 h-30", "style": "display: var(--folder-closed, block)"}),
	path({"d": "M31,27 h1 l5,-16 h-30 l-5,16", "style": "display: var(--folder-open, none)"})
      ])));

export class Item {
	id: Uint;
	name: string;
	parent: Folder;
	node: HTMLElement;
	constructor(parent: Folder, id: Uint, name: string) {
		this.id = id;
		this.name = name;
		this.parent = parent;
		this.node = li({"class": "foldersItem"}, [
			span(name, {"class": "item", "onclick": () => this.show()}),
			rename({"title": lang["ITEM_MOVE"], "class": "itemRename", "onclick": () => this.rename()}),
			copy({"title": lang["ITEM_COPY_ADD"], "class": "itemCopy", "onclick": () => this.copy()}),
			remove({"title": lang["ITEM_REMOVE"], "class": "itemRemove", "onclick": () => this.remove()}),
		]);
	}
	show() {}
	rename() {
		const self = this,
		      root = this.parent.root,
		      parentPath = this.parent.getPath() + "/",
		      parents = select({"id": "folderName_"}, getPaths(root.folder, "/").map(p => option(p, p === parentPath ? {"value": p, "selected": true} : {"value": p}))),
		      window = shell.appendChild(windows({"window-icon": root.windowIcon, "window-title": lang["ITEM_MOVE"]})),
		      newName = autoFocus(input({"type": "text", "value": this.name, "onkeypress": enterKey}));
		return createHTML(window, {"class": "renameItem"}, [
			h1(lang["ITEM_MOVE"]),
			div(`${lang["OLD_LOCATION"]}: ${parentPath}${this.name}`),
			labels(`${lang["NEW_LOCATION"]}: `, parents),
			newName,
			br(),
			button(lang["ITEM_MOVE"], {"onclick": function(this: HTMLButtonElement) {
				this.toggleAttribute("disabled", true);
				loadingWindow(queue(() => root.rpcFuncs.move(parentPath + self.name, parents.value + newName.value).then(newPath => {
					root.moveItem(parentPath + self.name, newPath);
					window.remove();
				})
				.finally(() => this.removeAttribute("disabled"))), window);
			}})
		]);
	}
	copy() {
		const self = this,
		      root = this.parent.root,
		      parentPath = this.parent.getPath() + "/",
		      parents = select({"id": "folderName_"}, getPaths(root.folder, "/").map(p => option(p, p === parentPath ? {"value": p, "selected": true} : {"value": p}))),
		      window = shell.appendChild(windows({"window-icon": root.windowIcon, "window-title": lang["ITEM_COPY_ADD"]})),
		      newName = autoFocus(input({"type": "text", "value": this.name, "onkeypress": enterKey}));
		return createHTML(window, {"class": "copyItem"}, [
			h1(lang["ITEM_COPY_ADD"]),
			div(`${lang["CURRENT_LOCATION"]}: ${parentPath}${this.name}`),
			labels(`${lang["ITEM_COPY_NEW"]}: `, parents),
			newName,
			br(),
			button(lang["ITEM_COPY_ADD"], {"onclick": function(this: HTMLButtonElement) {
				this.toggleAttribute("disabled", true);
				loadingWindow(queue(() => root.rpcFuncs.copy(self.id, parents.value + newName.value).then(copied => {
					root.copyItem(self.id, copied.id, copied.path);
					window.remove();
				})
				.finally(() => this.removeAttribute("disabled"))), window);
			}}),
		]);
	}
	remove() {
		const root = this.parent.root,
		      path = this.getPath(),
		      pathDiv = div(path),
		      window = shell.appendChild(windows({"window-icon": root.windowIcon, "window-title": lang["ITEM_REMOVE"]}));
		return createHTML(window, {"class": "removeItem"}, [
			h1(lang["ITEM_REMOVE"]),
			div(lang["ITEM_REMOVE_CONFIRM"]),
			pathDiv,
			autoFocus(button(lang["ITEM_REMOVE"], {"onclick": function(this: HTMLButtonElement) {
				this.toggleAttribute("disabled", true);
				loadingWindow(queue(() => root.rpcFuncs.remove(path).then(() => {
					root.removeItem(path);
					window.remove();
				})
				.finally(() => this.removeAttribute("disabled"))), window);
			}}))
		]);
	}
	getPath() {
		return this.parent.getPath() + "/" + this.name;
	}
	delete() {}
}

export class DraggableItem extends Item {
	image = img({"class": "imageIcon", "loading": "lazy"});
	icon: HTMLDivElement = div(this.image);
	constructor(parent: Folder, id: Uint, name: string) {
		super(parent, id, name);
		createHTML(this.node.firstChild!, {
			"draggable": "true",
			"onmousemove": (e: MouseEvent) => {
				createHTML(this.icon, {"style": {"--icon-top": (e.clientY + 5) + "px", "--icon-left": (e.clientX + 5) + "px"}});
				if (!this.icon.parentNode) {
					document.body.appendChild(this.icon);
				}
			},
			"onmouseout": () => this.removeIcon(),
			"ondragstart": (e: DragEvent) => {
				const img = this.image;
				if (img.naturalWidth === 0 || img.naturalHeight === 0) {
					e.preventDefault();
				}
				e.dataTransfer!.setDragImage(this.icon, -5, -5);
				e.dataTransfer!.setData(this.dragName(), JSON.stringify({id: this.id, width: img.naturalWidth, height: img.naturalHeight}));
				this.icon.style.setProperty("transform", "translateX(-9999px)");
			}
		});
	}
	dragName() {return ""}
	delete() {
		this.removeIcon();
	}
	removeIcon() {
		if (this.icon.parentNode) {
			document.body.removeChild(this.icon);
		}
		this.icon.style.removeProperty("transform");
	}
}

export class Folder {
	parent: Folder | null;
	name: string;
	node: HTMLElement;
	children: SortNode<Folder | Item>;
	root: Root;
	constructor(root: Root, parent: Folder | null, name: string, children: FolderItems) {
		this.root = root;
		this.parent = parent;
		this.children = new SortNode<Folder>(ul({"class": "folders"}), this.sorter);
		this.name = name;
		this.node = li({"class": "foldersFolder"}, [
			details([
				summary([
					folder({"class": "folderIcon"}),
					span(name),
					rename({"title": lang["FOLDER_MOVE"], "class": "renameFolder", "onclick": (e: Event) => this.rename(e)}),
					newFolder({"title": lang["FOLDER_ADD"], "class": "addFolder", "onclick": (e: Event) => this.newFolder(e)}),
					remove({"title": lang["FOLDER_REMOVE"], "class": "removeFolder", "onclick": (e: Event) => this.remove(e)})
				]),
				this.children.node,
			])
		]);
		for (const name in children.folders) {
			this.children.push(new this.root.newFolder(root, this, name, children.folders[name]));
		}
		for (const name in children.items) {
			this.children.push(new this.root.newItem(this, children.items[name], name));
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
	get folders() {
		return this.children.filter(c => c instanceof Folder) as Folder[];
	}
	get items() {
		return this.children.filter(c => c instanceof Item) as Item[];
	}
	rename(e: Event) {
		e.preventDefault();
		const root = this.root,
		      oldPath = this.getPath() + "/",
		      parentPath = this.parent ? this.parent.getPath() + "/" : "/",
		      parents = select({"id": "folderName_"}, getPaths(root.folder, "/").filter(p => !p.startsWith(oldPath)).map(p => option(p, p === parentPath ? {"value": p, "selected": true} : {"value": p}))),
		      window = shell.appendChild(windows({"window-icon": root.windowIcon, "window-title": lang["FOLDER_MOVE"]})),
		      newName = autoFocus(input({"type": "text", "value": this.name, "onkeypress": enterKey}));
		return createHTML(window, [
			h1(lang["FOLDER_MOVE"]),
			div(`${lang["OLD_LOCATION"]}: ${oldPath.slice(0, -1)}`),
			labels(`${lang["NEW_LOCATION"]}: `, parents),
			newName,
			br(),
			button(lang["FOLDER_MOVE"], {"onclick": function(this: HTMLButtonElement) {
				this.toggleAttribute("disabled", true);
				loadingWindow(queue(() => root.rpcFuncs.moveFolder(oldPath, parents.value + "/" + newName.value).then(newPath => {
					root.moveFolder(oldPath.slice(0, -1), newPath);
					window.remove();
				})
				.finally(() => this.removeAttribute("disabled"))), window);
			}})
		])
	}
	remove(e: Event) {
		e.preventDefault();
		const root = this.root,
		      path = this.getPath(),
		      pathDiv = div(path),
		      window = shell.appendChild(windows({"window-icon": root.windowIcon, "window-title": lang["FOLDER_REMOVE"]}));
		return createHTML(window, {"class": "folderRemove"}, [
			h1(lang["FOLDER_REMOVE"]),
			div(lang["FOLDER_REMOVE_CONFIRM"]),
			pathDiv,
			autoFocus(button(lang["FOLDER_REMOVE"], {"onclick": function(this: HTMLButtonElement) {
				this.toggleAttribute("disabled", true);
				loadingWindow(queue(() => root.rpcFuncs.removeFolder(path).then(() => {
					root.removeFolder(path);
					window.remove();
				})
				.finally(() => this.removeAttribute("disabled"))), window);
			}}))
		]);
	}
	newFolder(e: Event) {
		e.preventDefault();
		const root = this.root,
		      path = this.getPath(),
		      window = shell.appendChild(windows({"window-icon": root.windowIcon, "window-title": lang["FOLDER_ADD"]})),
		      folderName = autoFocus(input({"id": "folderName_", "onkeypress": enterKey}));
		return createHTML(window, {"class": "folderAdd"}, [
			h1(lang["FOLDER_ADD"]),
			labels(`${lang["FOLDER_NAME"]}: ${path + "/"}`, folderName),
			br(),
			button(lang["FOLDER_ADD"], {"onclick": function(this: HTMLButtonElement) {
				this.toggleAttribute("disabled", true);
				loadingWindow(queue(() => root.rpcFuncs.createFolder(path + "/" + folderName.value).then(folder => {
					root.addFolder(folder);
					window.remove();
				})
				.finally(() => this.removeAttribute("disabled"))), window);
			}})
		]);
	}
	addItem(id: Uint, name: string) {
		const item = this.getItem(name);
		if (item) {
			return item;
		}
		const newItem = new this.root.newItem(this, id, name);
		this.children.push(newItem);
		return newItem;
	}
	getItem(name: string) {
		return this.items.filter(i => i.name === name).pop();
	}
	removeItem(name: string) {
		const index = this.children.findIndex(i => i.name === name && i instanceof Item);
		if (index !== -1) {
			const i = (this.children.splice(index, 1).pop() as Item);
			i.delete();
			return i.id;
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
			const f = this.children.splice(index, 1).pop() as Folder;
			f.delete();
			return f;
		}
		return undefined;
	}
	getPath() {
		const breadcrumbs = [];
		for (let f: Folder | null = this; f; f = f.parent) breadcrumbs.push(f.name);
		return breadcrumbs.reverse().join("/");
	}
	delete() {
		for (const c of this.children) {
			c.delete();
		}
	}
}


export class Root {
	fileType: string;
	folder: Folder;
	rpcFuncs: FolderRPC;
	newItem: ItemConstructor;
	newFolder: FolderConstructor;
	windowIcon?: string;
	node: HTMLElement;
	constructor (rootFolder: FolderItems, fileType: string, rpcFuncs: FolderRPC | null, newItem: ItemConstructor = Item, newFolder: FolderConstructor = Folder) {
		this.newItem = newItem;
		this.newFolder = newFolder;
		this.fileType = fileType;
		this.folder = undefined as any as Folder;    // INIT HACK
		this.node = undefined as any as HTMLElement; // INIT HACK
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
		createHTML(this.node ? clearElement(this.node) : this.node = div(), [
			this.fileType,
			this.folder.node.firstChild!.firstChild!.lastChild!.previousSibling!,
			this.folder.node.firstChild!.lastChild!
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
			for (const c of f.children) {
				c.parent = t;
				t.children.push(c);
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
