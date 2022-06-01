import type {FolderItems, FromTo, IDName, Int, KeystoreData, TokenLight, Uint} from '../types.js';
import type {WindowElement} from '../windows.js';
import {amendNode} from '../lib/dom.js';
import {DragTransfer, setDragEffect} from '../lib/drag.js';
import {div} from '../lib/html.js';
import {Subscription} from '../lib/inter.js';
import {node} from '../lib/nodes.js';
import {circle, radialGradient, rect, svg, svgData} from '../lib/svg.js';
import {dragLighting} from '../adminMap.js';
import {Colour} from '../colours.js';
import {DragFolder, DraggableItem, Folder, Root} from '../folders.js';
import {language} from '../language.js';
import {definitions} from '../map_tokens.js';
import {addPlugin, getSettings, pluginName} from '../plugins.js';
import {handleError, isAdmin, rpc} from '../rpc.js';
import {enableLightingAnimation} from '../settings.js';
import {addCSS, isUint} from '../shared.js';
import {shell, windows} from '../windows.js';

if (isAdmin) {
	class DraggedLight {
		id: Int;
		lightColours: Colour[][];
		lightStages: Uint[];
		lightTimings: Uint[];
		constructor(id: Int) {
			this.id = -id;
			const {lightColours = [], lightStages = [], lightTimings = []} = lightData.get(id)?.data ?? {};
			this.lightColours = lightColours;
			this.lightStages = lightStages;
			this.lightTimings = lightTimings;
		}
		getCentre(): [Uint, Uint] { return [0, 0]; }
		getLightPos(): [Uint, Uint] { return [5, 5]; }
		transfer() {
			return this;
		}
	}
	class LightItem extends DraggableItem {
		#window: WindowElement | null = null;
		#dragLightID: string;
		#draggedLight: DraggedLight;
		constructor(parent: Folder, id: Uint, name: string) {
			super(parent, id, name, dragLightItem);
			amendNode(this.image, {"src": icon, "width": "20px", "height": "20px"});
			lights.set(id, this);
			this.#dragLightID = dragLighting.register(this.#draggedLight = new DraggedLight(id));
		}
		show() {
			if (this.#window) {
				this.#window.focus();
			} else {
				let r = radialGradient();
				const fn = () => {
					const lid = definitions.addLighting(this.#draggedLight, 5 / this.#draggedLight.lightStages.reduce((a, b) => a + b, 0)),
					      lrg = document.getElementById(lid);
					console.log(1);
					if (lrg) {
						const lr = amendNode(lrg.cloneNode(true) as SVGRadialGradientElement, {"id": "plugin-lighting-" + lid});
						r.replaceWith(lr);
						r = lr;
						lrg.remove();
						amendNode(c, {"fill": `url(#plugin-lighting-${lid})`});
					}
				      },
				      cfn = lightingUpdated().then(fn),
				      c = circle({"cx": "5", "cy": "5", "r": "5"});
				fn();
				amendNode(shell, this.#window = windows({"window-title": this.name, "window-icon": icon, "resizable": true, "style": {"--window-width": "50%", "--window-height": "50%"}, "onremove": () => {
					this.#window = null;
					cfn.cancel();
				}}, svg({"viewBox": "0 0 10 10"}, [
					rect({"width": "5", "height": "10", "fill": "#fff"}),
					rect({"x": "5", "width": "5", "height": "10", "fill": "#000"}),
					r,
					c
				])));
			}
		}
		ondragstart(e: DragEvent) {
			super.ondragstart(e);
			if (!e.defaultPrevented) {
				dragLighting.set(e, this.#dragLightID);
			}
		}
		delete() {
			this.#window?.remove();
			dragLighting.deregister(this.#dragLightID);
		}
	}

	class LightFolder extends DragFolder<LightItem> {
		constructor(root: Root, parent: Folder | null, name: string, children: FolderItems) {
			super(root, parent, name, children, dragLightItem, dragLightFolder);
		}
		removeItem(name: string) {
			const light = this.getItem(name) as LightItem | undefined,
			      id = super.removeItem(name);
			light?.delete();
			lights.delete(id);
			return id;
		}
		ondragover(e: DragEvent) {
			super.ondragover(e);
			dragLightingOver(e);
		}
		ondragenter(e: DragEvent) {
			super.ondragenter(e);
			if (dragLighting.is(e)) {
				amendNode(this[node], {"class": ["dragover"]});
				amendNode(this.root[node], {"class": ["folderDragging"]});
			}
		}
		ondrop(e: DragEvent) {
			super.ondrop(e);
			if (dragLighting.is(e)) {
				const {id, lightColours, lightStages, lightTimings} = dragLighting.get(e);
				if (id >= 0) {
					shell.prompt(lang["NEW_NAME_TITLE"], lang["NEW_NAME"], "", icon).then(name => {
						if (name) {
							if (name.includes("/")) {
								shell.alert(lang["NAME_INVALID"], lang["NAME_INVALID_LONG"]);
							} else if (this.children.has(name)) {
								shell.alert(lang["NAME_EXISTS"], lang["NAME_EXISTS_LONG"]);
							} else {
								const data = {"user": false, "data": {lightColours, lightStages, lightTimings}},
								      [f] = getFolder(this.getPath() + "/");
								if (f) {
									this.addItem(++lastID, name);
									lightData.set(f.items[name] = lastID, data);
									rpc.pluginSetting(importName, {"": folders, [lastID]: data}, []);
								}
							}
						}
					});
				}
			}
		}
	}

	let lastID = 0;
	const defaultLanguage = {
		"ERROR_FOLDER_NOT_EMPTY": "Cannot remove a non-empty folder",
		"ERROR_INVALID_FOLDER": "Invalid Folder",
		"ERROR_INVALID_ITEM": "Invalid Item",
		"ERROR_INVALID_PATH": "Invalid Path",
		"MENU_TITLE": "Light Profiles",
		"NAME_EXISTS": "Light Profile Exists",
		"NAME_EXISTS_LONG": "A Light Profile with that name already exists",
		"NAME_INVALID": "Invalid Name",
		"NAME_INVALID_LONG": "Light Profile names cannot contains the '/' (slash) character",
		"NEW_NAME": "Please enter a name for this Light Profile",
		"NEW_NAME_TITLE": "Light Profile Name"
	      },
	      langs: Record<string, typeof defaultLanguage> = {
		"en-GB": defaultLanguage
	      },
	      lang = langs[language.value] ?? defaultLanguage,
	      icon = svgData(document.getElementById("lightGrid") as any as SVGSymbolElement),
	      [s, lightingUpdate] = Subscription.bind(1),
	      lightingUpdated = s.splitCancel(),
	      dragLightItem = new DragTransfer<LightItem>("pluginlightitem"),
	      dragLightFolder = new DragTransfer<LightFolder>("pluginlightfolder"),
	      importName = pluginName(import.meta),
	      lightData = new Map<Uint, KeystoreData<TokenLight>>(),
	      lights = new Map<Uint, LightItem>(),
	      defaultSettings = {"user": false, "data": {"folders": {}, "items": {}}} as KeystoreData<FolderItems>,
	      isFolderItems = (data: any): data is FolderItems => {
		if (!(data instanceof Object) || !(data["folders"] instanceof Object) || !(data["items"] instanceof Object)) {
			return false;
		}
		for (const i in data["items"]) {
			if (!isUint(data["items"][i])) {
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
	      isLightData = (data: any): data is TokenLight => {
		      if (data instanceof Object && data["lightColours"] instanceof Array && data["lightStages"] instanceof Array && data["lightTimings"] instanceof Array && data["lightColours"].length === data["lightStages"].length) {
			      for (const cs of data["lightColours"]) {
				      if (!(cs instanceof Array) || cs.length !== data["lightTimings"].length) {
					      return false;
				      }
				      for (const c of cs) {
					      if (!(c instanceof Object) || !isUint(c["r"], 255) || !isUint(c["g"], 255) || !isUint(c["b"], 255) || !isUint(c["a"], 255)) {
						      return false;
					      }
					      Colour.from(c);
				      }
			      }
			      for (const s of data["lightStages"]) {
				      if (!isUint(s)) {
					      return false;
				      }
			      }
			      for (const s of data["lightTimings"]) {
				      if (!isUint(s)) {
					      return false;
				      }
			      }
			      return true;
		      }
		      return false;
	      },
	      checkSettings = (data: any) => {
		if (!(data instanceof Object) || !(data[""] instanceof Object) || data[""].user !== false || !isFolderItems(data[""].data)) {
			return defaultSettings
		}
		for (const k in data) {
			if (k !== "") {
				const id = parseInt(k);
				if (!isNaN(id) && data[k] instanceof Object && !data[k].user && isLightData(data[k].data)) {
					lightData.set(id, data[k]);
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
			lightData.delete(id);
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
			currPath.items[item] = id;
			rpc.pluginSetting(importName, {"": folders}, []);
			return Promise.resolve({id, path})
		},
		"waitAdded": () => waitAdded[0],
		"waitMoved": () => waitMoved[0],
		"waitRemoved": () => waitRemoved[0],
		"waitCopied": () => unusedWait,
		"waitFolderAdded": () => waitFolderAdded[0],
		"waitFolderMoved": () => waitFolderMoved[0],
		"waitFolderRemoved": () => waitFolderRemoved[0]
	      }, LightItem, LightFolder),
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
	      dragLightingOver = setDragEffect({"copy": [dragLighting]});
	enableLightingAnimation.wait(lightingUpdate);
	addCSS("#pluginLights ul{padding-left: 1em;list-style: none}#pluginLights>div>ul{padding:0}"),
	root.windowIcon = icon;
	addPlugin("lights", {
		"menuItem": {
			"priority": 0,
			"fn": [lang["MENU_TITLE"], div({"id": "pluginLights"}, root[node]), true, icon]
		}
	});
	rpc.waitPluginSetting().then(({id, setting, removing}) => {
		if (id !== importName) {
			return;
		}
		for (const sid of removing) {
			const id = parseInt(sid);
			if (!isNaN(id)) {
				lightData.delete(id);
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
				if (!isNaN(id) && isLightData(data.data)) {
					lightData.set(id, data);
				}
			}
		}
	});
}