import type {FolderItems, KeystoreData, IDName, Uint} from '../types.js';
import type {Folder} from '../folders.js';
import {addPlugin, getSettings} from '../plugins.js';
import {button, div} from '../lib/html.js';
import {Subscription} from '../lib/inter.js';
import {isAdmin, isUint} from '../shared.js';
import {language} from '../language.js';
import {Item, Root} from '../folders.js';
import {rpc} from '../rpc.js';
import {shell} from '../windows.js';

type MetaURL = {
	url: string;
}

type Settings = Record<string, KeystoreData<string>> & {
	"": KeystoreData<FolderItems>;
}

if (isAdmin()) {
	class NoteItem extends Item {
		constructor(parent: Folder, id: Uint, name: string) {
			super(parent, id, name);
			if (id > lastID) {
				lastID = id;
			}
		}
		show() {
			// code here
		}
	}
	let lastID = 0;
	const defaultLanguage = {
		"MENU_TITLE": "Notes",
		"NAME_EXISTS": "Note Exists",
		"NAME_EXISTS_LONG": "A note with that name already exists",
		"NAME_INVALID": "Invalid Name",
		"NAME_INVALID_LONG": "Note names cannot contains the '/' (slash) character",
		"NOTES_NEW": "New Note",
		"NOTES_NEW_LONG": "Enter new note name",
	      },
	      langs: Record<string, typeof defaultLanguage> = {
		      "en-GB": defaultLanguage
	      },
	      lang = langs[language.value] ?? defaultLanguage,
	      importName = (import.meta as MetaURL).url.split("/").pop()!,
	      icon = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 84 96"%3E%3Crect x="60" y="6" width="24" height="90" fill="%23888" rx="10" /%3E%3Crect x="1" y="6" width="80" height="90" stroke="%23000" fill="%23fff" rx="10" /%3E%3Cg id="h"%3E%3Ccircle cx="16" cy="11" r="2" fill="%23333" /%3E%3Cellipse cx="15" cy="6" rx="3" ry="5" stroke="%23aaa" stroke-width="2" fill="none" stroke-dasharray="0 5 15" /%3E%3C/g%3E%3Cuse href="%23h" x="10" /%3E%3Cuse href="%23h" x="20" /%3E%3Cuse href="%23h" x="30" /%3E%3Cuse href="%23h" x="40" /%3E%3Cuse href="%23h" x="50" /%3E%3Cpath d="M11,25 h60 M11,40 h60 M11,55 h60 M11,70 h30" stroke="%23000" stroke-width="4" stroke-linecap="round" /%3E%3C/svg%3E',
	      pages = new Map<Uint, KeystoreData<string>>(),
	      defaultSettings = {"": {"user": false, "data": {"folders": {}, "items": {}}}} as Settings,
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
	      checkSettings = (data: any) => {
		if (!(data instanceof Object) || !(data[""] instanceof Object) || data[""].user !== false || !isFolderItems(data[""].data)) {
			return defaultSettings
		}
		for (const k in data) {
			if (k === "") {
				continue;
			} else {
				const id = parseInt(k);
				if (isNaN(id) || !(data[k] instanceof Object) || data[k].user !== false || typeof data[k].data !== "string") {
					return defaultSettings
				}
				pages.set(id, data[k]);
			}
		}
		return data as Settings;
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
	      unusedWait = new Subscription<any>(() => {}),
	      settings = checkSettings(getSettings(importName)),
	      root = new Root(settings[""].data, lang["MENU_TITLE"], {
		"list":        ()          => Promise.resolve(settings[""].data),
		"createFolder": path       => {
			const parts = path.split("/");
			let currPath = settings[""].data;
			Loop:
			for (const p of parts) {
				if (!currPath.folders[p]) {
					currPath = currPath.folders[p] = {"folders": {}, "items": {}};
				} else {
					currPath = currPath.folders[p];
				}
			}
			rpc.pluginSetting(importName, {"": settings[""]}, []);
			return Promise.resolve(path)
		},
		"move":        (_from, to) => Promise.resolve(to),
		"moveFolder":  (_from, to) => Promise.resolve(to),
		"remove":       _path      => Promise.resolve(),
		"removeFolder": _path      => Promise.resolve(),
		"copy":        (id, path)  => Promise.resolve({id, path}),

		"waitAdded": () => waitAdded[1],
		"waitMoved": () => waitMoved[1],
		"waitRemoved": () => waitRemoved[1],
		"waitCopied": () => unusedWait,
		"waitFolderAdded": () => waitFolderAdded[1],
		"waitFolderMoved": () => unusedWait,
		"waitFolderRemoved": () => unusedWait,
	      }, NoteItem);
	root.windowIcon = icon;
	addPlugin("notes", {
		"menuItem": {
			"priority": 0,
			"fn": [lang["MENU_TITLE"], div([
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
					settings[""].data.items[name] = lastID;
					rpc.pluginSetting(importName, {"": settings[""], [lastID]: {"user": false, "data": ""}}, []);
				})}, lang["NOTES_NEW"]),
				root.node
			]), true, icon]
		}
	});
}
