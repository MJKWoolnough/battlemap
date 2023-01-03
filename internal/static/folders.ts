import type {FolderItems, FolderRPC, IDName, Uint, WidthHeight} from './types.js';
import type {Bind} from './lib/dom.js';
import type {DragTransfer} from './lib/drag.js';
import {add, ids} from './lib/css.js';
import {amendNode, autoFocus, clearNode} from './lib/dom.js';
import {br, button, details, div, h1, img, input, li, option, select, span, summary, ul} from './lib/html.js';
import {queue, setAndReturn} from './lib/misc.js';
import {NodeMap, node, stringSort} from './lib/nodes.js';
import {invertID} from './ids.js';
import lang from './language.js';
import {inited, isAdmin} from './rpc.js';
import {invert} from './settings.js';
import {enterKey, labels} from './shared.js';
import {copy, folder, newFolder, remove, rename} from './symbols.js';
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
      getPaths = (folder: Folder, breadcrumb: string): string[] => [breadcrumb, ...(Array.from(folder.children.values()).filter(c => c instanceof Folder) as Folder[]).flatMap(p => getPaths(p, breadcrumb + p.name + "/")).sort(stringSort)],
      folderIcon = div({"style": "transform: translateX(-9999px); display: inline-block"}, folder({"style": "width: 2em; height: 2em"})),
      clearDragOver = ({root: {[node]: n}}: Folder) => {
	amendNode(n, {"class": {[folderDragging]: false}});
	for (const f of [...n.getElementsByClassName(dragOver), n]) {
		amendNode(f, {"class": {[dragOver]: false}});
	}
      },
      [item, folderIconID, foldersFolder, filter] = ids(4);

export const [folderDragging, dragOver, folders, foldersItem, itemControl, imageIcon] = ids(6);

invert.wait(i => amendNode(folderIcon, {"style": {"background-color": i ? "#000" : "#fff"}}));

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
		this[node] = li({"class": foldersItem}, [
			this.nameElem = span({"class": item, "onclick": () => this.show()}, name),
			this.renamer = rename({"title": lang["ITEM_MOVE"], "class": itemControl, "onclick": () => this.rename()}),
			this.copier = copy({"title": lang["ITEM_COPY_ADD"], "class": itemControl, "onclick": () => this.copy()}),
			this.remover = remove({"title": lang["ITEM_REMOVE"], "class": itemControl, "onclick": () => this.remove()})
		]);
	}
	abstract show(): void;
	rename() {
		const self = this,
		      root = self.parent.root,
		      parentPath = this.parent.getPath() + "/",
		      parents = select(getPaths(root.folder, "/").map(p => option(p === parentPath ? {"value": p, "selected": true} : {"value": p}, p))),
		      newName = input({"type": "text", "value": this.name, "onkeypress": enterKey}),
		      w = windows({"window-icon": root.windowIcon, "window-title": lang["ITEM_MOVE"]}, [
			h1(lang["ITEM_MOVE"]),
			div([lang["OLD_LOCATION"], `: ${parentPath}${this.name}`]),
			labels([lang["NEW_LOCATION"], ": "], parents),
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
		autoFocus(newName);
		return w;
	}
	copy() {
		const self = this,
		      root = self.parent.root,
		      parentPath = this.parent.getPath() + "/",
		      parents = select(getPaths(root.folder, "/").map(p => option(p === parentPath ? {"value": p, "selected": true} : {"value": p}, p))),
		      newName = input({"type": "text", "value": this.name, "onkeypress": enterKey}),
		      w = windows({"window-icon": root.windowIcon, "window-title": lang["ITEM_COPY_ADD"]}, [
			h1(lang["ITEM_COPY_ADD"]),
			div([lang["CURRENT_LOCATION"], `: ${parentPath}${this.name}`]),
			labels([lang["ITEM_COPY_NEW"], ": "], parents),
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
		autoFocus(newName);
		return w;
	}
	remove() {
		const root = this.parent.root,
		      path = this.getPath(),
		      pathDiv = div(path),
		      b = button({"onclick": function(this: HTMLButtonElement) {
			amendNode(this, {"disabled": true});
			loadingWindow(queue(() => root.rpcFuncs.remove(path).then(() => {
				root.removeItem(path);
				w.remove();
			})
			.finally(() => amendNode(this, {"disabled": true}))), w);
		      }}, lang["ITEM_REMOVE"]),
		      w = windows({"window-icon": root.windowIcon, "window-title": lang["ITEM_REMOVE"]}, [
			h1(lang["ITEM_REMOVE"]),
			div(lang["ITEM_REMOVE_CONFIRM"]),
			pathDiv,
			b
		      ]);
		amendNode(shell, w);
		autoFocus(b);
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
	readonly image = img({"class": imageIcon, "loading": "lazy", "onload": () => {
		this.#width = this.image.naturalWidth;
		this.#height = this.image.naturalHeight;
	}});
	#icon: HTMLDivElement = div(this.image);
	#width: Uint = -1;
	#height: Uint = -1;
	#dragKey: string;
	#dragTransfer: DragTransfer;
	constructor(parent: Folder, id: Uint, name: string, dt: DragTransfer, showOnMouseOver = false) {
		super(parent, id, name);
		this.#dragTransfer = dt;
		this.#dragKey = dt.register(this);
		amendNode(this[node].firstChild!, {
			"draggable": "true",
			"onmouseover": () => amendNode(document.body, amendNode(this.#icon, {"style": showOnMouseOver ? undefined : {"transform": "translateX(-9999px)"}})),
			"onmousemove": showOnMouseOver ? (e: MouseEvent) => amendNode(this.#icon, {"style": {"--icon-top": (e.clientY + 5) + "px", "--icon-left": (e.clientX + 5) + "px"}}) : undefined,
			"onmouseout": () => this.removeIcon(),
			"ondragstart": this,
			"ondragend": this
		});
	}
	get width() { return this.#width }
	get height() { return this.#height }
	handleEvent(e: DragEvent) {
		if (e.type === "dragend") {
			this.ondragend(e);
		} else if (e.type === "dragstart") {
			this.ondragstart(e);
		}
	}
	ondragstart(e: DragEvent) {
		if (this.#width === -1 || this.#height === -1) {
			e.preventDefault();
			return;
		}
		this.#dragTransfer.set(e, this.#dragKey, this.#icon);
		amendNode(this.#icon.parentNode ? null : document.body, amendNode(this.#icon, {"style": {"transform": "translateX(-9999px)"}}));
		setTimeout(amendNode, 0, this.parent.root[node], {"class": [folderDragging]});
	}
	ondragend(_e: DragEvent) {
		if (this.parent instanceof DragFolder) {
			clearDragOver(this.parent);
		}
	}
	transfer(): FolderDragItem {
		return this;
	}
	delete() {
		this.removeIcon();
		this.#dragTransfer.deregister(this.#dragKey);
	}
	removeIcon() {
		amendNode(this.#icon, {"style": {"transform": undefined}}).remove();
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
		this.children = new NodeMap<string, Folder | Item>(ul({"class": folders}), this.sorter);
		this.nameElem = span(name);
		this.renamer = rename({"title": lang["FOLDER_MOVE"], "class": itemControl, "onclick": (e: Event) => this.rename(e)});
		this.newer = newFolder({"title": lang["FOLDER_ADD"], "class": itemControl, "onclick": (e: Event) => this.newFolder(e)});
		this.remover = remove({"title": lang["FOLDER_REMOVE"], "class": itemControl, "onclick": (e: Event) => this.remove(e)});
		if (this.name = name) {
			this[node] = li({"class": foldersFolder}, [
				details([
					summary([
						folder({"class": folderIconID}),
						this.nameElem,
						this.renamer,
						this.newer,
						this.remover
					]),
					this.children[node]
				])
			]);
		}  else {
			this[node] = div();
		}
		for (const name in children.folders) {
			this.children.set(name, new this.root.newFolder(root, this, name, children.folders[name]));
		}
		for (const name in children.items) {
			this.children.set(name, new this.root.newItem(this, children.items[name], name));
		}
	}
	get folderSorter() { return stringSorter; }
	get itemSorter() { return this.parent === null ? idSorter : stringSorter; }
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
		      newName = input({"type": "text", "value": this.name, "onkeypress": enterKey}),
		      w = windows({"window-icon": root.windowIcon, "window-title": lang["FOLDER_MOVE"]}, [
			h1(lang["FOLDER_MOVE"]),
			div([lang["OLD_LOCATION"], `: ${oldPath.slice(0, -1)}`]),
			labels([lang["NEW_LOCATION"], ": "], parents),
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
		autoFocus(newName);
		return w;
	}
	remove(e: Event) {
		e.preventDefault();
		const root = this.root,
		      path = this.getPath(),
		      pathDiv = div(path),
		      b = button({"onclick": function(this: HTMLButtonElement) {
			amendNode(this, {"disabled": true});
			loadingWindow(queue(() => root.rpcFuncs.removeFolder(path).then(() => {
				root.removeFolder(path);
				w.remove();
			})
			.finally(() => amendNode(this, {"disabled": true}))), w);
		      }}, lang["FOLDER_REMOVE"]),
		      w = windows({"window-icon": root.windowIcon, "window-title": lang["FOLDER_REMOVE"]}, [
			h1(lang["FOLDER_REMOVE"]),
			div(lang["FOLDER_REMOVE_CONFIRM"]),
			pathDiv,
			b
		      ]);
		amendNode(shell, w);
		autoFocus(b);
		return w;
	}
	newFolder(e: Event) {
		e.preventDefault();
		const root = this.root,
		      path = this.getPath(),
		      folderName = input({"onkeypress": enterKey}),
		      w = windows({"window-icon": root.windowIcon, "window-title": lang["FOLDER_ADD"]}, [
			h1(lang["FOLDER_ADD"]),
			labels([lang["FOLDER_NAME"], `: ${path + "/"}`], folderName),
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
		autoFocus(folderName);
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
			old.delete();
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

export abstract class DragFolder<T extends DraggableItem> extends Folder {
	#dragTransfer: DragTransfer<T>;
	#dragFolder?: DragTransfer<Folder>;
	#dragKey: string;
	constructor(root: Root, parent: Folder | null, name: string, children: FolderItems, dragTransfer: DragTransfer<T>, dragFolder?: DragTransfer<Folder>) {
		super(root, parent, name, children);
		this.#dragTransfer = dragTransfer;
		this.#dragKey = (this.#dragFolder = dragFolder)?.register(this) ?? "";
		if (name && dragFolder) {
			amendNode(this.nameElem, {"draggable": "true", "ondragstart": this, "ondragend": this});
		}
		amendNode(this[node], {"ondragover": this, "ondrop": this, "ondragenter": this, "ondragleave": this});
		if (parent === null) {
			amendNode(this[node], {"onmouseover": () => clearDragOver(this)});
		}
	}
	handleEvent(e: DragEvent) {
		switch (e.type) {
		case "dragover":
			return this.ondragover(e);
		case "drop":
			return this.ondrop(e);
		case "dragenter":
			return this.ondragenter(e);
		case "dragleave":
			return this.ondragleave(e);
		case "dragstart":
			if (!folderIcon.parentNode) {
				amendNode(document.body, folderIcon);
			}
			this.#dragFolder?.set(e, this.#dragKey, folderIcon);
			break;
		case "dragend":
			clearDragOver(this);
		}
	}
	ondragover(e: DragEvent) {
		e.stopPropagation();
		if (this.#dragFolder?.is(e)) {
			const folder = this.#dragFolder.get(e);
			for (let f: Folder | null = this; f; f = f.parent) {
				if (f === folder) {
					e.dataTransfer!.dropEffect = "none";
					return;
				}
			}
			e.preventDefault();
			e.dataTransfer!.dropEffect = "move";
		} else if (this.#dragTransfer.is(e)) {
			e.preventDefault();
			e.dataTransfer!.dropEffect = "move";
		}
	}
	ondragenter(e: DragEvent) {
		e.stopPropagation();
		if (this.#dragFolder?.is(e)) {
			const folder = this.#dragFolder.get(e);
			for (let f: Folder | null = this; f; f = f.parent) {
				if (f === folder) {
					return;
				}
			}
		} else if (!this.#dragTransfer.is(e)) {
			return;
		}
		amendNode(this[node], {"class": [dragOver]});
		amendNode(this.root[node], {"class": [folderDragging]});
	}
	ondragleave(e: DragEvent) {
		amendNode(this[node], {"class": {[dragOver]: false}});
		e.stopPropagation();
	}
	ondrop(e: DragEvent) {
		clearDragOver(this);
		e.stopPropagation();
		if (this.#dragTransfer.is(e)) {
			const {parent, name} = this.#dragTransfer.get(e);
			if (parent !== this) {
				const parentPath = parent.getPath() + "/";
				queue(() => this.root.rpcFuncs.move(parentPath + name, this.getPath() + "/" + name).then(newPath => this.root.moveItem(parentPath + name, newPath)));
			}
		} else if (this.#dragFolder?.is(e)) {
			const folder = this.#dragFolder.get(e),
			      parent = folder.parent;
			if (parent !== this) {
				for (let f: Folder | null = this; f; f = f.parent) {
					if (f === folder) {
						return;
					}
				}
				const oldPath = folder.getPath();
				queue(() => this.root.rpcFuncs.moveFolder(oldPath + "/", this.getPath() + "/" + folder.name).then(newPath => this.root.moveFolder(oldPath, newPath)));
			}
		}
	}
	transfer() {
		return this;
	}
}

export class Root {
	#fileType: string | Bind;
	folder!: Folder;
	rpcFuncs!: FolderRPC;
	newItem: ItemConstructor;
	newFolder: FolderConstructor;
	windowIcon?: string;
	[node]!: HTMLElement;
	constructor (rootFolder: FolderItems, fileType: string | Bind, rpcFuncs: FolderRPC | null, newItem: ItemConstructor, newFolder: FolderConstructor = Folder) {
		this.newItem = newItem;
		this.newFolder = newFolder;
		this.#fileType = fileType;
		if (rpcFuncs) {
			this.setRPCFuncs(rpcFuncs);
			Root.prototype.setRoot.call(this, rootFolder);
		}
	}
	setRoot(rootFolder: FolderItems) {
		if (this.rpcFuncs) {
			const f = this.folder = new this.newFolder(this, null, "", rootFolder);
			clearNode(this[node] ??= this.folder[node], [
				span({"style": "margin-right: 0.5em"}, this.#fileType),
				f.newer,
				this.filter ? [
					input({"type": "search", "class": filter, "placeholder": lang["FILTER"], "oninput": function(this: HTMLInputElement) {
						const terms = this.value.toLowerCase().split(" ");
						for (let i = 0; i < terms.length; i++) {
							if (terms[i].charAt(0) === '"') {
								while (terms.length > i+1) {
									if (terms[i].slice(-1) === '"') {
										break;
									}
									terms[i] += " " + terms.splice(i+1, 1)[0];
								}
								terms[i] = terms[i].slice(1, terms[i].slice(-1) === '"' ? -1 : undefined);
							}
						}
						f.filter(terms);
					}}),
					br()
				] : [],
				f.children[node]
			]);
		}
	}
	setRPCFuncs(rpcFuncs: FolderRPC) {
		if (!this.rpcFuncs) {
			this.rpcFuncs = rpcFuncs;
			rpcFuncs.waitAdded().when(items => {
				for (const {id, name} of items) {
					this.addItem(id, name);
				}
			});
			rpcFuncs.waitMoved().when(({from, to}) => this.moveItem(from, to));
			rpcFuncs.waitRemoved().when(item => this.removeItem(item));
			rpcFuncs.waitCopied().when(({oldID, newID, path}) => this.copyItem(oldID, newID, path));
			rpcFuncs.waitFolderAdded().when(folder => this.addFolder(folder));
			rpcFuncs.waitFolderMoved().when(({from, to}) => this.moveFolder(from, to));
			rpcFuncs.waitFolderRemoved().when(folder => this.removeFolder(folder));
		}
	}
	get filter() { return true; }
	get root() { return this; }
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

inited.then(() => {
	if (isAdmin) {
		add({
			[`.${folders}`]: {
				"margin": 0,
				" details summary": {
					"list-style": "none",
					"outline": "none",
					"cursor": "pointer",
					"grid-template-columns": "1em auto 1em 1em 1em"
				},
				[` summary>.${folderIconID}`]: {
					"width": "1em",
					"height": "1em"
				},
				[` details[open]>summary>.${folderIconID}`]: {
					"--folder-closed": "none",
					"--folder-open": "block"
				}
			},
			"summary::-webkit-details-marker": {
				"display": "none"
			},
			[`.${item}`]: {
				"cursor": "pointer"
			},
			[`.${foldersItem}:hover,.${foldersFolder}>details summary:hover`]: {
				"background-color": "#888"
			},
			[`.${folders} summary,.${foldersItem}`]: {
				"display": "grid",
				"grid-template-columns": "auto 1em 1em 1em"
			},
			[`.${itemControl}`]: {
				"background-size": "1em",
				"background-position": "bottom center",
				"background-repeat": "no-repeat",
				"width": "1em",
				"height": "1em",
				"display": "inline-block",
				"margin-right": "0.2em",
				"cursor": "pointer"
			},
			[`.${imageIcon}`]: {
				"position": "absolute",
				"top": "var(--icon-top, 0)",
				"left": "var(--icon-left, 0)",
				"max-width": "100px",
				"max-height": "100px",
				"z-index": 2
			},
			[`.${filter}`]: {
				"float": "right",
				"text-align": "right",
				"+br": {
					"clear": "right"
				}
			},
			[`.${dragOver}`]: {
				"background-color": "#aaa",
				">details>summary,>span": {
					"background-color": "#888"
				}
			},
			[`.${invertID} .${dragOver}`]: {
				"background-color": "#555"
			},
			[`.${folderDragging}`]: {
				" *": {
					"pointer-events": "none"
				},
				[` .${foldersFolder}`]: {
					"pointer-events": "auto"
				},
				">ul:after": {
					"content": "\" \"",
					"height": "1em",
					"display": "block"
				}
			}
		});
	}
});
