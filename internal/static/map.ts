import type {Int, LayerFolder, LayerTokens, MapData, MapDetails, Token, TokenDrawing, TokenImage, TokenSet, Uint, Wall} from './types.js';
import type {Children} from './lib/dom.js';
import type {Colour} from './colours.js';
import type {LightSource} from './map_lighting.js';
import type {SVGDrawing, SVGShape} from './map_tokens.js';
import {amendNode, clearNode} from './lib/dom.js';
import {mouseDragEvent} from './lib/events.js';
import {div, progress} from './lib/html.js';
import {WaitGroup} from './lib/inter.js';
import {NodeArray, node} from './lib/nodes.js';
import {animate, circle, g, rect, svg} from './lib/svg.js';
import lang from './language.js';
import {makeLight} from './map_lighting.js';
import {SVGToken, definitions, masks, tokens} from './map_tokens.js';
import {inited, isAdmin, rpc} from './rpc.js';
import {drawingClass, shapeClass, tokenClass} from './plugins.js';
import {scrollAmount, zoomSlider} from './settings.js';
import {characterData, checkInt, mapLoadedReceive, mapLoadedSend, queue, SQRT3, walls} from './shared.js';
import {defaultTool, toolMapMouseDown, toolMapMouseOver, toolMapWheel} from './tools.js';
import {shell} from './windows.js';

export type SVGLayer = LayerTokens & {
	[node]: SVGElement;
	path: string;
	tokens: NodeArray<SVGToken | SVGShape>;
};

export type SVGFolder = LayerFolder & {
	[node]: SVGElement;
	path: string;
	children: NodeArray<SVGFolder | SVGLayer>;
};

export let root = svg(),
layerList: SVGFolder,
mapData: MapData;

const idNames: Record<string, Int> = {
	"": 0,
	"Grid": -1,
	"Light": -2,
      },
      processLayers = (wg: WaitGroup | undefined, layer: LayerTokens | LayerFolder, path = ""): SVGFolder | SVGLayer => {
	path += "/" + layer.name
	const n = g(layer.hidden ? {"class": "hiddenLayer"} : undefined);
	if (isLayerFolder(layer)) {
		const children = new NodeArray<SVGFolder | SVGLayer>(n);
		for (const c of layer.children) {
			children.push(processLayers(wg, c, path));
		}
		return Object.assign(layer, {[node]: n, children, path});
	}
	const tokens = new NodeArray<SVGToken | SVGShape>(n);
	if (layer.name !== "Grid" && layer.name !== "Light") {
		for (const t of layer.tokens) {
			tokens.push(isTokenImage(t) ? new tokenClass(t, wg) : isTokenDrawing(t) ? new drawingClass(t) : new shapeClass(t));
		}
	} else {
		amendNode(n, {"id": `layer${layer.name}`});
		layer.walls = [];
	}
	return Object.assign(layer, {id: idNames[layer.name] ?? 1, [node]: n, path, tokens});
      },
      isLayerFolder = (ld: LayerTokens | LayerFolder): ld is LayerFolder => (ld as LayerFolder).children !== undefined,
      walkFolders = (folder: SVGFolder, fn: (e: SVGLayer | SVGFolder) => boolean): boolean => (folder.children as NodeArray<SVGFolder | SVGLayer>).some(e => fn(e) || (isSVGFolder(e) && walkFolders(e, fn)));

export const splitAfterLastSlash = (path: string) => {
	const pos = path.lastIndexOf("/")
	return [path.slice(0, pos), path.slice(pos+1)];
},
walkLayers = (fn: (e: SVGLayer, hidden: boolean) => void, folder: SVGFolder = layerList, hidden = false) => {
	for (const e of (folder.children as (SVGFolder | SVGLayer)[])) {
		if (isSVGLayer(e)) {
			fn(e, hidden || e.hidden);
		} else {
			walkLayers(fn, e, hidden || e.hidden);
		}
	}
},
isSVGFolder = (c: SVGFolder | SVGLayer): c is SVGFolder => (c as SVGFolder).children !== undefined,
isSVGLayer = (c: SVGFolder | SVGLayer): c is SVGLayer => (c as SVGLayer).tokens !== undefined,
getLayer = (path: string, layer: SVGFolder | SVGLayer = layerList) => path.split("/").filter(b => b).every(p => {
	if (isSVGFolder(layer)) {
		const a = (layer.children as NodeArray<SVGFolder | SVGLayer>).filter(c => c.name === p).pop();
		if (a) {
			layer = a;
			return true;
		}
	}
	return false;
}) ? layer : null,
getParentLayer = (path: string): [SVGFolder | null, SVGFolder | SVGLayer | null] => {
	const [parentStr, name] = splitAfterLastSlash(path),
	      parent = getLayer(parentStr);
	return parent && isSVGFolder(parent) ? [parent, getLayer(name, parent)] : [null, null];
},
setLayerVisibility = (path: string, visibility: boolean) => {
	const layer = getLayer(path);
	layer?.[node].classList.toggle("hiddenLayer", layer.hidden = !visibility);
	updateLight();
},
addLayerFolder = (path: string) => (layerList.children.push(processLayers(undefined, {"id": 0, "name": splitAfterLastSlash(path)[1], "hidden": false, "mask": 0, "children": [], "folders": {}, "items": {}})), path),
renameLayer = (path: string, name: string) => {
	const l = getLayer(path)!;
	l.path = `${splitAfterLastSlash(path)[0]}/${name}`;
	return l.name = name;
},
removeLayer = (path: string) => {
	const [fromParent, layer] = getParentLayer(path);
	(fromParent!.children as NodeArray<any>).filterRemove(e => Object.is(e, layer));
	updateLight();
},
addLayer = (name: string) => (layerList.children.push(processLayers(undefined, {name, "id": 0, "mask": 0, "hidden": false, "tokens": [], "walls": []})), name),
moveLayer = (from: string, to: string, pos: Uint) => {
	const [parentStr, nameStr] = splitAfterLastSlash(from),
	      fromParent = getLayer(parentStr)!,
	      toParent = getLayer(to) as SVGFolder;
	if (isSVGFolder(fromParent)) {
		const l = (fromParent.children as NodeArray<any>).filterRemove(e => e.name === nameStr).pop();
		l.path = to + "/" + l.name;
		toParent.children.splice(pos, 0, l);
	}
	updateLight();
},
setMapDetails = (details: MapDetails) => {
	Object.assign(mapData, details);
	amendNode(root, {"width": details["width"], "height": details["height"]});
	definitions.setGrid(details);
	updateLight();
},
setLightColour = (c: Colour) => {
	amendNode((getLayer("/Light") as SVGLayer)[node].firstChild!, {"fill": mapData.lightColour = c});
	updateLight();
},
isTokenImage = (t: Token): t is TokenImage => (t as TokenImage).src !== undefined,
isTokenDrawing = (t: Token): t is TokenDrawing => (t as TokenDrawing).points !== undefined,
normaliseWall = (w: Wall) => {
	if (w.x1 > w.x2 || w.x1 === w.x2 && w.y1 > w.y2) {
		[w.x1, w.x2, w.y1, w.y2] = [w.x2, w.x1, w.y2, w.y1];
	}
	return w;
},
updateLight = () => {
	const ll = (getLayer("/Light") as SVGLayer)[node],
	      walls: Wall[] = [],
	      lights: LightSource[] = [],
	      masks: Children[] = [ll.firstChild!];
	walkLayers((l: SVGLayer, hidden: boolean) => {
		if (!hidden) {
			walls.push(...l.walls);
			for (const {lightColour, lightIntensity, x, y, width, height} of l.tokens) {
				if (lightIntensity && lightColour.a) {
					lights.push([lightColour, lightIntensity, x + width / 2, y + height / 2]);
				}
			}
		}
	});
	for (const light of lights) {
		masks.push(makeLight(light, walls));
	}
	clearNode(ll, masks);
},
showSignal = (() => {
	const signalAnim1 = animate({"attributeName": "r", "values": "4;46", "dur": "1s"}),
	      signalAnim2 = animate({"attributeName": "r", "values": "4;46", "dur": "1s"}),
	      signal = g([
		circle({"cx": 50, "cy": 50, "stroke": "#f00", "stroke-width": 8, "fill": "none"}, signalAnim1),
		circle({"cx": 50, "cy": 50, "stroke": "#00f", "stroke-width": 4, "fill": "none"}, signalAnim2)
	      ]);
	return (pos: [Uint, Uint]) => {
		amendNode(root, amendNode(signal, {"transform": `translate(${pos[0] - 50}, ${pos[1] - 50})`}));
		signalAnim1.beginElement();
		signalAnim2.beginElement();
	};
})(),
panZoom = {"x": 0, "y": 0, "zoom": 1},
screen2Grid = (() => {
	const points: readonly [number, number][] = [
		[0, 1/6],
		[0, 2/6],
		[0, 3/6],
		[0, 5/6],
		[1/4, 1/12],
		[1/4, 7/12],
		[1/2, 0],
		[1/2, 1/3],
		[1/2, 2/3],
		[1/2, 5/6],
		[1/2, 1],
		[3/4, 1/12],
		[3/4, 7/12],
		[1, 1/6],
		[1, 2/6],
		[1, 3/6],
		[1, 5/6]
	      ];
	return (mx: Uint, my: Uint, snap = false): [Int, Int] => {
		const {width, height, gridType, gridSize} = mapData,
		      {x, y, zoom} = panZoom,
		      sx = (mx + ((zoom - 1) * width / 2) - x) / zoom,
		      sy = (my + ((zoom - 1) * height / 2) - y) / zoom;
		if (snap) {
			switch (gridType) {
			case 1:
			case 2: {
				const o = 2 * Math.round(1.5 * gridSize / SQRT3),
				      w = gridType === 1 ? gridSize : o,
				      h = gridType === 2 ? gridSize : o,
				      px = sx / w,
				      py = sy / h,
				      dx = px % 1,
				      dy = py % 1,
				      first = gridType - 1,
				      second = 1 - first;
				let nearestPoint: [number, number] = [0, 0],
				    nearest = Infinity;
				for (const point of points) {
					const d = Math.hypot(point[first] - dx, point[second] - dy);
					if (d < nearest) {
						nearest = d;
						nearestPoint = point;
					}
				}
				return [Math.round((Math.floor(px) + nearestPoint[first]) * w), Math.round((Math.floor(py) + nearestPoint[second]) * h)];
			}
			default:
				const size = gridSize >> 1;
				return [size * Math.round(sx / size), size * Math.round(sy / size)];
			}
		}
		return [Math.round(sx), Math.round(sy)];
	};
})(),
zoom = (() => {
	const zoomMove = (e: MouseEvent) => {
		const v = Math.max(10, Math.min(110, e.clientY));
		amendNode(zoomerControl, {"cy": v});
		zoom(Math.pow(1.4, (60 - v) / 10) / panZoom.zoom, window.innerWidth >> 1, window.innerHeight >> 1, false);
	      },
	      [setupZoomDrag] = mouseDragEvent(0, zoomMove, () => amendNode(document.body, {"class": ["!zooming"]})),
	      zoomWheel = (e: WheelEvent) => zoom(Math.sign(e.deltaY) * 0.95, window.innerWidth >> 1, window.innerHeight >> 1),
	      zoomerControl = circle({"cx": 10, "cy": 60, "r": 10, "stroke": "#000", "onmousedown": (e: MouseEvent) => {
		if (e.button === 0) {
			setupZoomDrag();
			amendNode(document.body, {"class": ["zooming"]});
		}
	      }, "onwheel": zoomWheel}),
	      l4 = Math.log(1.4)
	inited.then(() => amendNode(shell, svg({"id": "zoomSlider", "viewBox": "0 0 20 120"}, [
		rect({"width": 20, "height": 120, "rx": 10, "stroke": "#000", "onclick": (e: MouseEvent) => {
			if (e.button === 0) {
				zoomMove(e);
			}
		}, "onwheel": zoomWheel}),
		zoomerControl
	])));
	zoomSlider.wait(enabled => amendNode(document.body, {"class": {"hideZoomSlider": enabled}}));
	mapLoadedReceive(() => amendNode(zoomerControl, {"cy": "60"}));
	return (delta: number, x: number, y: number, moveControl = true) => {
		const width = checkInt(parseInt(root.getAttribute("width") || "0"), 0) / 2,
		      height = checkInt(parseInt(root.getAttribute("height") || "0"), 0) / 2,
		      oldZoom = panZoom.zoom;
		if (delta < 0) {
			panZoom.zoom /= -delta;
		} else if (delta > 0) {
			panZoom.zoom *= delta;
		}
		panZoom.x += x - (panZoom.zoom * ((x + (oldZoom - 1) * width) - panZoom.x) / oldZoom + panZoom.x - (panZoom.zoom - 1) * width);
		panZoom.y += y - (panZoom.zoom * ((y + (oldZoom - 1) * height) - panZoom.y) / oldZoom + panZoom.y - (panZoom.zoom - 1) * height);
		amendNode(root, {"transform": `scale(${panZoom.zoom})` ,"style": {"left": panZoom.x + "px", "top": panZoom.y + "px", "--zoom": panZoom.zoom}});
		if (moveControl) {
			amendNode(zoomerControl, {"cy": Math.max(10, 120 - Math.min(110, 60 + 10 * Math.log(panZoom.zoom) / l4))});
		}
	};
})(),
centreOnGrid = (x: Uint, y: Uint) => {
	const {width, height} = mapData,
	      iw = window.innerWidth,
	      ih = window.innerHeight,
	      {zoom} = panZoom;
	panZoom.x = Math.min(Math.max((iw - width) / 2 - (x - width / 2) * zoom, iw - width * (zoom + 1) / 2), width * (zoom - 1) / 2);
	panZoom.y = Math.min(Math.max((ih - height) / 2 - (y - height / 2) * zoom, ih - height * (zoom + 1) / 2), height * (zoom - 1) / 2);
	amendNode(root, {"style": {"left": panZoom.x + "px", "top": panZoom.y + "px"}})
},
mapView = (mD: MapData, loadChars = false) => {
	mapData = mD;
	tokens.clear();
	walls.clear();
	masks.set(mapData.baseOpaque, mapData.masks);
	definitions.clear();
	const wg = new WaitGroup(),
	      {width, height, lightColour, startX, startY} = mapData,
	      items = div(),
	      percent = progress(),
	      loader = div({"id": "mapLoading"}, div([`${lang["LOADING_MAP"]}: `, percent, items])),
	      n = g(),
	      children = new NodeArray<SVGFolder | SVGLayer>(n);
	for (const c of mapData.children) {
		children.push(processLayers(wg, c));
	}
	layerList = {
		id: 0,
		name: "",
		hidden: false,
		[node]: n,
		children,
		folders: {},
		items: {},
		path: "/"
	};
	root = svg({"id": "map", "style": {"position": "absolute"}, width, height}, [definitions[node], n, rect({"width": "100%", "height": "100%", "fill": "#000", "style": isAdmin ? {"fill-opacity": "var(--maskOpacity, 1)"} : undefined, "mask": "url(#mapMask)"})]);
	wg.onComplete(() => setTimeout(() => loader.remove(), isAdmin ? 0 : 1000));
	definitions.setGrid(mapData);
	amendNode((getLayer("/Grid") as SVGLayer)[node], rect({"width": "100%", "height": "100%", "fill": "url(#gridPattern)"}));
	amendNode((getLayer("/Light") as SVGLayer)[node], rect({"width": "100%", "height": "100%", "fill": lightColour}));
	walkFolders(layerList, l => {
		if (!isLayerFolder(l)) {
			for (const t of l.tokens) {
				tokens.set(t.id, {
					layer: l,
					token: t
				});
				if (isTokenImage(t) && t.tokenData) {
					const cID = t.tokenData["store-character-id"];
					if (loadChars && cID && typeof cID.data === "number" && !characterData.has(cID.data)) {
						const c = cID.data;
						characterData.set(c, {});
						wg.add();
						queue(() => rpc.characterGet(c).then(d => characterData.set(c, d)).finally(() => wg.done()));
					}
				}
			}
			for (const w of l.walls) {
				walls.set(w.id, {
					layer: l,
					wall: w
				});
			}
		}
		return false;
	});
	wg.onUpdate(({waits, done, errors}) => {
		const d = done + errors;
		clearNode(items, `${d} / ${waits}`);
		amendNode(percent, {"max": waits, "value": d});
	});
	wg.add();
	wg.done();
	updateLight();
	panZoom.zoom = 1;
	centreOnGrid(startX, startY);
	return div({"id": "mapBase", "onmousedown": (e: MouseEvent) => toolMapMouseDown.call(root, e), "onwheel": (e: WheelEvent) => toolMapWheel.call(root, e), "onmouseover": (e: MouseEvent) => toolMapMouseOver.call(root, e)}, [root, loader]);
};

defaultTool.mapMouseWheel = (e: WheelEvent) => {
	if (e.ctrlKey) {
		zoom(Math.sign(e.deltaY) * 0.95, e.clientX, e.clientY);
	} else {
		const amount = scrollAmount.value || 100;
		amendNode(root, {"style": {"left": (panZoom.x += Math.sign(e.shiftKey ? e.deltaY : e.deltaX) * -amount) + "px", "top": (panZoom.y += (e.shiftKey ? 0 : Math.sign(e.deltaY)) * -amount) + "px"}});
	}
	return false;
};

export default (base: HTMLElement) => {
	rpc.waitCurrentUserMapData().then(mapData => {
		const oldBase = base;
		oldBase.replaceWith(base = mapView(mapData, true));
		mapLoadedSend(false);
	});
	let sliding = -1,
	    mX = 0,
	    mY = 0;
	const startMapMove = (e: MouseEvent) => {
		amendNode(root, {"style": {"left": `${panZoom.x += e.clientX - mX}px`, "top": `${panZoom.y += e.clientY - mY}px`}});
		mX = e.clientX;
		mY = e.clientY;
	      },
	      stopMapMove = () => amendNode(document.body, {"class": ["!dragging"]}),
	      [startMapMove0] = mouseDragEvent(0, startMapMove, stopMapMove),
	      [startMapMove1] = mouseDragEvent(1, startMapMove, stopMapMove),
	      initMapMove = (e: MouseEvent, initFn: () => void) => {
		mX = e.clientX;
		mY = e.clientY;
		amendNode(document.body, {"class": ["dragging"]});
		initFn();
		return false;
	      };
	defaultTool.mapMouse0 = e => initMapMove(e, startMapMove0);
	defaultTool.mapMouse1 = e => initMapMove(e, startMapMove1);
	defaultTool.mapMouse2 = e => {
		const pos = screen2Grid(e.clientX, e.clientY);
		showSignal(pos);
		rpc.signalPosition(pos);
		return false;
	};
	rpc.waitSignalMovePosition().then(pos => {
		if (sliding === -1) {
			amendNode(document.body, {"class": ["sliding"]});
		} else {
			clearTimeout(sliding);
		}
		sliding = setTimeout(() => {
			amendNode(document.body, {"class": ["!sliding"]});
			sliding = -1;
		}, 1000);
		centreOnGrid(pos[0], pos[1]);
		showSignal(pos);
	});
	rpc.waitSignalPosition().then(showSignal);
	rpc.waitMapChange().then(setMapDetails),
	rpc.waitMapLightChange().then(setLightColour),
	rpc.waitLayerShow().then(path => setLayerVisibility(path, true)),
	rpc.waitLayerHide().then(path => setLayerVisibility(path, false)),
	rpc.waitLayerAdd().then(addLayer),
	rpc.waitLayerFolderAdd().then(addLayerFolder),
	rpc.waitLayerMove().then(({from, to, position}) => moveLayer(from, to, position)),
	rpc.waitLayerRename().then(({path, name}) => renameLayer(path, name)),
	rpc.waitLayerRemove().then(removeLayer),
	rpc.waitTokenAdd().then(tk => {
		const layer = getLayer(tk.path);
		if (layer && isSVGLayer(layer)) {
			delete (tk as Record<string, any>)["path"];
			let token: SVGToken | SVGShape | SVGDrawing;
			if (isTokenImage(tk.token)) {
				token = new tokenClass(tk.token);
				const cID = tk.token.tokenData["store-character-id"];
				if (cID && typeof cID.data === "number") {
					rpc.characterGet(cID.data).then(d => characterData.set(cID.data, d));
				}
			} else if (isTokenDrawing(tk.token)) {
				token = new drawingClass(tk.token);
			} else {
				token = new shapeClass(tk.token);
			}
			layer.tokens.push(token);
			tokens.set(token.id, {layer, token});
		}
	}),
	rpc.waitTokenMoveLayerPos().then(({id, to, newPos}) => {
		const tk = tokens.get(id) ?? {"layer": null, "token": null},
		      {layer, token} = tk,
		      newParent = getLayer(to);
		if (layer && token && newParent && isSVGLayer(newParent)) {
			if (newPos > newParent.tokens.length) {
				newPos = newParent.tokens.length;
			}
			newParent.tokens.splice(newPos, 0, layer.tokens.splice(layer.tokens.findIndex(t => t === token), 1)[0]);
			tk.layer = newParent;
			if (token.lightColour.a > 0 && token.lightIntensity > 0) {
				updateLight();
			}
		}
	}),
	rpc.waitTokenSet().then(ts => {
		const {token} = tokens.get(ts.id) ?? {"token": null};
		if (token) {
			for (const k in ts) {
				switch (k) {
				case "id":
					break;
				case "src":
					if (token instanceof SVGToken && ts["src"]) {
						token.updateSource(ts["src"]);
					}
					break;
				case "tokenData":
					const tokenData = ts[k];
					for (const k in tokenData) {
						token["tokenData"][k] = tokenData[k];
					}
					break;
				case "removeTokenData":
					const removeTokenData = ts[k]!;
					for (const k of removeTokenData) {
						delete token["tokenData"][k];
					}
					break;
				default:
					(token as Record<string, any>)[k] = ts[k as keyof TokenSet]
				}
			}
			token.updateNode()
		}
	}),
	rpc.waitTokenRemove().then(tk => {
		const {layer, token} = tokens.get(tk)!;
		layer.tokens.splice(layer.tokens.findIndex(t => t === token), 1)[0];
		if (token instanceof SVGToken) {
			token.cleanup();
			if (token.lightColour.a > 0 && token.lightIntensity > 0) {
				updateLight();
			}
		}
	}),
	rpc.waitLayerShift().then(({path, dx, dy}) => {
		const layer = getLayer(path);
		if (layer && isSVGLayer(layer)) {
			for (const t of layer.tokens) {
				t.x += dx;
				t.y += dy;
				t.updateNode();
			};
			for (const w of layer.walls) {
				w.x1 += dx;
				w.y1 += dy;
				w.x2 += dx;
				w.y2 += dy;
			};
			updateLight();
		}
	}),
	rpc.waitWallAdded().then(({path, wall}) => {
		const layer = getLayer(path);
		if (layer && isSVGLayer(layer)) {
			layer.walls.push(normaliseWall(wall));
			updateLight();
		}
	}),
	rpc.waitWallRemoved().then(wp => {
		const {layer, wall} = walls.get(wp)!;
		layer.walls.splice(layer.walls.findIndex(w => w === wall), 1);
		updateLight();
	}),
	rpc.waitWallModified().then(w => {
		const wall = walls.get(w.id);
		if (wall) {
			Object.assign(wall.wall, w);
		}
	});
	rpc.waitTokenLightChange().then(({id, lightColour, lightIntensity}) => {
		const {token} = tokens.get(id)!;
		if (token instanceof SVGToken) {
			token.lightColour = lightColour;
			token.lightIntensity = lightIntensity;
			updateLight();
		}
	}),
	rpc.waitMapDataSet().then(kd => {
		if (kd.key) {
			mapData.data[kd.key] = kd.data;
		}
	}),
	rpc.waitMapDataRemove().then(key => delete mapData.data[key])
	rpc.waitMaskAdd().then(masks.add);
	rpc.waitMaskRemove().then(masks.remove);
	rpc.waitMaskSet().then(({baseOpaque, masks: ms}) => masks.set(baseOpaque, ms));
	rpc.waitGridDistanceChange().then(v => mapData.gridDistance = v);
	rpc.waitGridDiagonalChange().then(v => mapData.gridDiagonal = v);
};
