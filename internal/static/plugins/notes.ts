import type {FolderItems, KeystoreData, IDName, Uint} from '../types.js';
import type {Folder} from '../folders.js';
import type {WindowElement} from '../windows.js';
import {addPlugin, getSettings} from '../plugins.js';
import {createHTML, button, div, style} from '../lib/html.js';
import {Subscription} from '../lib/inter.js';
import {isAdmin, isUint} from '../shared.js';
import {language} from '../language.js';
import {Item, Root} from '../folders.js';
import {rpc} from '../rpc.js';
import {shell, windows} from '../windows.js';
import {all} from '../lib/bbcode_tags.js';
import bbcode from '../lib/bbcode.js';

type MetaURL = {
	url: string;
}

type Page = {
	contents: string;
}

if (isAdmin()) {
	class NoteItem extends Item {
		window: WindowElement | null = null;
		constructor(parent: Folder, id: Uint, name: string) {
			super(parent, id, name);
			if (id > lastID) {
				lastID = id;
			}
		}
		show() {
			if (this.window) {
				shell.appendChild(this.window);
			} else {
				this.window = shell.appendChild(windows({"windows-title": this.name, "windows-icon": icon, "onremove": () => this.window = null}, bbcode(createHTML(null), all, pages.get(this.id)?.data.contents || "")));
				this.window.addControlButton(editIcon, () => {}, lang["NOTE_EDIT"]);
			}
		}
	}
	document.head.appendChild(style({"type": "text/css"}, "#pluginNotes ul{padding:0}"));
	let lastID = 0;
	const defaultLanguage = {
		"ERROR_FOLDER_NOT_EMPTY": "Cannot remove a non-empty folder",
		"ERROR_INVALID_FOLDER": "Invalid Folder",
		"ERROR_INVALID_ITEM": "Invalid Item",
		"ERROR_INVALID_PATH": "Invalid Path",
		"MENU_TITLE": "Notes",
		"NAME_EXISTS": "Note Exists",
		"NAME_EXISTS_LONG": "A note with that name already exists",
		"NAME_INVALID": "Invalid Name",
		"NAME_INVALID_LONG": "Note names cannot contains the '/' (slash) character",
		"NOTE_EDIT": "Edit Note",
		"NOTES_NEW": "New Note",
		"NOTES_NEW_LONG": "Enter new note name",
	      },
	      langs: Record<string, typeof defaultLanguage> = {
		      "en-GB": defaultLanguage
	      },
	      lang = langs[language.value] ?? defaultLanguage,
	      importName = (import.meta as MetaURL).url.split("/").pop()!,
	      icon = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 84 96"%3E%3Crect x="60" y="6" width="24" height="90" fill="%23888" rx="10" /%3E%3Crect x="1" y="6" width="80" height="90" stroke="%23000" fill="%23fff" rx="10" /%3E%3Cg id="h"%3E%3Ccircle cx="16" cy="11" r="2" fill="%23333" /%3E%3Cellipse cx="15" cy="6" rx="3" ry="5" stroke="%23aaa" stroke-width="2" fill="none" stroke-dasharray="0 5 15" /%3E%3C/g%3E%3Cuse href="%23h" x="10" /%3E%3Cuse href="%23h" x="20" /%3E%3Cuse href="%23h" x="30" /%3E%3Cuse href="%23h" x="40" /%3E%3Cuse href="%23h" x="50" /%3E%3Cpath d="M11,25 h60 M11,40 h60 M11,55 h60 M11,70 h30" stroke="%23000" stroke-width="4" stroke-linecap="round" /%3E%3C/svg%3E',
	      editIcon = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 70 70" fill="none" stroke="%23000"%3E%3Cpolyline points="51,7 58,0 69,11 62,18 51,7 7,52 18,63 62,18" stroke-width="2" /%3E%3Cpath d="M7,52 L1,68 L18,63 M53,12 L14,51 M57,16 L18,55" /%3E%3C/svg%3E',
	      pages = new Map<Uint, KeystoreData<Page>>(),
	      defaultSettings = {"user": false, "data": {"folders": {}, "items": {}}} as KeystoreData<FolderItems>,
	      isFolderItems = (data: any): data is FolderItems => {
		if (!(data instanceof Object) || !(data["folders"] instanceof Object) || !(data["items"] instanceof Object)) {
			return false;
		}
		for (const i in data["items"]) {
			const id = data["items"][i];
			if (!isUint(id)) {
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
			if (k === "") {
				continue;
			} else {
				const id = parseInt(k);
				if (isNaN(id) || !(data[k] instanceof Object) || data[k].user !== false || !isPage(data[k].data)) {
					return defaultSettings
				}
				pages.set(id, data[k]);
			}
		}
		return data[""] as KeystoreData<FolderItems>;
	      },
	      subFn = <T>(): [(data: T) => void, Subscription<T>] => {
	        let fn: (data: T) => void;
		const sub = new Subscription<T>(resolver => fn = resolver);
		return [fn!, sub];
	      },
	      waitAdded = subFn<IDName[]>(),
	      waitMoved = subFn<{from: string; to: string}>(),
	      waitRemoved = subFn<string>(),
	      waitFolderAdded = subFn<string>(),
	      waitFolderMoved = subFn<{from: string, to: string}>(),
	      waitFolderRemoved = subFn<string>(),
	      unusedWait = new Subscription<any>(() => {}),
	      folders = checkSettings(getSettings(importName)),
	      getFolder = (path: string, currPath = folders.data): [FolderItems | null, string] => {
		const parts = path.split("/"),
		      name = parts.pop()!;
		for (const p of parts) {
			currPath = currPath.folders[p];
			if (!currPath) {
				return [null, name];
			}
		}
		return [currPath, name];
	      },
	      root = new Root(folders.data, lang["MENU_TITLE"], {
		"list": () => Promise.resolve(folders.data),
		"createFolder": path => {
			const [currPath, folder] = getFolder(path);
			if (!currPath) {
				return Promise.reject(lang["ERROR_INVALID_PATH"]);
			} else if (currPath.folders[folder]) {
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
				return Promise.reject(lang["ERROR_INVALID_PATH"]);
			}
			const id = fromPath.items[fromItem];
			if (id === undefined) {
				return Promise.reject(lang["ERROR_INVALID_ITEM"]);
			}
			if (toPath.items[toItem]) {
				return Promise.reject(lang["NAME_EXISTS_LONG"]);
			}
			delete fromPath.items[fromItem];
			toPath.items[toItem] = id;
			rpc.pluginSetting(importName, {"": folders}, []);
			return Promise.resolve(to)
		},
		"moveFolder": (from, to) => {
			const [fromPath, fromFolder] = getFolder(from),
			      [toPath, toFolder] = getFolder(to);
			if (!fromPath || !toPath) {
				return Promise.reject(lang["ERROR_INVALID_PATH"]);
			}
			if (!fromPath.folders[fromFolder]) {
				return Promise.reject(lang["ERROR_INVALID_PATH"]);
			}
			if (toPath.folders[toFolder]) {
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
				return Promise.reject(lang["ERROR_INVALID_PATH"]);
			}
			const id = currPath.items[item];
			if (id === undefined) {
				return Promise.reject(lang["ERROR_INVALID_ITEM"]);
			}
			pages.delete(id);
			delete currPath.items[item];
			rpc.pluginSetting(importName, {"": folders}, [id + ""]);
			return Promise.resolve();
		},
		"removeFolder": path => {
			const [currPath, folder] = getFolder(path);
			if (!currPath) {
				return Promise.reject(lang["ERROR_INVALID_PATH"]);
			}
			const f = currPath.folders[folder];
			if (!f) {
				return Promise.reject(lang["ERROR_INVALID_FOLDER"]);
			} else if (Object.keys(f.folders).length !== 0 || Object.keys(f.items).length !== 0) {
				return Promise.reject(lang["ERROR_FOLDER_NOT_EMPTY"]);
			}
			delete currPath.folders[folder];
			rpc.pluginSetting(importName, {"": folders}, []);
			return Promise.resolve()
		},
		"copy": (id, path) => {
			const [currPath, item] = getFolder(path);
			if (!currPath) {
				return Promise.reject(lang["ERROR_INVALID_PATH"]);
			} else if (currPath.items[item]) {
				return Promise.reject(lang["NAME_EXISTS_LONG"]);
			}
			const newID = ++lastID,
			      newPage = JSON.parse(JSON.stringify(pages.get(id)!));
			currPath.items[item] = newID;
			pages.set(id, newPage);
			rpc.pluginSetting(importName, {"": folders, [id + ""]: newPage}, []);
			return Promise.resolve({id, path})
		},

		"waitAdded": () => waitAdded[1],
		"waitMoved": () => waitMoved[1],
		"waitRemoved": () => waitRemoved[1],
		"waitCopied": () => unusedWait,
		"waitFolderAdded": () => waitFolderAdded[1],
		"waitFolderMoved": () => waitFolderMoved[1],
		"waitFolderRemoved": () => waitFolderRemoved[1],
	      }, NoteItem),
	      compareFolderItems = (a: FolderItems, b: FolderItems, path: string, changes: Record<string, number>) => {
		for (const f in a.folders) {
			const fp = path + f + "/"
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
	      };
	root.windowIcon = icon;
	addPlugin("notes", {
		"menuItem": {
			"priority": 0,
			"fn": [lang["MENU_TITLE"], div({"id": "pluginNotes"}, [
				button({"onclick": () => shell.prompt(lang["NOTES_NEW"], `${lang["NOTES_NEW_LONG"]}:`, "").then(name => {
					if (!name) {
						return;
					} else if (name.includes("/")) {
						shell.alert(lang["NAME_INVALID"], lang["NAME_INVALID_LONG"]);
						return;
					} else if (root.getItem(`/${name}`)) {
						shell.alert(lang["NAME_EXISTS"], lang["NAME_EXISTS_LONG"]);
						return;
					}
					root.addItem(++lastID, name);
					folders.data.items[name] = lastID;
					rpc.pluginSetting(importName, {"": folders, [lastID]: {"user": false, "data": {"contents": ""}}}, []);
				})}, lang["NOTES_NEW"]),
				root.node
			]), true, icon]
		}
	});
	rpc.waitPluginSetting().then(({id, setting, removing}) => {
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
							waitFolderRemoved[0](ck[0]);
						} else {
							waitRemoved[0](ck[0]);
						}
					} else {
						if (ck[0].endsWith("/")) {
							waitFolderAdded[0](ck[0]);
						} else {
							waitAdded[0]([{"id": changes[ck[0]], "name": ck[0]}]);
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
									waitFolderMoved[0]({"from": ck[0], "to": ck[1]});
								} else {
									waitFolderMoved[0]({"from": ck[1], "to": ck[0]});
								}
							} else {
								full = true;
							}
						} else {
							if (changes[ck[0]] + changes[ck[1]] === 0) {
								if (changes[ck[0]] < 0) {
									waitMoved[0]({"from": ck[0], "to": ck[1]});
								} else {
									waitMoved[0]({"from": ck[1], "to": ck[0]});
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
			} else {
				const id = parseInt(key),
				      data = setting[key];
				if (!isNaN(id) && isPage(data.data)) {
					pages.set(id, data);
				}
			}
		}
	});
}
