import {Uint, FolderRPC, FolderItems} from './types.js';
import {Subscription} from './lib/inter.js';
import {createHTML, autoFocus} from './lib/dom.js';
import {br, button, details, div, h1, img, input, label, li, option, select, span, summary, ul} from './lib/html.js';
import {ShellElement, loadingWindow, windows} from './windows.js';
import {enterKey, handleError} from './misc.js';
import {SortNode, stringSort} from './lib/ordered.js';

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
      getPaths = (folder: Folder, breadcrumb: string): string[] => [breadcrumb].concat(...folder.folders.flatMap(p => getPaths(p, breadcrumb + p.name + "/")));

let folderID = 0;

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
			span({"class": "itemRename", "onclick": () => this.rename()}),
			span({"class": "itemLink", "onclick": () => this.link()}),
			span({"class": "itemRemove", "onclick": () => this.remove()}),
		]);
	}
	show() {}
	rename() {
		const self = this,
		      root = this.parent.root,
		      shell = root.shell,
		      parentPath = this.parent.getPath() + "/",
		      paths: HTMLOptionElement[] = [],
		      parents = select({"id": "folderName"}, getPaths(root.folder, "/").map(p => option(p, p === parentPath ? {"value": p, "selected": true} : {"value": p}))),
		      newName = autoFocus(input({"type": "text", "value": this.name, "onkeypress": enterKey})),
		      window = shell.appendChild(windows({"window-title": "Move Item"}));
		return createHTML(window, {"class": "renameItem"}, [
			h1("Move Item"),
			div(`Old Location: ${parentPath}${this.name}`),
			label({"for": "folderName"}, "New Location: "),
			parents,
			newName,
			br(),
			button("Move", {"onclick": function(this: HTMLButtonElement) {
				this.setAttribute("disabled", "disabled");
				loadingWindow(root.rpcFuncs.move(parentPath + self.name, parents.value + newName.value), window).then(newPath => {
					root.moveItem(parentPath + self.name, newPath);
					window.remove();
				})
				.catch(handleError)
				.finally(() => this.removeAttribute("disabled"));
			}})
		]);
	}
	link() {
		const self = this,
		      root = this.parent.root,
		      shell = root.shell,
		      parentPath = this.parent.getPath() + "/",
		      paths: HTMLOptionElement[] = [],
		      parents = select({"id": "folderName"}, getPaths(root.folder, "/").map(p => option(p, p === parentPath ? {"value": p, "selected": true} : {"value": p}))),
		      newName = autoFocus(input({"type": "text", "value": this.name, "onkeypress": enterKey})),
		      window = shell.appendChild(windows({"window-title": "Link Item"}));
		return createHTML(window, {"class": "linkItem"}, [
			h1("Add Link"),
			div(`Current Location: ${parentPath}${this.name}`),
			label({"for": "folderName"}, "New Link: "),
			parents,
			newName,
			br(),
			button("Link", {"onclick": function(this: HTMLButtonElement) {
				this.setAttribute("disabled", "disabled");
				loadingWindow(root.rpcFuncs.link(self.id, parents.value + newName.value), window).then(newPath => {
					root.addItem(self.id, newPath);
					window.remove();
				})
				.catch(handleError)
				.finally(() => this.removeAttribute("disabled"));
			}}),
		]);
	}
	remove() {
		const root = this.parent.root,
		      shell = root.shell,
		      path = this.getPath(),
		      pathDiv = div(path),
		      window = shell.appendChild(windows({"window-title": "Remove Item"}));
		return createHTML(window, {"class": "removeItem"}, [
			h1("Remove Item"),
			div("Remove the following item?"),
			pathDiv,
			autoFocus(button("Yes, Remove!", {"onclick": function(this: HTMLButtonElement) {
				this.setAttribute("disabled", "disabled");
				loadingWindow(root.rpcFuncs.remove(path), window).then(() => {
					root.removeItem(path);
					window.remove();
				})
				.catch(handleError)
				.finally(() => this.removeAttribute("disabled"));
			}}))
		]);
	}
	getPath() {
		return this.parent.getPath() + "/" + this.name;
	}
}

export class DraggableItem extends Item {
	icon: HTMLDivElement = div(img({"class": "imageIcon"}));
	constructor(parent: Folder, id: Uint, name: string) {
		super(parent, id, name);
		createHTML(this.node.firstChild!, {
			"draggable": "true",
			"onmousemove": (e: MouseEvent) => {
				createHTML(this.icon, {"--icon-top": (e.clientY + 5) + "px", "--icon-left": (e.clientX + 5) + "px"});
				if (!this.icon.parentNode) {
					document.body.appendChild(this.icon);
				}
			},
			"onmouseout": () => {
				if (this.icon.parentNode) {
					document.body.removeChild(this.icon);
				}
				this.icon.style.removeProperty("transform");
			},
			"ondragstart": (e: DragEvent) => {
				const img = this.icon.firstChild as HTMLImageElement;
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
					span(name),
					span({"class": "renameFolder", "onclick": (e: Event) => this.rename(e)}),
					span({"class": "addFolder", "onclick": (e: Event) => this.newFolder(e)}),
					span({"class": "removeFolder", "onclick": (e: Event) => this.remove(e)})
				]),
				this.children.node,
			])
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
	rename(e: Event) {
		e.preventDefault();
		const root = this.root,
		      shell = root.shell,
		      oldPath = this.getPath() + "/",
		      parentPath = this.parent ? this.parent.getPath() + "/" : "/",
		      paths: HTMLOptionElement[] = [],
		      parents = select({"id": "folderName"}, getPaths(root.folder, "/").filter(p => !p.startsWith(oldPath)).map(p => option(p, p === parentPath ? {"value": p, "selected": true} : {"value": p}))),
		      newName = autoFocus(input({"type": "text", "value": self.name, "onkeypress": enterKey})),
		      window = shell.appendChild(windows({"window-title": "Move Folder"}));
		return createHTML(window, [
			h1("Move Folder"),
			div(`Old Location: ${oldPath.slice(0, -1)}`),
			label({"for": "folderName"}, "New Location: "),
			parents,
			newName,
			br(),
			button("Move", {"onclick": function(this: HTMLButtonElement) {
				this.setAttribute("disabled", "disabled");
				loadingWindow(root.rpcFuncs.moveFolder(oldPath, parents.value + "/" + newName.value), window).then(newPath => {
					root.moveFolder(oldPath.slice(0, -1), newPath);
					window.remove();
				})
				.catch(handleError)
				.finally(() => this.removeAttribute("disabled"));
			}})
		])
	}
	remove(e: Event) {
		e.preventDefault();
		const root = this.root,
		      shell = root.shell,
		      path = this.getPath(),
		      pathDiv = div(path),
		      window = shell.appendChild(windows({"window-title": "Remove Folder"}));
		return createHTML(window, {"class": "folderRemove"}, [
			h1("Remove Folder"),
			div("Remove the following folder? NB: This will remove all folders and items it contains."),
			pathDiv,
			autoFocus(button("Yes, Remove!", {"onclick": function(this: HTMLButtonElement) {
				this.setAttribute("disabled", "disabled");
				loadingWindow(root.rpcFuncs.removeFolder(path), window).then(() => {
					root.removeFolder(path);
					window.remove();
				})
				.catch(handleError)
				.finally(() => this.removeAttribute("disabled"));
			}}))
		]);
	}
	newFolder(e: Event) {
		e.preventDefault();
		const root = this.root,
		      shell = root.shell,
		      path = this.getPath(),
		      folderName = autoFocus(input({"id": "folderName", "onkeypress": enterKey})),
		      window = shell.appendChild(windows({"window-title": "Add Folder"}));
		return createHTML(window, {"class": "folderAdd"}, [
			h1("Add Folder"),
			label({"for": "folderName"}, `Folder Name: ${path + "/"}`),
			folderName,
			br(),
			button("Add Folder", {"onclick": function(this: HTMLButtonElement) {
				this.setAttribute("disabled", "disabled");
				loadingWindow(root.rpcFuncs.createFolder(path + "/" + folderName.value), window).then(folder => {
					root.addFolder(folder);
					window.remove();
				})
				.catch(handleError)
				.finally(() => this.removeAttribute("disabled"));
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
			return (this.children.splice(index, 1).pop() as Item).id;
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
	shell: ShellElement;
	rpcFuncs: FolderRPC;
	newItem: ItemConstructor;
	newFolder: FolderConstructor;
	node: HTMLElement;
	cancel: () => void;
	constructor (rootFolder: FolderItems, fileType: string, rpcFuncs: FolderRPC, shell: ShellElement, newItem: ItemConstructor = Item, newFolder: FolderConstructor = Folder) {
		this.newItem = newItem;
		this.newFolder = newFolder;
		this.shell = shell;
		this.rpcFuncs = rpcFuncs;
		this.folder = new newFolder(this, null, "", rootFolder);
		this.node = div([
			fileType,
			this.folder.node.firstChild!.firstChild!.lastChild!.previousSibling!,
			this.folder.node.firstChild!.lastChild!
		]);
		this.cancel = Subscription.canceller(
			rpcFuncs.waitAdded().then(items => items.forEach(({id, name}) => this.addItem(id, name))),
			rpcFuncs.waitMoved().then(({from, to}) => this.moveItem(from, to)),
			rpcFuncs.waitRemoved().then(item => this.removeItem(item)),
			rpcFuncs.waitLinked().then(({id, name}) => this.addItem(id, name)),
			rpcFuncs.waitFolderAdded().then(folder => this.addFolder(folder)),
			rpcFuncs.waitFolderMoved().then(({from, to}) => this.moveFolder(from, to)),
			rpcFuncs.waitFolderRemoved().then(folder => this.removeFolder(folder)),
		);
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
	addItem(id: Uint, path: string) {
		const [folder, name] = this.resolvePath(path);
		if (folder) {
			return folder.addItem(id, name);
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
