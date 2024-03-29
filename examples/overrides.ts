const lastTokenID = Symbol("lastTokenID"),
      tokenList = Symbol("tokenList"),
      lastWallID = Symbol("lastWallID"),
      wallList = Symbol("wallList"),
      lastMapID = Symbol("lastMapID"),
      lastCharacterID = Symbol("lastCharacterID"),
      lastMusicPackID = Symbol("lastMusicPackID");

type Folder = {
	folders: Record<string, Folder>;
	items: Record<string, number>;
}

type Colour = {
	r: number;
	g: number;
	b: number;
	a: number;
}

type Coords = {
	x: number;
	y: number;
}

type Token = Coords & {
	id: number;
	src: string;
	width: number;
	height: number;
	patternWidth: number;
	patternHeight: number;
	tokenData: Record<string, KeystoreData>;
	rotaton: number;
	flip: boolean;
	flop: boolean;
	snap: boolean;
	lightColours: Colour[][];
	lightStages: number[];
	lightTimings: number[];
	tokenType: number;
	isEllipse: boolean;
	strokeWidth: number;
	fill: Colour;
	fillType: number;
	stroke: Colour;
	points: Coords[];
}

type SetToken = Partial<Token> & {
	id: number;
	removeTokenData?: string[];
}

type Wall = {
	id: number;
	x1: number;
	y1: number;
	x2: number;
	y2: number;
	colour: Colour;
	scattering: number;
}

type Layer = {
	name: string;
	hidden: boolean;
	locked: boolean;
	tokens?: Token[];
	walls?: Wall[];
	children?: Layer[];
}

type MapData = Layer & {
	width: number;
	height: number;
	startX: number;
	startY: number;
	gridType: number;
	gridSize: number;
	gridStroke: number;
	gridColour: Colour;
	gridDistance: number;
	gridDiagonal: boolean;
	lightColour: Colour;
	baseOpaque: boolean;
	masks: number[][];
	data: Record<string, unknown>;
	[lastTokenID]: number;
	[lastWallID]: number;
	[tokenList]: Record<number, {layer: Layer; token: Token}>;
	[wallList]: Record<number, {layer: Layer, wall: Wall}>;
}

type KeystoreData = {
	user: boolean;
	data: unknown;
}

type MusicTrack = {
	id: number;
	volume: number;
	repeat: number;
}

type MusicPack = {
	name: string;
	tracks: MusicTrack[];
	volume: number;
	playTime: number;
}

type FromTo = {
	from: string;
	to: string;
}

type IDPath = {
	id: number;
	path: string;
}

declare const exampleData: {
	admin: boolean;
	currentMap: number;
	currentUserMap: number;
	urls: {
		images: string[];
		audio: string[];
	};
	mapData: Record<number, MapData>;
	characterData: Record<number, Record<string, KeystoreData>>;
	images: Folder;
	audio: Folder;
	characters: Folder;
	maps: Folder;
	music: Record<number, MusicPack>;
	plugins: Record<string, {
		enabled: boolean;
		data: Record<string, KeystoreData>;
	}>;
	localStorage: Record<string, string>;
	[lastCharacterID]: number;
	[lastMapID]: number;
	[lastMusicPackID]: number;
};

const uniqueName = (name: string, checker: (name: string) => boolean) => {
	if (checker(name)) {
		return name;
	}
	for (let i = 0;; i++) {
		const newName = name + "." + i;
		if (checker(newName)) {
			return newName;
		}
	}
      },
      addItemTo = (items: Record<string, number>, name: string, id: number) => uniqueName(name, name => {
	if (!items[name]) {
		items[name] = id;
		return true;
	}
	return false;
      }),
      addFolderTo = (folders: Record<string, Folder>, name: string, f: Folder) => uniqueName(name, name => {
	if (!folders[name]) {
		folders[name] = f;
		return true;
	}
	return false;
      }),
      getFolder = (root: Folder, path: string) => {
	let d = root;
	for (const part of path.split("/")) {
		if (!part) {
			continue;
		}
		const e = d.folders[part];
		if (!e) {
			return null;
		}
		d = e;
	}
	return d;
      },
      splitAfterLastSlash = (p: string) => {
	const lastSlash = p.lastIndexOf('/');
	if (lastSlash >= 0) {
		return [p.slice(0, lastSlash), p.slice(lastSlash + 1)] as const;
	}
	return ["", p] as const;
      },
      trimLeft = (str: string, char: string) => {
	while (str.charAt(0) === char) {
		str = str.slice(1);
	}
	return str;
      },
      trimRight = (str: string, char: string) => {
	while (str.charAt(str.length - 1) === char) {
		str = str.slice(0, -1);
	}
	return str;
      },
      cleanPath = (path: string) => {
	while (path.includes("//")) {
		path = path.replaceAll("//", "/");
	}
	return path;
      },
      getParentFolder = (root: Folder, p: string) => {
	let parent: Folder | null;
	const [parentStr, name] = splitAfterLastSlash(cleanPath(trimRight(p, "/")));
	if (parentStr) {
		parent = getFolder(root, parentStr);
		if (!parent) {
			return [null, "", null] as const;
		}
	} else {
		parent = root;
	}
	return [parent, name, parent.folders[name]] as const;
      },
      getFolderItem = (root: Folder, p: string) => {
	const [dir, file] = splitAfterLastSlash(p),
	      parent = getFolder(root, cleanPath(dir));
	return parent ?  [parent, file, parent.items[file]] as const : [null, "", 0] as const;
      },
      walkFolders = (f: Folder, fn: (items: Record<string, number>) => boolean) => {
	if (fn(f.items)) {
		return true;
	}
	for (const folder in f.folders) {
		if (walkFolders(f.folders[folder], fn)) {
			return true;
		}
	}
	return false;
      },
      folderCreate = (root: Folder, path: string) => {
	const [parent, name] = getParentFolder(root, path);
	if (!parent || !name) {
		return "";
	}
	return path.slice(0, path.length - name.length) + addFolderTo(parent.folders, name, {folders: {}, items: {}});
      },
      itemMove = (root: Folder, from: string, to: string) => {
	const [oldParent, oldName, iid] = getFolderItem(root, from);
	if (!oldParent || !iid) {
		return "";
	}
	let newParent: Folder | null,
	    newName: string;
	if (to.endsWith("/")) {
		newParent = getFolder(root, trimRight(to, "/"));
		newName = oldName;
	} else {
		const [path, file] = splitAfterLastSlash(to);
		newName = file;
		to = trimRight(path, "/");
		newParent = getFolder(root, to);
	}
	delete oldParent.items[oldName];
	return to + "/" + addItemTo(newParent!.items, newName, iid);
      },
      folderMove = (root: Folder, from: string, to: string) => {
	const [oldParent, oldName, fd] = getParentFolder(root, from);
	if (!oldParent || !fd) {
		return "";
	}
	let newParent: Folder | null,
	    newName: string;
	if (to.endsWith("/")) {
		newParent = getFolder(root, trimRight(to, "/"));
		newName = oldName;
	} else {
		const [path, file] = splitAfterLastSlash(to);
		newName = file;
		to = trimRight(path, "/");
		newParent = getFolder(root, to);
	}
	if (to.endsWith(from)) {
		return "";
	}
	delete oldParent.folders[oldName];
	return to + "/" + addFolderTo(newParent!.folders, newName, fd);
      },
      itemDelete = (root: Folder, item: string) => {
	const [parent, oldName, iid] = getFolderItem(root, item);
	if (!parent || !iid) {
		return null;
	}
	delete parent.items[oldName];
	return null;
      },
      folderDelete = (root: Folder, folder: string) => {
	const [parent, oldName, fd] = getParentFolder(root, folder);
	if (!parent || !fd) {
		return null;
	}
	delete parent.folders[oldName];
	return null;
      },
      copyItem = (root: Folder, id: number, path: string) => {
	let [parent, name] = getFolderItem(root, path);
	if (!parent) {
		return "";
	}
	if (!name) {
		name = id + "";
	}
	return {"id": id, "path": path.slice(0, name.length) + addItemTo(parent.items, name, id)};
      },
      currentMap = () => exampleData.mapData[exampleData.currentMap],
      getLayers = (layers: Layer = currentMap(), ls: Record<string, Layer> = {}) => {
	for (const layer of layers.children ?? []) {
		ls[layer.name] = layer;
		getLayers(layer, ls);
	}
	return ls;
      },
      uniqueLayer = (name: string) => {
	const ls = getLayers();
	return uniqueName(name, name => !(name in ls));
      },
      getLayer = (path: string) => {
	let l = currentMap() as Layer;
	Loop:
	for (const p of trimRight(trimLeft(path, "/"), "/").split("/")) {
		if (!p) {
			continue;
		}
		for (const m of l.children ?? []) {
			if (m.name === p) {
				l = m;
				continue Loop;
			}
		}
		return null;
	}
	return l;
      },
      getParentLayer = (path: string) => {
	const [parentStr, name] = splitAfterLastSlash(trimRight(path, "/")),
	      parent = getLayer(parentStr);
	if (parent) {
		for (const l of parent.children ?? []) {
			if (l.name === name) {
				return [parent, l];
			}
		}
	}
	return [null, null];
      },
      updateToken = (st: SetToken) => {
	const {token: tk} = currentMap()[tokenList][st.id];
	if (st.tokenData) {
		Object.assign(tk.tokenData, st.tokenData);
		delete st.tokenData;
	}
	if (st.removeTokenData) {
		for (const r of st.removeTokenData) {
			delete tk.tokenData[r];
		}
		delete st.removeTokenData;
	}
	for (const key of Object.keys(st)) {
		(tk as any)[key] = st[key as keyof SetToken];
	}
      },
      initMap = (map: MapData, layer: Layer) => {
	for (const token of layer.tokens ?? []) {
		map[tokenList][token.id] = {layer, token};
		if (token.id > map[lastTokenID]) {
			map[lastTokenID] = token.id;
		}
	}
	for (const wall of layer.walls ?? []) {
		map[wallList][wall.id] = {layer, wall};
		if (wall.id > map[lastWallID]) {
			map[lastWallID] = wall.id;
		}
	}
	for (const l of layer.children ?? []) {
		initMap(map, l);
	}
      };

exampleData[lastCharacterID] = 0;
exampleData[lastMapID] = 0;
exampleData[lastMusicPackID] = 0;

for (const cStr in exampleData.characterData) {
	const cID = parseInt(cStr);
	if (cID < exampleData[lastCharacterID]) {
		exampleData[lastCharacterID] = cID;
	}
}

for (const mStr in exampleData.mapData) {
	const mID = parseInt(mStr),
	      m = exampleData.mapData[mID];
	if (mID < exampleData[lastMapID]) {
		exampleData[lastMapID] = mID;
	}
	m[lastTokenID] = m[lastWallID] = 0;
	m[tokenList] = {};
	m[wallList] = {};
	initMap(m, m);
}

for (const mStr in exampleData.music) {
	const mID = parseInt(mStr);
	if (mID < exampleData[lastMusicPackID]) {
		exampleData[lastMusicPackID] = mID;
	}
}

Object.defineProperties(window, {
	"WebSocket": {
		"value": class WebSocket extends EventTarget {
			constructor() {
				super();
				setTimeout(() => this.dispatchEvent(new Event("open")));
				setTimeout(() => this.#send(-1, exampleData.admin ? 2 : 1));
			}
			send(data: string) {
				const packet = JSON.parse(data);
				this.#send(packet.id, this.#handle(packet.method, packet.params));
			}
			#handle(method: string, params: unknown) {
				switch (method) {
				case "conn.ready":
					if (exampleData.admin) {
						this.#send(-2, exampleData.currentMap);
					} else if (exampleData.currentUserMap > 0) {
						this.#send(-3, exampleData.mapData[exampleData.currentUserMap]);
					}
					break;
				case "conn.currentTime":
					return Math.floor(Date.now() / 1000);
				case "maps.setCurrentMap":
					exampleData.currentMap = JSON.parse(params as string);
					return null;
				case "maps.getUserMap":
					return exampleData.currentUserMap;
				case "maps.setUserMap":
					exampleData.currentUserMap = JSON.parse(params as string);
					return null;
				case "maps.getMapData":
					return exampleData.mapData[params as number];
				case "maps.new": {
					const mid = ++exampleData[lastMusicPackID];
					exampleData.mapData[mid] = Object.assign(params as {
							name: string;
							width: number;
							height: number;
							gridType: number;
							gridSize: number;
							gridColour: Colour;
							gridStroke: number;
						}, {
							startX: 0,
							startY: 0,
							gridDistance: 0,
							gridDiagonal: false,
							lightColour: {r: 0, g: 0, b: 0, a: 0},
							baseOpaque: false,
							masks: [],
							data: {},
							hidden: false,
							locked: false,
							tokens: [],
							walls: [],
							children: [
								{
									name: "Layer",
									hidden: false,
									locked: false,
									tokens: [],
									walls: []
								},
								{
									name: "Light",
									hidden: false,
									locked: false,
									tokens: [],
									walls: []
								},
								{
									name: "Grid",
									hidden: false,
									locked: false,
									tokens: [],
									walls: []
								}
							],
							[lastTokenID]: 0,
							[lastWallID]: 0,
							[tokenList]: {},
							[wallList]: {}
						});
					return {
						"id": mid,
						"name": addItemTo(exampleData.maps.items, (params as {name: string}).name, mid)
					};
				}
				case "maps.setMapDetails": {
					Object.assign(currentMap(), params);
					return null;
				}
				case "maps.setMapStart": {
					const data = params as [number, number],
					      m = currentMap();
					m.startX = data[0];
					m.startY = data[1];
					return null;
				}
				case "maps.setGridDistance":
					currentMap().gridDistance = params as number;
					return null;
				case "maps.setGridDiagonal":
					currentMap().gridDiagonal = params as boolean;
					return null;
				case "maps.setLightColour":
					currentMap().lightColour = params as Colour;
					return null;
				case "maps.setData":
					currentMap().data[(params as {key: string}).key] = (params as {data: any}).data;
					return null;
				case "maps.removeData":
					delete currentMap().data[params as string];
					return null;
				case "maps.addLayer": {
					const name = uniqueLayer(params as string);
					currentMap().children?.push({
						name,
						"hidden": false,
						"locked": false,
						"tokens": [],
						"walls": []
					});
					return name;
				}
				case "maps.addLayerFolder": {
					const [parent, oldName] = splitAfterLastSlash(params as string),
					      name = uniqueLayer(oldName);
					getLayer(parent)?.children?.push({
						name,
						"hidden": false,
						"locked": false,
						"children": []
					});
					return parent + "/" + name;
				}
				case "maps.renameLayer": {
					const data = params as {path: string; name: string};
					data.name = (getLayer(data.path) ?? {"name": ""}).name = uniqueLayer(data.name);
					return data;
				}
				case "maps.moveLayer": {
					const moveLayer = params as {from: string; to: string; position: number},
					      [pl, l] = getParentLayer(moveLayer.from),
					      to = getLayer(moveLayer.to);
					if (pl?.children && l && to?.children) {
						pl.children.splice(pl.children.indexOf(l), 1);
						to.children.splice(moveLayer.position, 0, l);
					}
					return null;
				}
				case "maps.showLayer": {
					const l = getLayer(params as string);
					if (l) {
						l.hidden = false;
					}
					return null;
				}
				case "maps.hideLayer": {
					const l = getLayer(params as string);
					if (l) {
						l.hidden = true;
					}
					return null;
				}
				case "maps.lockLayer": {
					const l = getLayer(params as string);
					if (l) {
						l.locked = true;
					}
					return null;
				}
				case "maps.unlockLayer": {
					const l = getLayer(params as string);
					if (l) {
						l.locked = false;
					}
					return null;
				}
				case "maps.addToMask":
					currentMap().masks.push(params as number[]);
					return null;
				case "maps.removeFromMask":
					currentMap().masks.splice(params as number, 1);
					return null;
				case "maps.setMask": {
					const m = currentMap();
					m.masks = (params as {masks: number[][]}).masks;
					m.baseOpaque = (params as {baseOpaque: boolean}).baseOpaque;
					return null;
				}
				case "maps.removeLayer": {
					const [pl, l] = getParentLayer(params as string);
					if (pl && l) {
						pl.children?.splice(pl.children.indexOf(l), 1);
					}
					return null;
				}
				case "maps.addToken": {
					const nt = params as {token: Token; path: string},
					      m = currentMap(),
					      l = getLayer(nt.path);
					if (l) {
						if (!nt.token.id || nt.token.id in m[tokenList]) {
							nt.token.id = ++m[lastTokenID];
						}
						l.tokens?.push(nt.token);
						m[tokenList][nt.token.id] = {layer: l, token: nt.token};
					}
					return nt.token.id;
				}
				case "maps.removeToken": {
					const m = currentMap(),
					      {layer, token} = m[tokenList][params as number];
					layer.tokens?.splice(layer.tokens.indexOf(token), 1);
					delete m[tokenList][params as number];
					return null;
				}
				case "maps.setToken":
					updateToken(params as SetToken);
					return null;
				case "maps.setTokenMulti":
					for (const tk of params as SetToken[]) {
						updateToken(tk);
					}
					return null;
				case "maps.setTokenLayerPos": {
					const lt = currentMap()[tokenList][(params as {id: number}).id],
					      to = getLayer((params as {to: string}).to);
					if (to?.tokens && lt.layer.tokens) {
						lt.layer.tokens?.splice(lt.layer.tokens.indexOf(lt.token), 1);
						to.tokens?.splice((params as {newPos: number}).newPos, 0, lt.token);
						lt.layer = to;
					}
					return null;
				}
				case "maps.shiftLayer": {
					const l = getLayer((params as {path: string}).path),
					      {dx, dy} = params as {dx: number; dy: number};
					if (l) {
						for (const tk of l.tokens ?? []) {
							tk.x += dx;
							tk.y += dy;
						}
						for (const wall of l.walls ?? []) {
							wall.x1 += dx;
							wall.y1 += dy;
							wall.x2 += dx;
							wall.y2 += dy;
						}
					}
					return null;
				}
				case "maps.addWall": {
					const aw = params as {path: string, wall: Wall},
					      m = currentMap(),
					      l = getLayer(aw.path);
					if (l) {
						if (aw.wall.id in m.walls! || !aw.wall.id || aw.wall.id > m[lastWallID]) {
							aw.wall.id = ++m[lastWallID];
						}
						l.walls?.push(aw.wall);
						m[wallList][aw.wall.id] = {layer: l, wall: aw.wall};
					}
					return aw.wall.id;
				}
				case "maps.removeWall": {
					const m = currentMap(),
					      {layer, wall} = m[wallList][params as number];
					layer.walls?.splice(layer.walls.indexOf(wall));
					delete m[wallList][wall.id];
					return null;
				}
				case "maps.modifyWall": {
					const w = params as Wall,
					      {wall} = currentMap()[wallList][w.id];
					Object.assign(wall, w);
					return null;
				}
				case "maps.moveWall": {
					const lw = currentMap()[wallList][(params as {id: number}).id],
					      to = getLayer((params as {path: string}).path);
					if (to?.walls && lw.layer.walls) {
						lw.layer.walls.splice(lw.layer.walls.indexOf(lw.wall), 1);
						to.walls.push(lw.wall);
						lw.layer = to;
					}
					return null;
				}
				case "music.list":
					return Object.values(exampleData.music);
				case "music.new": {
					const name = uniqueName(params as string, name => !Object.values(exampleData.music).some(m => m.name === name)),
					      id = ++exampleData[lastMusicPackID];
					exampleData.music[id] = {
						name,
						"tracks": [],
						"volume": 0,
						"playTime": 0
					};
					return {id, name};
				}
				case "music.rename": {
					const data = params as {id: number; name: string};
					return exampleData.music[data.id].name = uniqueName(data.name, name => {
						for (const mid in exampleData.music) {
							if (exampleData.music[mid].name === name) {
								return false;
							}
						}
						return true;
					});
				}
				case "music.remove":
					delete exampleData.music[params as number];
					return null;
				case "music.copy": {
					const name = uniqueName((params as {name: string}).name, name => !Object.values(exampleData.music).some(m => m.name === name)),
					      id = ++exampleData[lastMusicPackID],
					      mp = exampleData.music[(params as {id: number}).id];
					exampleData.music[id] = {
						name,
						"tracks": JSON.parse(JSON.stringify(mp.tracks)),
						"volume": mp.volume,
						"playTime": 0
					};
					return {id, name}
				}
				case "music.setVolume":
					exampleData.music[(params as {id: number}).id].volume = (params as {volume: number}).volume;
					return null;
				case "music.playPack":
					return exampleData.music[(params as {id: number}).id].playTime = (params as {playTime: number}).playTime || Math.floor(Date.now() / 1000);
				case "music.stopPack":
					exampleData.music[params as number].playTime = 0;
					return null;
				case "music.stopAllPacks":
					for (const mid in exampleData.music) {
						exampleData.music[mid].playTime = 0;
					}
					return null;
				case "music.addTracks": {
					const mp = exampleData.music[(params as {id: number}).id];
					for (const id of (params as {tracks: number[]}).tracks) {
						mp.tracks.push({id, "volume": 255, "repeat": 0});
					}
					return null;
				}
				case "music.removeTrack":
					exampleData.music[(params as {id: number}).id].tracks.splice((params as {track: number}).track, 1);
					return null;
				case "music.setTrackVolume":
					exampleData.music[(params as {id: number}).id].tracks[(params as {track: number}).track].volume = (params as {volume: number}).volume;
					return null;
				case "music.setTrackRepeat":
					exampleData.music[(params as {id: number}).id].tracks[(params as {track: number}).track].repeat = (params as {repeat: number}).repeat;
					return null;
				case "characters.create": {
					const data = params as {
						path: string;
						data: Record<string, KeystoreData>;
					      },
					      id = ++exampleData[lastCharacterID];
					exampleData.characterData[id] = data.data;
					return {id, "path": addItemTo(exampleData.characters.items, data.path, id)};
				}
				case "characters.modify": {
					const data = params as {
						id: number;
						setting: Record<string, KeystoreData>;
						removing: string[];
					      },
					      cd = exampleData.characterData[data.id];
					for (const [key, val] of Object.entries(data.setting)) {
						cd[key] = val;	
					}
					for (const key of data.removing) {
						delete cd[key];
					}
					return null;
				}
				case "characters.get": {
					const ms = exampleData.characterData[params as number];
					if (!ms) {
						return null;
					}
					if (exampleData.admin) {
						return ms;
					}
					const justUser: Record<string, KeystoreData> = {};
					for (const [key, value] of Object.entries(ms)) {
						justUser[key] = value;
					}
					return justUser;
				}
				case "plugins.list":
					return exampleData.plugins;
				case "plugins.enable":
				case "plugins.disable":
					break;
				case "plugins.set": {
					const data = params as {
						id: string;
						setting: Record<string, KeystoreData>;
						removing: string[];
					      },
					      plugin = exampleData.plugins[data.id];
					for (const [key, val] of Object.entries(data.setting)) {
						plugin.data[key] = val;	
					}
					for (const key of data.removing) {
						delete plugin.data[key];
					}
					return null;
				}
				case "imageAssets.list":
					return exampleData.images;
				case "imageAssets.createFolder":
					return folderCreate(exampleData.images, params as string);
				case "imageAssets.move":
					return itemMove(exampleData.images, (params as FromTo).from, (params as FromTo).to);
				case "imageAssets.moveFolder":
					return folderMove(exampleData.images, (params as FromTo).from, (params as FromTo).to);
				case "imageAssets.remove":
					return itemDelete(exampleData.images, params as string);
				case "imageAssets.removeFolder":
					return folderDelete(exampleData.images, params as string);
				case "imageAssets.copy":
					return copyItem(exampleData.images, (params as IDPath).id, (params as IDPath).path);
				case "audioAssets.list":
					return exampleData.audio;
				case "audioAssets.createFolder":
					return folderCreate(exampleData.audio, params as string);
				case "audioAssets.move":
					return itemMove(exampleData.audio, (params as FromTo).from, (params as FromTo).to);
				case "audioAssets.moveFolder":
					return folderMove(exampleData.audio, (params as FromTo).from, (params as FromTo).to);
				case "audioAssets.remove":
					return itemDelete(exampleData.audio, params as string);
				case "imageAssets.removeFolder":
					return folderDelete(exampleData.audio, params as string);
				case "imageAssets.copy":
					return copyItem(exampleData.audio, (params as IDPath).id, (params as IDPath).path);
				case "characters.list":
					return exampleData.characters;
				case "characters.createFolder":
					return folderCreate(exampleData.characters, params as string);
				case "characters.move":
					return itemMove(exampleData.characters, (params as FromTo).from, (params as FromTo).to);
				case "characters.moveFolder":
					return folderMove(exampleData.characters, (params as FromTo).from, (params as FromTo).to);
				case "characters.remove":
					return itemDelete(exampleData.characters, params as string);
				case "characters.removeFolder":
					return folderDelete(exampleData.characters, params as string);
				case "characters.copy": {
					const [p, name] = getFolderItem(exampleData.characters, (params as IDPath).path),
					      ms = exampleData.characterData[(params as IDPath).id],
					      newID = ++exampleData[lastCharacterID];
					if (!p || !ms) {
						return null;
					}
					exampleData.characterData[newID] = JSON.parse(JSON.stringify(ms));
					return {"id": newID, "path": (params as IDPath).path.slice(0, name.length) + addItemTo(p.items, name, newID)};
				}
				case "maps.list":
					return exampleData.maps;
				case "maps.createFolder":
					return folderCreate(exampleData.maps, params as string);
				case "maps.move":
					return itemMove(exampleData.maps, (params as FromTo).from, (params as FromTo).to);
				case "maps.moveFolder":
					return folderMove(exampleData.maps, (params as FromTo).from, (params as FromTo).to);
				case "maps.remove":
					return itemDelete(exampleData.maps, params as string);
				case "maps.removeFolder":
					return folderDelete(exampleData.maps, params as string);
				case "maps.copy": {
					const [p, name] = getFolderItem(exampleData.maps, (params as IDPath).path),
					      ms = exampleData.mapData[(params as IDPath).id],
					      newID = ++exampleData[lastMapID];
					if (!p || !ms) {
						return null;
					}
					exampleData.mapData[newID] = JSON.parse(JSON.stringify(ms));
					return {"id": newID, "path": (params as IDPath).path.slice(0, name.length) + addItemTo(p.items, name, newID)};
				}
				}
				return null;
			}
			#send(id: number, result: unknown) {
				setTimeout(() => this.dispatchEvent(new MessageEvent("message", {"data": JSON.stringify({id, result})})));
			}
			close() {
			}
		}
	},
	"XMLHttpRequest": {
		"value": class XMLHttpRequest extends EventTarget {
			#upload = {"addEventListener": (_name: string, _fn: Function) => {}};
			#url = "";
			#to: number = -1;
			response: any;
			responseType = "";
			readyState = 4;
			responseText = "Bad Upload";
			status = 200;
			get upload () {
				return this.#upload;
			}
			abort() {
				if (this.#to >= 0) {
					clearTimeout(this.#to);
					this.#to = -1;
				}
			}
			open(_method: string, url: string) {
				this.#url = url;
			}
			setRequestHeader(_header: string, _value: string) {}
			overrideMimeType(_mime: string) {}
			send(body?: XMLHttpRequestBodyInit | Document | null | undefined) {
				this.#to = setTimeout(() => {
					this.#to = -1;
					const url = new URL(this.#url, "file:///"),
					      type = trimLeft(trimRight(url.pathname, "/"), "/"),
					      path = Array.from(url.searchParams).find(([name]) => name === "path")?.[1] ?? "";
					if ((type === "images" || type === "audio")  && body instanceof FormData) {
						const ps: Promise<void>[] = [],
						      response: {id: number; name: string}[]  = this.response = [];
						for (const file of body.getAll("asset")) {
							if (file instanceof File) {
								let fn: Function;
								const fr = new FileReader();
								ps.push(new Promise(sFn => fn = sFn));
								fr.addEventListener("load", () => {
									const id = exampleData.urls[type].push(fr.result as string) - 1;
									response.push({id, name: addItemTo(getFolder(exampleData[type], path)!.items, file.name, id)});
									fn();
								});
								fr.readAsDataURL(file);
							}
						}
						Promise.all(ps).then(() => this.dispatchEvent(new Event("readystatechange")));
					} else {
						this.status = 400;
						this.dispatchEvent(new Event("readystatechange"));
					}
				});
			}
		}
	},
	"localStorage": {
		"value": new (class Storage {
			getItem(name: string) {
				return exampleData.localStorage[name] ?? null;
			}
			setItem(name: string, value: string) {
				exampleData.localStorage[name] = value;
			}
			removeItem(name: string) {
				delete exampleData.localStorage[name];
			}
		})()
	},
	"saveData": {
		"value": () => {
			for (let i = 0; i < exampleData.urls.images.length; i++) {
				const url = exampleData.urls.images[i];
				if (url.startsWith("data:image/svg+xml;base64,")) {
					exampleData.urls.images[i] = "data:image/svg+xml," + atob(url.slice(26)).replaceAll("#", "%23").replaceAll(/\n[ 	]*/g, "");
				}
			}
			console.log(exampleData);
		}
	}
});
