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
	tokens: Token[];
	walls: Wall[];
	children: Layer[];
}

type MapData = Layer & {
	width: number;
	height: number;
	startX: number;
	startY: number;
	gridType: number;
	gridSize: number;
	gridColour: Colour;
	gridDistance: number;
	gridDiagonal: boolean;
	lightColour: Colour;
	baseOpaque: boolean;
	masks: number[][];
	data: Record<string, unknown>;
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
	id: number;
	name: string;
	tracks: MusicTrack[];
	volume: number;
	playTime: number;
}

declare const exampleData: {
	admin: boolean;
	currentMap: number;
	currentUserMap: number;
	urls: {
		images: string[];
		audio: string[];
	};
	mapData: MapData[];
	characterData: Record<string, KeystoreData>[];
	images: Folder;
	audio: Folder;
	characters: Folder;
	maps: Folder;
	music: MusicPack[];
	plugins: Record<string, {
		enabled: boolean;
		data: Record<string, KeystoreData>;
	}>;
	localStorage: Record<string, string>;
};

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
				case "maps.new":
				case "maps.setMapDetails":
				case "maps.setMapStart":
				case "maps.setGridDistance":
				case "maps.setGridDiagonal":
				case "maps.setLightColour":
				case "maps.setData":
				case "maps.removeData":
				case "maps.addLayer":
				case "maps.addLayerFolder":
				case "maps.renameLayer":
				case "maps.moveLayer":
				case "maps.showLayer":
				case "maps.hideLayer":
				case "maps.lockLayer":
				case "maps.unlockLayer":
				case "maps.addToMask":
				case "maps.removeFromMask":
				case "maps.setMask":
				case "maps.removeLayer":
				case "maps.addToken":
				case "maps.removeToken":
				case "maps.setToken":
				case "maps.setTokenMulti":
				case "maps.setTokenLayerPos":
				case "maps.shiftLayer":
				case "maps.addWall":
				case "maps.removeWall":
				case "maps.modifyWall":
				case "maps.moveWall":
				case "music.list":
					return exampleData.music;
				case "music.new":
				case "music.rename":
				case "music.remove":
				case "music.copy":
				case "music.setVolume":
				case "music.playPack":
				case "music.stopPack":
				case "music.stopAllPacks":
				case "music.addTracks":
				case "music.removeTrack":
				case "music.setTrackVolume":
				case "music.setTrackRepeat":
				case "characters.create":
				case "characters.modify":
				case "characters.get":
					break;
				case "plugins.list":
					return exampleData.plugins;
				case "plugins.enable":
				case "plugins.disable":
				case "plugins.set":
					break;
				case "imageAssets.list":
					return exampleData.images;
				case "imageAssets.createFolder":
				case "imageAssets.move":
				case "imageAssets.moveFolder":
				case "imageAssets.remove":
				case "imageAssets.removeFolder":
				case "imageAssets.copy":
					break;
				case "audioAssets.list":
					return exampleData.audio;
				case "audioAssets.createFolder":
				case "audioAssets.move":
				case "audioAssets.moveFolder":
				case "audioAssets.remove":
				case "imageAssets.removeFolder":
				case "imageAssets.copy":
					break;
				case "characters.list":
					return exampleData.characters;
				case "characters.createFolder":
				case "characters.move":
				case "characters.moveFolder":
				case "characters.remove":
				case "characters.removeFolder":
				case "characters.copy":
					break;
				case "maps.list":
					return exampleData.maps;
				case "maps.createFolder":
				case "maps.move":
				case "maps.moveFolder":
				case "maps.remove":
				case "maps.removeFolder":
				case "maps.copy":
					break;
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
		"value": () => console.log(exampleData)
	}
});
