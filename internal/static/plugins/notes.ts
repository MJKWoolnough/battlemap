import type {FolderItems, FromTo, IDName, KeystoreData, Uint} from '../types.js';
import type {Parsers, Tokeniser} from '../lib/bbcode.js';
import type {WindowElement} from '../windows.js';
import {isOpenTag, process} from '../lib/bbcode.js';
import {none} from '../lib/bbcode_tags.js';
import {add, id, render} from '../lib/css.js';
import {amendNode, bind, clearNode} from '../lib/dom.js';
import {DragTransfer, setDragEffect} from '../lib/drag.js';
import {br, button, div, input, link, span, textarea, title} from '../lib/html.js';
import {Subscription} from '../lib/inter.js';
import {isInt} from '../lib/misc.js';
import {node} from '../lib/nodes.js';
import {ns as svgNS} from '../lib/svg.js';
import {DragFolder, DraggableItem, Folder, Root} from '../folders.js';
import {psuedoLink, settingsTicker} from '../ids.js';
import mainLang, {makeLangPack} from '../language.js';
import {bbcodeDrag, parseBBCode, register, registerTag} from '../messaging.js';
import {addPlugin, getSettings, pluginName} from '../plugins.js';
import {handleError, isAdmin, rpc} from '../rpc.js';
import {cloneObject, labels} from '../shared.js';
import {shareStr} from '../symbols.js';
import {shell, windows} from '../windows.js';

type Page = {
	share: boolean;
	contents: string;
}

const lang = makeLangPack({
	"ERROR_FOLDER_NOT_EMPTY": "Cannot remove a non-empty folder",
	"ERROR_INVALID_FOLDER": "Invalid Folder",
	"ERROR_INVALID_ITEM": "Invalid Item",
	"ERROR_INVALID_PATH": "Invalid Path",
	"MENU_TITLE": "Notes",
	"NAME_EXISTS": "Note Exists",
	"NAME_EXISTS_LONG": "A note with that name already exists",
	"NAME_INVALID": "Invalid Name",
	"NAME_INVALID_LONG": "Note names cannot contains the '/' (slash) character",
	"NOTE": "Note",
	"NOTE_EDIT": "Edit Note",
	"NOTE_POPOUT": "Open in New Window",
	"NOTE_SAVE": "Save Note",
	"NOTE_SHARE": "Allow Note Sharing",
	"NOTES_NEW": "New Note",
	"NOTES_NEW_LONG": "Enter new note name",
	"SHARE": "Share"
      }),
      icon = `data:image/svg+xml,%3Csvg xmlns="${svgNS}" viewBox="0 0 84 96" width="84" height="96" %3E%3Crect x="60" y="6" width="24" height="90" fill="%23888" rx="10" /%3E%3Crect x="1" y="6" width="80" height="90" stroke="%23000" fill="%23fff" rx="10" /%3E%3Cg id="h"%3E%3Ccircle cx="16" cy="11" r="2" fill="%23333" /%3E%3Cellipse cx="15" cy="6" rx="3" ry="5" stroke="%23aaa" stroke-width="2" fill="none" stroke-dasharray="0 5 15" /%3E%3C/g%3E%3Cuse href="%23h" x="10" /%3E%3Cuse href="%23h" x="20" /%3E%3Cuse href="%23h" x="30" /%3E%3Cuse href="%23h" x="40" /%3E%3Cuse href="%23h" x="50" /%3E%3Cpath d="M11,25 h60 M11,40 h60 M11,55 h60 M11,70 h30" stroke="%23000" stroke-width="4" stroke-linecap="round" /%3E%3C/svg%3E`;

register("plugin-notes", [icon, lang["NOTE"]]);

if (isAdmin) {
	class NoteItem extends DraggableItem {
		#window: WindowElement | null = null;
		#popWindow: Window | null = null;
		#share: (() => void) | null = null;
		#bbcodeID: string;
		#changes = false;
		constructor(parent: Folder, id: Uint, name: string) {
			super(parent, id, name, dragNote);
			amendNode(this.image, {"src": icon});
			notes.set(id, this);
			this.#bbcodeID = bbcodeDrag.register(() => (text: string) => `[note=${id}]${text || this.name}[/note]`);
			amendNode(this.nameElem, {"onauxclick": (e: MouseEvent) => {
				if (e.button === 1) {
					if (this.#popWindow) {
						this.#popWindow.focus();
					} else if (this.#window?.close() !== false) {
						const wp = window.open("", "", "");
						if (wp) {
							(this.#popWindow = wp).addEventListener("unload", () => this.#popWindow = null);
							wp.document.head.append(title(this.name), render(), link({"rel": "shortcut icon", "sizes": "any", "href": icon}));
							wp.document.body.classList.add(pluginNotesClass);
							wp.document.body.append(parseBBCode(pages.get(this.id)?.data.contents || ""));
						}
					}
				}
			}});
		}
		show() {
			if (this.#window) {
				this.#window.focus();
			} else if (this.#popWindow) {
				this.#popWindow.focus();
			} else {
				const data = div({"class": pluginNotesClass}, parseBBCode(pages.get(this.id)?.data.contents || ""));
				amendNode(shell, this.#window = windows({"window-title": this.name, "window-icon": icon, "hide-minimise": false, "resizable": true, "style": "--window-width: 50%; --window-height: 50%", "onremove": () => {
					this.#window = null;
					this.#share = null;
				}}, data));
				this.#window.addControlButton(popOutIcon, () => {
					const wp = window.open("", "", "");
					if (wp) {
						(this.#popWindow = wp).addEventListener("unload", () => this.#popWindow = null);
						wp.document.head.append(title(this.name), render(), link({"rel": "shortcut icon", "sizes": "any", "href": icon}));
						wp.document.body.append(data);
						this.#window?.remove();
					}
				}, lang["NOTE_POPOUT"]);
				this.#window.addControlButton(editIcon, () => {
					if (this.#window?.firstChild === data) {
						const page = pages.get(this.id) || {"user": false, "data": {"contents": "", "share": false}},
						      onchange = () => this.#changes = contents.value !== page.data.contents || share.checked !== page.data.share,
						      contents = textarea({"ondragover": setDragEffect({"link": [bbcodeDrag]}), onchange, "ondrop": (e: DragEvent) => {
							if (bbcodeDrag.is(e)) {
								const {selectionStart, selectionEnd} = contents,
								      fn = bbcodeDrag.get(e);
								if (fn) {
									contents.setRangeText(fn(contents.value.slice(Math.min(selectionStart, selectionEnd), Math.max(selectionStart, selectionEnd))));
								}
							}
						      }}, page.data.contents),
						      share = input({"type": "checkbox", "class": settingsTicker, "checked": page.data.share, onchange}),
						      sure = (e: Event) => {
							if (this.#changes) {
								e.preventDefault();
								this.#window?.confirm(mainLang["ARE_YOU_SURE"], mainLang["UNSAVED_CHANGES"], icon).then(t => {
									if (t) {
										this.#window?.remove();
									}
								});
							}
						       };
						clearNode(this.#window, {"window-title": bind`${lang["NOTE_EDIT"]}: ${this.name}`, "class": pluginNotesEdit, "onclose": sure}, [
							labels([lang["NOTE"], ": "], contents),
							br(),
							labels(share, [lang["NOTE_SHARE"], ": "]),
							br(),
							button({"onclick": () => {
								page.data = {"contents": contents.value, "share": share.checked};
								pages.set(this.id, page);
								rpc.pluginSetting(importName, {[this.id+""]: page}, []);
								clearNode(data, parseBBCode(contents.value));
								this.#changes = false;
								this.#setShareButton();
							}}, lang["NOTE_SAVE"])
						]);
					} else {
						if (this.#changes) {
							this.#window?.confirm(mainLang["ARE_YOU_SURE"], mainLang["UNSAVED_CHANGES"], icon).then(t => {
								if (t) {
									this.#changes = false;
									clearNode(this.#window, {"window-title": this.name, "class": undefined}, data);
								}
							});
						} else {
							clearNode(this.#window, {"window-title": this.name, "class": undefined}, data);
						}
					}
				}, lang["NOTE_EDIT"]);
				this.#setShareButton();
			}
		}
		ondragstart(e: DragEvent) {
			super.ondragstart(e);
			if (!e.defaultPrevented) {
				bbcodeDrag.set(e, this.#bbcodeID);
			}
		}
		delete() {
			this.#window?.remove();
			this.#popWindow?.close();
			bbcodeDrag.deregister(this.#bbcodeID);
		}
		#setShareButton() {
			if (!pages.has(this.id) || !pages.get(this.id)!.data.share) {
				this.#share?.();
				this.#share = null;
			} else {
				this.#share ??= this.#window!.addControlButton(shareStr, () => {
					const page = pages.get(this.id);
					if (page) {
						rpc.broadcastWindow("plugin-notes", this.id, page.data.contents);
					}
				}, lang["SHARE"]);
			}
		}
		filter(terms: string[]) {
			const text = pages.get(this.id)?.data.contents.toLowerCase() || "";
			return super.filter(terms.every(term => text.includes(term)) ? [] : terms);
		}
	}

	class NoteFolder extends DragFolder<NoteItem> {
		constructor(root: Root, parent: Folder | null, name: string, children: FolderItems) {
			super(root, parent, name, children, dragNote, dragNoteFolder);
		}
		removeItem(name: string) {
			const id = super.removeItem(name);
			notes.delete(id);
			return id;
		}
	}

	let lastID = 0;
	const dragNote = new DragTransfer<NoteItem>("pluginnote"),
	      dragNoteFolder = new DragTransfer<NoteFolder>("pluginnotefolder"),
	      importName = pluginName(import.meta),
	      editIcon = `data:image/svg+xml,%3Csvg xmlns="${svgNS}" viewBox="0 0 70 70" fill="none" stroke="%23000"%3E%3Cpolyline points="51,7 58,0 69,11 62,18 51,7 7,52 18,63 62,18" stroke-width="2" /%3E%3Cpath d="M7,52 L1,68 L18,63 M53,12 L14,51 M57,16 L18,55" /%3E%3C/svg%3E`,
	      popOutIcon = `data:image/svg+xml,%3Csvg xmlns="${svgNS}" viewBox="0 0 15 15"%3E%3Cpath d="M7,1 H1 V14 H14 V8 M9,1 h5 v5 m0,-5 l-6,6" stroke-linejoin="round" fill="none" stroke="currentColor" /%3E%3C/svg%3E`,
	      pages = new Map<Uint, KeystoreData<Page>>(),
	      notes = new Map<Uint, NoteItem>(),
	      defaultSettings = {"user": false, "data": {"folders": {}, "items": {}}} as KeystoreData<FolderItems>,
	      isFolderItems = (data: any): data is FolderItems => {
		if (!(data instanceof Object) || !(data["folders"] instanceof Object) || !(data["items"] instanceof Object)) {
			return false;
		}
		for (const i in data["items"]) {
			if (!isInt(data["items"][i], 0)) {
				return false;
			}
		}
		for (const f in data["folders"]) {
			if (!isFolderItems(data["folders"][f])) {
				return false;
			}
		}
		return true;
	      },
	      isPage = (data: any): data is Page => data instanceof Object && typeof data["contents"] === "string",
	      checkSettings = (data: any) => {
		if (!(data instanceof Object) || !(data[""] instanceof Object) || data[""].user !== false || !isFolderItems(data[""].data)) {
			return defaultSettings
		}
		for (const k in data) {
			if (k !== "") {
				const id = parseInt(k);
				if (!isNaN(id) && data[k] instanceof Object && !data[k].user && isPage(data[k].data)) {
					pages.set(id, data[k]);
					if (id > lastID) {
						lastID = id;
					}
				}
			}
		}
		return data[""] as KeystoreData<FolderItems>;
	      },
	      waitAdded = Subscription.bind<IDName[]>(1),
	      waitMoved = Subscription.bind<FromTo>(1),
	      waitRemoved = Subscription.bind<string>(1),
	      waitFolderAdded = Subscription.bind<string>(1),
	      waitFolderMoved = Subscription.bind<FromTo>(1),
	      waitFolderRemoved = Subscription.bind<string>(1),
	      unusedWait = new Subscription<any>(() => {}),
	      folders = checkSettings(getSettings(importName)),
	      getFolder = (path: string, currPath = folders.data): [FolderItems | null, string] => {
		const parts = path.split("/"),
		      name = parts.pop() ?? "";
		for (const p of parts) {
			if (p) {
				if (!(currPath = currPath.folders[p])) {
					return [null, name];
				}
			}
		}
		return [currPath, name];
	      },
	      cleanPath = (path: string) => {
		const parts = path.split("/");
		path = "";
		for (const p of parts) {
			if (p) {
				path += `/${p}`;
			}
		}
		return path;
	      },
	      root = new Root(folders.data, lang["MENU_TITLE"], {
		"list": () => Promise.resolve(folders.data),
		"createFolder": path => {
			const [currPath, folder] = getFolder(path);
			if (!currPath) {
				handleError(lang["ERROR_INVALID_PATH"]);
				return Promise.reject(lang["ERROR_INVALID_PATH"]);
			} else if (currPath.folders[folder]) {
				handleError(lang["NAME_EXISTS_LONG"]);
				return Promise.reject(lang["NAME_EXISTS_LONG"]);
			}
			currPath.folders[folder] = {"folders": {}, "items": {}};
			rpc.pluginSetting(importName, {"": folders}, []);
			return Promise.resolve(path)
		},
		"move": (from, to) => {
			const [fromPath, fromItem] = getFolder(from),
			      [toPath, toItem] = getFolder(to);
			if (!fromPath || !toPath) {
				handleError(lang["ERROR_INVALID_PATH"]);
				return Promise.reject(lang["ERROR_INVALID_PATH"]);
			}
			const id = fromPath.items[fromItem];
			if (id === undefined) {
				handleError(lang["ERROR_INVALID_ITEM"]);
				return Promise.reject(lang["ERROR_INVALID_ITEM"]);
			}
			if (toPath.items[toItem]) {
				handleError(lang["NAME_EXISTS_LONG"]);
				return Promise.reject(lang["NAME_EXISTS_LONG"]);
			}
			delete fromPath.items[fromItem];
			toPath.items[toItem] = id;
			rpc.pluginSetting(importName, {"": folders}, []);
			return Promise.resolve(to)
		},
		"moveFolder": (from, to) => {
			from = cleanPath(from);
			to = cleanPath(to);
			if (to.startsWith(from)) {
				handleError(lang["ERROR_INVALID_PATH"]);
				return Promise.reject(lang["ERROR_INVALID_PATH"]);
			}
			const [fromPath, fromFolder] = getFolder(from),
			      [toPath, toFolder] = getFolder(to);
			if (!fromPath || !toPath) {
				handleError(lang["ERROR_INVALID_PATH"]);
				return Promise.reject(lang["ERROR_INVALID_PATH"]);
			}
			if (!fromPath.folders[fromFolder]) {
				handleError(lang["ERROR_INVALID_FOLDER"]);
				return Promise.reject(lang["ERROR_INVALID_FOLDER"]);
			}
			if (toPath.folders[toFolder]) {
				handleError(lang["NAME_EXISTS_LONG"]);
				return Promise.reject(lang["NAME_EXISTS_LONG"]);
			}
			toPath.folders[toFolder] = fromPath.folders[fromFolder];
			delete fromPath.folders[fromFolder];
			rpc.pluginSetting(importName, {"": folders}, []);
			return Promise.resolve(to)
		},
		"remove": path => {
			const [currPath, item] = getFolder(path);
			if (!currPath) {
				handleError(lang["ERROR_INVALID_PATH"]);
				return Promise.reject(lang["ERROR_INVALID_PATH"]);
			}
			const id = currPath.items[item];
			if (id === undefined) {
				handleError(lang["ERROR_INVALID_ITEM"]);
				return Promise.reject(lang["ERROR_INVALID_ITEM"]);
			}
			pages.delete(id);
			delete currPath.items[item];
			rpc.pluginSetting(importName, {"": folders}, [id + ""]);
			return Promise.resolve();
		},
		"removeFolder": path => {
			const [currPath, folder] = getFolder(cleanPath(path));
			if (!currPath) {
				handleError(lang["ERROR_INVALID_PATH"]);
				return Promise.reject(lang["ERROR_INVALID_PATH"]);
			}
			const f = currPath.folders[folder];
			if (!f) {
				handleError(lang["ERROR_INVALID_FOLDER"]);
				return Promise.reject(lang["ERROR_INVALID_FOLDER"]);
			} else if (Object.keys(f.folders).length !== 0 || Object.keys(f.items).length !== 0) {
				handleError(lang["ERROR_FOLDER_NOT_EMPTY"]);
				return Promise.reject(lang["ERROR_FOLDER_NOT_EMPTY"]);
			}
			delete currPath.folders[folder];
			rpc.pluginSetting(importName, {"": folders}, []);
			return Promise.resolve()
		},
		"copy": (id, path) => {
			const [currPath, item] = getFolder(path);
			if (!currPath) {
				handleError(lang["ERROR_INVALID_PATH"]);
				return Promise.reject(lang["ERROR_INVALID_PATH"]);
			} else if (currPath.items[item]) {
				handleError(lang["NAME_EXISTS_LONG"]);
				return Promise.reject(lang["NAME_EXISTS_LONG"]);
			}
			const newID = ++lastID,
			      newPage = cloneObject(pages.get(id)!);
			currPath.items[item] = newID;
			pages.set(newID, newPage);
			rpc.pluginSetting(importName, {"": folders, [newID + ""]: newPage}, []);
			return Promise.resolve({"id": newID, path})
		},
		"waitAdded": () => waitAdded[0],
		"waitMoved": () => waitMoved[0],
		"waitRemoved": () => waitRemoved[0],
		"waitCopied": () => unusedWait,
		"waitFolderAdded": () => waitFolderAdded[0],
		"waitFolderMoved": () => waitFolderMoved[0],
		"waitFolderRemoved": () => waitFolderRemoved[0]
	      }, NoteItem, NoteFolder),
	      compareFolderItems = (a: FolderItems, b: FolderItems, path: string, changes: Record<string, number>) => {
		for (const f in a.folders) {
			const fp = path + f + "/";
			if (!b.folders[f]) {
				changes[fp] = -1;
			} else {
				compareFolderItems(a.folders[f], b.folders[f], fp, changes);
			}
		}
		for (const f in b.folders) {
			if (!a.folders[f]) {
				changes[path + f + "/"] = 0;
			}
		}
		for (const i in a.items) {
			if (!b.items[i]) {
				changes[path + i] = -a.items[i];
			} else if (a.items[i] !== b.items[i]) {
				changes[""] = 1;
			}
		}
		for (const i in b.items) {
			if (!a.items[i]) {
				changes[path + i] = b.items[i];
			} else if (a.items[i] !== b.items[i]) {
				changes[""] = 1;
			}
		}
	      },
	      pluginNotesID = id(),
	      pluginNotesClass = id(),
	      pluginNotesEdit = id();
	add({
		[`#${pluginNotesID}`]: {
			" ul": {
				"padding-left": "1em",
				"list-style": "none"
			},
			">div>ul": {
				"padding": 0
			}
		},
		[`.${pluginNotesEdit} textarea`]: {
			"width": "calc(100% - 10em)",
			"height": "calc(100% - 5em)"
		},
		[`.${pluginNotesClass}`]: {
			"user-select": "text",
			"white-space": "pre-wrap",
			"font-family": "'Andale Mono',monospace"
		}
	});
	root.windowIcon = icon;
	addPlugin("notes", {
		"menuItem": {
			"fn": [lang["MENU_TITLE"], div({"id": pluginNotesID}, [
				button({"onclick": () => shell.prompt(lang["NOTES_NEW"], [lang["NOTES_NEW_LONG"], ": "], "").then(name => {
					if (name) {
						if (name.includes("/")) {
							shell.alert(lang["NAME_INVALID"], lang["NAME_INVALID_LONG"]);
						} else if (root.getItem(`/${name}`)) {
							shell.alert(lang["NAME_EXISTS"], lang["NAME_EXISTS_LONG"]);
						} else {
							const data = {"user": false, "data": {"contents": "", "share": false}};
							root.addItem(++lastID, name);
							pages.set(folders.data.items[name] = lastID, data);
							rpc.pluginSetting(importName, {"": folders, [lastID]: data}, []);
						}
					}
				})}, lang["NOTES_NEW"]),
				root[node]
			]), true, icon]
		}
	});
	rpc.waitPluginSetting().when(({id, setting, removing}) => {
		if (id !== importName) {
			return;
		}
		for (const sid of removing) {
			const id = parseInt(sid);
			if (!isNaN(id)) {
				pages.delete(id);
			}
		}
		for (const key in setting) {
			if (key === "") {
				if (!isFolderItems(setting[""].data)) {
					continue;
				}
				const changes: Record<string, number> = {};
				compareFolderItems(folders.data, setting[""].data, "/", changes);
				const ck = Object.keys(changes);
				let full = false;
				if (changes[""] || ck.length > 2) {
					full = true;
				} else if (ck.length === 1) {
					if (changes[ck[0]] < 0) {
						if (ck[0].endsWith("/")) {
							waitFolderRemoved[1](ck[0]);
						} else {
							waitRemoved[1](ck[0]);
						}
					} else {
						if (ck[0].endsWith("/")) {
							waitFolderAdded[1](ck[0]);
						} else {
							waitAdded[1]([{"id": changes[ck[0]], "name": ck[0]}]);
						}
					}
				} else if (ck.length === 2) {
					if (ck[0].endsWith("/") === ck[1].endsWith("/")) {
						if (ck[0].endsWith("/")) {
							const c = {};
							if (changes[ck[0]] < 0) {
								compareFolderItems(getFolder(ck[0])[0]!, getFolder(ck[1], setting[""].data)[0]!, "/", c);
							} else {
								compareFolderItems(getFolder(ck[0], setting[""].data)[0]!, getFolder(ck[1])[0]!, "/", c);
							}
							if (Object.keys(c).length === 0) {
								if (changes[ck[0]] < 0) {
									waitFolderMoved[1]({"from": ck[0], "to": ck[1]});
								} else {
									waitFolderMoved[1]({"from": ck[1], "to": ck[0]});
								}
							} else {
								full = true;
							}
						} else {
							if (changes[ck[0]] + changes[ck[1]] === 0) {
								if (changes[ck[0]] < 0) {
									waitMoved[1]({"from": ck[0], "to": ck[1]});
								} else {
									waitMoved[1]({"from": ck[1], "to": ck[0]});
								}
							} else {
								full = true;
							}
						}
					} else {
						full = true;
					}
				}
				if (full) {
					root.setRoot(setting[""].data);
				}
				folders.data = setting[""].data;
			} else {
				const id = parseInt(key),
				      data = setting[key];
				if (!isNaN(id) && isPage(data.data)) {
					pages.set(id, data);
				}
			}
		}
	});
	registerTag("note", (n: Node, t: Tokeniser, p: Parsers) => {
		const tk = t.next(true).value;
		if (tk && isOpenTag(tk) && tk.attr) {
			const id = parseInt(tk.attr);
			if (!isNaN(id)) {
				amendNode(n, process(span({"class": psuedoLink, "onclick": () => notes.get(id)?.show()}), t, p, tk.tagName));
			}
		}
	});
} else {
	registerTag("note", none);
}
