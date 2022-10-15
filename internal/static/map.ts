import type {Int, LayerFolder, LayerTokens, MapData, MapDetails, Token, TokenDrawing, TokenImage, TokenSet, Uint, Wall} from './types.js';
import type {LightWall} from './map_lighting.js';
import type {SVGDrawing, SVGShape} from './map_tokens.js';
import {add, id, ids} from './lib/css.js';
import {amendNode, clearNode} from './lib/dom.js';
import {keyEvent, mouseDragEvent} from './lib/events.js';
import Fraction from './lib/fraction.js';
import {div, progress} from './lib/html.js';
import {WaitGroup} from './lib/inter.js';
import {NodeArray, node} from './lib/nodes.js';
import {animate, circle, g, rect, svg, use} from './lib/svg.js';
import {Colour, noColour} from './colours.js';
import {registerKey} from './keys.js';
import lang from './language.js';
import {intersection, makeLight} from './map_lighting.js';
import {Lighting, SQRT3, SVGToken, definitions, gridPattern, lighting, mapMask, masks, tokens} from './map_tokens.js';
import {addLights, addWalls, drawingClass, handleWalls, shapeClass, tokenClass} from './plugins.js';
import {combined, inited, isAdmin, isUser, rpc} from './rpc.js';
import {enableAnimation, invertID, scrollAmount, zoomSlider} from './settings.js';
import {characterData, checkInt, cloneObject, mapLoadedReceive, mapLoadedSend, queue, walls} from './shared.js';
import {defaultTool, toolMapMouseDown, toolMapMouseOver, toolMapWheel} from './tools.js';
import {desktop} from './windows.js';

export type SVGLayer = LayerTokens & {
	[node]: SVGElement;
	l: SVGElement;
	path: string;
	tokens: NodeArray<SVGToken | SVGShape | SVGDrawing>;
}

export type SVGFolder = LayerFolder & {
	[node]: SVGElement;
	l: SVGElement;
	path: string;
	children: NodeArray<SVGFolder | SVGLayer>;
}

export let root = svg(),
layerList: SVGFolder,
mapData: MapData,
wallList: LightWall[] = [];

const idNames: Record<string, Int> = {
	"": 0,
	"Grid": -1,
	"Light": -2
      },
      processLayers = (wg: WaitGroup | undefined, layer: LayerTokens | LayerFolder, path = ""): SVGFolder | SVGLayer => {
	path += "/" + layer.name;
	const l = g(isAdmin && layer.hidden ? {"class": hiddenLayer} : undefined);
	if (isLayerFolder(layer)) {
		const children = new NodeArray<SVGFolder | SVGLayer>(l);
		for (const c of layer.children) {
			children.push(processLayers(wg, c, path));
		}
		return Object.assign(layer, {[node]: isUser && layer.hidden ? g() : l, l, children, path});
	}
	const tokens = new NodeArray<SVGToken | SVGShape | SVGDrawing>(l);
	if (layer.name !== "Grid" && layer.name !== "Light") {
		for (const t of layer.tokens) {
			tokens.push(isTokenImage(t) ? new tokenClass(t, wg) : isTokenDrawing(t) ? new drawingClass(t) : new shapeClass(t));
		}
	} else {
		amendNode(l, {"id": layer.name === "Grid" ? layerGrid : layerLight});
		layer.walls = [];
	}
	return Object.assign(layer, {id: idNames[layer.name] ?? 1, [node]: isUser && layer.hidden ? g() : l, l, path, tokens});
      },
      isLayerFolder = (ld: LayerTokens | LayerFolder): ld is LayerFolder => (ld as LayerFolder).children !== undefined,
      walkFolders = (folder: SVGFolder, fn: (e: SVGLayer | SVGFolder) => boolean): boolean => (folder.children as NodeArray<SVGFolder | SVGLayer>).some(e => fn(e) || (isSVGFolder(e) && walkFolders(e, fn))),
      lightList: Lighting[] = [],
      [mapBase, mapLoading] = ids(3);

export const [layerLight, layerGrid, hiddenLayer, mapID, hideZoomSlider, zoomSliderID, zooming] = ids(7),
splitAfterLastSlash = (path: string) => {
	const pos = path.lastIndexOf("/");
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
	if (isUser) {
		if (layer) {
			if (visibility) {
				if (layer[node] !== layer.l) {
					layer[node].replaceWith(layer[node] = layer.l!);
				}
			} else {
				if (layer[node] === layer.l) {
					layer.l.replaceWith(layer[node] = g())
				}
			}
		}
	} else {
		layer?.[node].classList.toggle(hiddenLayer, layer.hidden = !visibility);
	}
	updateLight();
},
addLayerFolder = (path: string) => (layerList.children.push(processLayers(undefined, {"id": 0, "name": splitAfterLastSlash(path)[1], "hidden": false, "locked": false, "children": [], "folders": {}, "items": {}})), path),
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
addLayer = (name: string) => (layerList.children.push(processLayers(undefined, {name, "id": 0, "hidden": false, "locked": false, "tokens": [], "walls": []})), name),
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
setLightColour = (c: Colour) => definitions.setLight(mapData.lightColour = c),
isTokenImage = (t: Token): t is TokenImage => (t as TokenImage).src !== undefined,
isTokenDrawing = (t: Token): t is TokenDrawing => (t as TokenDrawing).points !== undefined,
normaliseWall = (w: Wall) => {
	if (w.x1 > w.x2 || w.x1 === w.x2 && w.y1 > w.y2) {
		[w.x1, w.x2, w.y1, w.y2] = [w.x2, w.x1, w.y2, w.y1];
	}
	return w;
},
updateLight = () => {
	const {gridSize, gridDistance, width, height} = mapData,
	      fWidth = new Fraction(BigInt(width)),
	      fHeight = new Fraction(BigInt(height)),
	      walls: LightWall[] = [
		{
			"id": -1,
			"x1": Fraction.zero,
			"y1": Fraction.zero,
			"x2": fWidth,
			"y2": Fraction.zero,
			"colour": noColour,
			"scattering": 0
		},
		{
			"id": -2,
			"x1": fWidth,
			"y1": Fraction.zero,
			"x2": fWidth,
			"y2": fHeight,
			"colour": noColour,
			"scattering": 0
		},
		{
			"id": -3,
			"x1": Fraction.zero,
			"y1": fHeight,
			"x2": fWidth,
			"y2": fHeight,
			"colour": noColour,
			"scattering": 0
		},
		{
			"id": -4,
			"x1": Fraction.zero,
			"y1": Fraction.zero,
			"x2": Fraction.zero,
			"y2": fHeight,
			"colour": noColour,
			"scattering": 0
		}
	      ],
	      lights: Lighting[] = [],
	      processWalls = (ws: Wall[]) => {
		for (const {id, x1: nx1, y1: ny1, x2: nx2, y2: ny2, colour, scattering} of ws) {
			const l = walls.length,
			      x1 = new Fraction(BigInt(nx1)),
			      y1 = new Fraction(BigInt(ny1)),
			      x2 = new Fraction(BigInt(nx2)),
			      y2 = new Fraction(BigInt(ny2)),
			      points: [Fraction, Fraction][] = [[x1, y1], [x2, y2]];
			for (let i = 0; i < l; i++) {
				const {id: wid, x1: x3, y1: y3, x2: x4, y2: y4, colour: wc, scattering: ws} = walls[i],
				      [ix, iy] = intersection(x1, y1, x2, y2, x3, y3, x4, y4);
				if (ix.cmp(Fraction.min(x1, x2)) === 1 && ix.cmp(Fraction.min(x3, x4)) === 1 && ix.cmp(Fraction.max(x1, x2)) === -1 && ix.cmp(Fraction.max(x3, x4)) === -1 && iy.cmp(Fraction.min(y1, y2)) === 1 && iy.cmp(Fraction.min(y3, y4)) === 1 && iy.cmp(Fraction.max(y1, y2)) === -1 && iy.cmp(Fraction.max(y3, y4)) === -1) {
					walls[i].x2 = ix;
					walls[i].y2 = iy;
					walls.push({"id": wid, "x1": ix, "y1": iy, "x2": x4, "y2": y4, "colour": wc, "scattering": ws});
					points.push([ix, iy]);
					/*
				} else if (ix.isNaN()) {
					const dx = x2.sub(x1),
					      dy = y2.sub(y1),
					      minXW1 = Fraction.min(x1, x2),
					      minXW2 = Fraction.min(x3, x4),
					      maxXW1 = Fraction.max(x1, x2),
					      maxXW2 = Fraction.max(x3, x4),
					      minYW1 = Fraction.min(y1, y2),
					      minYW2 = Fraction.min(y3, y4),
					      maxYW1 = Fraction.max(y1, y2),
					      maxYW2 = Fraction.max(y3, y4);
					if ((!dx && !x2.cmp(x3) || !dx.mul(y1).sub(dy.mul(x1)).cmp(dx.mul(y3).sub(dy.mul(x4)))) && maxXW1 > minXW2 && minXW1 < maxXW2 && maxYW1 > minYW2 && minYW1 < maxYW2) {
						const m = dy.sign() === dx.sign(),
						      ox1 = Fraction.max(minXW1, minXW2),
						      oy1 = Fraction[m ? "max" : "min"](minYW1, minYW2),
						      ox2 = Fraction.min(maxXW1, maxXW2),
						      oy2 = Fraction[m ? "min" : "max"](maxYW1, maxYW2);
						walls.push({"id": oid--, "x1": ox1, "y1": oy1, "x2": ox2, "y2": oy2, "colour": new Colour(Math.max(colour.r, wc.r), Math.max(colour.g, wc.g), Math.max(colour.b, wc.b), Math.max(colour.a, wc.a)), "scattering": Math.max(ws, scattering)});
						// split original wall
						// record splits for current wall
					}
					*/
				}
			}
			points.sort(([x1, y1], [x2, y2]) => x1.cmp(x2) || y1.cmp(y2));
			for (let i = 1; i < points.length; i++) {
				const [x1, y1] = points[i-1],
				      [x2, y2] = points[i];
				walls.push({id, x1, y1, x2, y2, colour, scattering});
			}
		}
	      },
	      processLights = (ls: Lighting[]) => {
		for (const tk of ls) {
			if (tk.lightTimings.length && tk.lightStages.reduce((a, b) => a + b, 0)) {
				if (tk.lightTimings.length > 1 && !enableAnimation.value) {
					const [x, y] = tk.getCentre(),
					      [lx, ly] = tk.getLightPos();
					lights.push(new Lighting(x, y, lx, ly, tk.lightColours.map(cs => [cs[0] ?? noColour]), tk.lightStages, [0]));
				} else {
					lights.push(tk);
				}
			}
		}
	      };
	let oid = -5;
	walkLayers((l: SVGLayer, hidden: boolean) => {
		if (!hidden) {
			processWalls((addWalls(l.name) as Wall[]).map(w => (w.id = oid--, w)).concat(...l.walls));
			processLights(addLights(l.name).concat(...l.tokens));
		}
	});
	processWalls((addWalls("") as Wall[]).map(w => (w.id = oid--, w)));
	processLights(addLights(""));
	let wallsChanged = walls.length !== wallList.length,
	    lid = 0;
	for (let i = 0; i < walls.length; i++) {
		const w = walls[i];
		if (!wallsChanged) {
			const x = wallList[i];
			wallsChanged = !!w.x1.cmp(x.x1) || !!w.x2.cmp(x.x2) || !!w.y1.cmp(x.y1) || !!w.y2.cmp(x.y2) || w.scattering !== x.scattering || w.colour.toString() !== x.colour.toString();
		}
		Object.freeze(w);
	}
	if (wallsChanged) {
		definitions.clearLighting();
	}
	for (; lid < lights.length; lid++) {
		const light = lights[lid];
		if (!wallsChanged && lightList.length > lid) {
			const oldLight = lightList[lid],
			      cL = light.getCentre(),
			      cO = oldLight.getCentre(),
			      lpL = light.getLightPos(),
			      lpO = oldLight.getLightPos();
			let lightChanged = cL[0] !== cO[0] || cL[1] !== cO[1] || lpL[0] !== lpO[0] || lpL[1] !== lpO[1] || light.lightStages.length !== oldLight.lightStages.length || light.lightTimings.length !== oldLight.lightTimings.length;
			if (!lightChanged) {
				for (let j = 0; !lightChanged && j < light.lightStages.length; j++) {
					lightChanged = light.lightStages[j] !== oldLight.lightStages[j];
				}
			}
			if (!lightChanged) {
				for (let j = 0; !lightChanged && j < light.lightTimings.length; j++) {
					lightChanged = light.lightTimings[j] !== oldLight.lightTimings[j];
				}
			}
			if (!lightChanged) {
				for (let j = 0; !lightChanged && j < light.lightColours.length; j++) {
					for (let k = 0; !lightChanged && k < light.lightColours[0].length; k++) {
						lightChanged = light.lightColours[j][k].toString() !== oldLight.lightColours[j][k].toString();
					}
				}
			}
			if (!lightChanged) {
				continue;
			}
			definitions.clearLightGroup("L" + lid);
		}
		definitions.setLightGroup("L" + lid);
		makeLight(light, walls, gridSize / (gridDistance || 1));
		const [cx, cy] = light.getCentre(),
		      [lx, ly] = light.getLightPos();
		lightList.splice(lid, 1, new Lighting(cx, cy, lx, ly, cloneObject(light.lightColours), cloneObject(light.lightStages), cloneObject(light.lightTimings)));
	}
	for (; lid < lightList.length; lid++) {
		definitions.clearLightGroup("L" + lid);
	}
	if (lightList.length > lights.length) {
		lightList.splice(lights.length, lightList.length - lights.length);
	}
	if (wallsChanged) {
		wallList = walls;
		handleWalls(walls);
	}
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
	      [setupZoomDrag] = mouseDragEvent(0, zoomMove, () => amendNode(document.body, {"class": {[zooming]: false}})),
	      zoomWheel = (e: WheelEvent) => zoom(Math.sign(e.deltaY) * 0.95, window.innerWidth >> 1, window.innerHeight >> 1),
	      zoomerControl = circle({"cx": 10, "cy": 60, "r": 10, "stroke": "#000", "onmousedown": (e: MouseEvent) => {
		if (e.button === 0) {
			setupZoomDrag();
			amendNode(document.body, {"class": [zooming]});
		}
	      }, "onwheel": zoomWheel}),
	      l4 = Math.log(1.4);
	inited.then(() => amendNode(desktop, svg({"id": zoomSliderID, "viewBox": "0 0 20 120"}, [
		rect({"width": 20, "height": 120, "rx": 10, "stroke": "#000", "onclick": (e: MouseEvent) => {
			if (e.button === 0) {
				zoomMove(e);
			}
		}, "onwheel": zoomWheel}),
		zoomerControl
	])));
	zoomSlider.wait(enabled => amendNode(desktop, {"class": {[hideZoomSlider]: enabled}}));
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
	      loader = div({"id": mapLoading}, div([lang["LOADING_MAP"], ": ", percent, items])),
	      n = g(),
	      children = new NodeArray<SVGFolder | SVGLayer>(n);
	for (const c of mapData.children) {
		children.push(processLayers(wg, c));
	}
	layerList = {
		"id": 0,
		"name": "",
		"hidden": false,
		"locked": false,
		[node]: n,
		l: n,
		children,
		"folders": {},
		"items": {},
		"path": "/"
	};
	root = svg({"id": mapID, width, height}, [definitions[node], n, rect({"width": "100%", "height": "100%", "fill": "#000", "style": isAdmin ? {"fill-opacity": "var(--maskOpacity, 1)"} : undefined, "mask": `url(#${mapMask})`})]);
	wg.onComplete(() => setTimeout(() => loader.remove(), isAdmin ? 0 : 1000));
	definitions.setGrid(mapData);
	amendNode((getLayer("/Grid") as SVGLayer)[node], rect({"width": "100%", "height": "100%", "fill": `url(#${gridPattern})`}));
	amendNode((getLayer("/Light") as SVGLayer)[node], use({"href": `#${lighting}`, "style": "mix-blend-mode: multiply"}));
	definitions.setLight(lightColour);
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
	return div({"id": mapBase, "onmousedown": (e: MouseEvent) => toolMapMouseDown.call(root, e), "onwheel": (e: WheelEvent) => toolMapWheel.call(root, e), "onmouseover": (e: MouseEvent) => toolMapMouseOver.call(root, e)}, [root, loader]);
};

add(`#${mapBase}`, {
	"height": "100%"
});
add(`#${mapID}`, {
	"background-color": "#fff",
	"outline": "none",
	"position": "absolute",
	">g": {
		"clip-path": "view-box"
	}
});
add(`#${layerLight}.hiddenLayer,#${layerGrid}.hiddenLayer`, {
	"display": "none"
});
add(`#${lighting}>*`, {
	"mix-blend-mode": "screen"
});
add(`#${mapLoading}`, {
	"background-color": "#fff",
	"position": "fixed",
	"top": 0,
	"left": 0,
	"bottom": 0,
	"right": 0,
	">div": {
		"display": "flex",
		"align-items": "center",
		"justify-content": "center",
		"flex-wrap": "wrap",
		"height": "100%"
	},
	" progress": {
		"margin": "0 1em"
	}
});
add(`.${invertID} #${mapLoading}`, {
	"background-color": "#000"
});
add(`.${hideZoomSlider} #${zoomSliderID}`, {
	"display": "none"
});
add(`#${zoomSliderID}`, {
	"z-index": "10",
	"position": "absolute",
	"top": "3px",
	"left": "3px",
	"width": "20px",
	"height": "120px",
	"fill": "rgba(255, 255, 255, 0.2)",
	" :is(rect, circle)": {
		"transition": "fill 0.5s"
	},
	" rect": {
		"cursor": "pointer"
	},
	" circle": {
		"cursor": "ns-resize"
	}
});
add(`#${zoomSliderID}:hover, .${zooming} #${zoomSliderID}`, {
	" rect": {
		"fill": "#fff"
	},
	" circle": {
		"fill": "#f00"
	}
});

defaultTool.mapMouseWheel = (e: WheelEvent) => {
	if (e.ctrlKey) {
		zoom(Math.sign(e.deltaY) * 0.95, e.clientX, e.clientY);
	} else {
		const amount = scrollAmount.value || 100;
		amendNode(root, {"style": {"left": (panZoom.x += Math.sign(e.shiftKey ? e.deltaY : e.deltaX) * -amount) + "px", "top": (panZoom.y += (e.shiftKey ? 0 : Math.sign(e.deltaY)) * -amount) + "px"}});
	}
	return false;
};

enableAnimation.wait(() => mapData && updateLight());

inited.then(() => {
	rpc.waitMapStartChange().then(pos => ([mapData.startX, mapData.startY] = pos));
	rpc.waitSignalPosition().then(showSignal);
	combined.waitGridDistanceChange().then(v => {
		mapData.gridDistance = v;
		updateLight();
	});
	combined.waitGridDiagonalChange().then(v => mapData.gridDiagonal = v);
});

keyEvent(registerKey("centreMap", lang["KEY_CENTRE_MAP"], 'c'), () => centreOnGrid(mapData.startX, mapData.startY))[0]();

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
	      stopMapMove = () => amendNode(document.body, {"class": {[dragging]: false}}),
	      [startMapMove0] = mouseDragEvent(0, startMapMove, stopMapMove),
	      [startMapMove1] = mouseDragEvent(1, startMapMove, stopMapMove),
	      initMapMove = (e: MouseEvent, initFn: () => void) => {
		mX = e.clientX;
		mY = e.clientY;
		amendNode(document.body, {"class": [dragging]});
		initFn();
		return false;
	      },
	      updateToken = (token: SVGToken | SVGShape | SVGDrawing, ts: TokenSet) => {
		const hasLight = token.hasLight();
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
		token.updateNode();
		return hasLight || token.hasLight();
	      },
	      dragging = id(),
	      slidingID = id(),
	      animations = id();
	enableAnimation.wait(e => amendNode(document.documentElement, {"class": {[animations]: e}}));
	add(`#${mapID}`, {
		"overflow": "hidden",
		"cursor": "grab"
	});
	add(`.${dragging} #${mapID}`, {
		"cursor": "grabbing"
	});
	add(`.${animations} .${slidingID} #${mapID}`, {
		"transition-property": "left, top",
		"transition-duration": "1s",
		"transition-timing-function": "ease"
	});
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
			amendNode(document.body, {"class": [slidingID]});
		} else {
			clearTimeout(sliding);
		}
		sliding = setTimeout(() => {
			amendNode(document.body, {"class": {[sliding]: false}});
			sliding = -1;
		}, 1000);
		centreOnGrid(pos[0], pos[1]);
		showSignal(pos);
	});
	rpc.waitMapChange().then(setMapDetails);
	rpc.waitMapLightChange().then(setLightColour);
	rpc.waitLayerShow().then(path => setLayerVisibility(path, true));
	rpc.waitLayerHide().then(path => setLayerVisibility(path, false));
	rpc.waitLayerAdd().then(addLayer);
	rpc.waitLayerFolderAdd().then(addLayerFolder);
	rpc.waitLayerMove().then(({from, to, position}) => moveLayer(from, to, position));
	rpc.waitLayerRename().then(({path, name}) => renameLayer(path, name));
	rpc.waitLayerRemove().then(removeLayer);
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
			if (token.hasLight()) {
				updateLight();
			}
		}
	});
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
			if (token.hasLight()) {
				updateLight();
			}
		}
	});
	rpc.waitTokenSet().then(ts => {
		const {token} = tokens.get(ts.id) ?? {"token": null};
		if (token && updateToken(token, ts)) {
			updateLight();
		}
	});
	rpc.waitTokenSetMulti().then(ts => {
		let ul = false;
		for (const t of ts) {
			const {token} = tokens.get(t.id) ?? {"token": null};
			if (token && updateToken(token, t)) {
				ul = true;
			}
		}
		if (ul) {
			updateLight();
		}
	});
	rpc.waitTokenRemove().then(tk => {
		const {layer, token} = tokens.get(tk)!;
		layer.tokens.splice(layer.tokens.findIndex(t => t === token), 1)[0];
		if (token instanceof SVGToken) {
			token.cleanup();
		}
		if (token.hasLight()) {
			updateLight();
		}
	});
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
	});
	rpc.waitWallAdded().then(({path, wall}) => {
		const layer = getLayer(path);
		if (layer && isSVGLayer(layer)) {
			layer.walls.push(normaliseWall(wall));
			updateLight();
		}
	});
	rpc.waitWallRemoved().then(wp => {
		const {layer, wall} = walls.get(wp)!;
		layer.walls.splice(layer.walls.findIndex(w => w === wall), 1);
		updateLight();
	});
	rpc.waitWallModified().then(w => {
		const wall = walls.get(w.id);
		if (wall) {
			Object.assign(wall.wall, w);
			updateLight();
		}
	});
	rpc.waitWallMoved().then(({id, path}) => {
		const wall = walls.get(id),
		      layer = getLayer(path);
		if (wall && layer && isSVGLayer(layer)) {
			wall.layer.walls.splice(wall.layer.walls.findIndex(w => w === wall.wall));
			layer.walls.push(wall.wall);
			wall.layer = layer;
		}
	});
	rpc.waitMapDataSet().then(kd => {
		if (kd.key) {
			mapData.data[kd.key] = kd.data;
		}
	});
	rpc.waitMapDataRemove().then(key => delete mapData.data[key]);
	rpc.waitMaskAdd().then(masks.add);
	rpc.waitMaskRemove().then(masks.remove);
	rpc.waitMaskSet().then(({baseOpaque, masks: ms}) => masks.set(baseOpaque, ms));
};
