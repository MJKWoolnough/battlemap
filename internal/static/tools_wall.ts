import type {RPCWaits, Uint, Wall} from './types.js';
import type {WindowElement} from './windows.js';
import {amendNode, clearNode} from './lib/dom.js';
import {keyEvent, mouseDragEvent, mouseMoveEvent} from './lib/events.js';
import {br, div, fieldset, img, input, legend} from './lib/html.js';
import {svgData, defs, foreignObject, g, path, pattern, rect, svg, title} from './lib/svg.js';
import {Colour, hex2Colour, makeColourPicker, noColour} from './colours.js';
import {colour, scattering, setDragEffect} from './dragTransfer.js';
import lang from './language.js';
import {root, screen2Grid} from './map.js';
import {doWallAdd, doWallModify} from './map_fns.js';
import {deselectToken, selected} from './map_tokens.js';
import {autosnap} from './settings.js';
import {combined, inited} from './rpc.js';
import {checkInt, cloneObject, labels, setAndReturn, walls} from './shared.js';
import {addTool, marker, optionsWindow} from './tools.js';

let wallColour = hex2Colour("#000"),
    active = false,
    selectedWall = 0,
    selectedMarker = 0,
    w: WindowElement | null = null;

const updateCursorState = () => {
	if (placeWall.checked) {
		amendNode(root, {"style": {"cursor": "none"}}, marker);
		startCursorMove();
	} else {
		cancelCursorMove();
	}
      },
      selectWall = input({"type": "radio", "name": "wallTool", "class": "settings_ticker", "checked": true, "onchange": updateCursorState}),
      placeWall = input({"type": "radio", "name": "wallTool", "class": "settings_ticker", "onchange": updateCursorState}),
      scatteringI = input({"type": "range", "min": 0, "max": 255, "value": 0, "ondragover": setDragEffect({"copy": [scattering]}), "ondrop": (e: DragEvent) => {
	if (scattering.is(e)) {
		scatteringI.value = scattering.get(e) + "";
	}
      }}),
      dragKey = scattering.register({"transfer": () => checkInt(parseInt(scatteringI.value), 0, 255, 0)}),
      scatteringDragKey = scattering.register({"transfer": () => walls.get(selectedWall)?.wall.scattering ?? 0}),
      colourDragKey = colour.register({"transfer": () => walls.get(selectedWall)?.wall.colour ?? noColour}),
      snap = input({"type": "checkbox", "class": "settings_ticker"}),
      shiftSnap = () => snap.click(),
      [setupShiftSnap, cancelShiftSnap] = keyEvent("Shift", shiftSnap, shiftSnap),
      [startCursorMove, cancelCursorMove] = mouseMoveEvent((e: MouseEvent) => {
	const [x, y] = screen2Grid(e.clientX, e.clientY, snap.checked);
	amendNode(marker, {"transform": `translate(${x - 10}, ${y - 10})`});
      }, () => {
	amendNode(root, {"style": {"cursor": undefined}});
	marker.remove()
      }),
      coords = [0, 0],
      wall = rect({"height": 10, "fill": "#000", "stroke": "#000", "stroke-width": 2}),
      [startWallDraw, cancelWallDraw] = mouseDragEvent(0, (e: MouseEvent) => {
	const [x, y] = screen2Grid(e.clientX, e.clientY, snap.checked);
	amendNode(wall, {"width": Math.hypot(x - coords[0], y - coords[1]), "transform": `rotate(${Math.atan2(y - coords[1], x - coords[0]) * 180 / Math.PI}, ${coords[0]}, ${coords[1]})`});
      }, (e: MouseEvent) => {
	if (e.isTrusted && selected.layer) {
		const [x2, y2] = screen2Grid(e.clientX, e.clientY, snap.checked);
		doWallAdd({"path": selected.layer.path, "wall": {"id": 0, "x1": coords[0], "y1": coords[1], x2, y2, "colour": wallColour, "scattering": checkInt(parseInt(scatteringI.value), 0, 255, 0)}});
	}
	wall.remove();
      }),
      wallLayer = g(),
      wallMap = new Map<Uint, SVGRectElement>(),
      validWallDrag = setDragEffect({"copy": [colour, scattering]}),
      wallDrop = (e: DragEvent, id: Uint) => {
	const wall = walls.get(id);
	if (wall) {
		const override: Partial<Wall> = {"colour": wall.wall.colour};
		if (colour.is(e)) {
			override["colour"] = colour.get(e);
		} else if (scattering.is(e)) {
			override["scattering"] = scattering.get(e);
		} else {
			return;
		}
		e.preventDefault();
		doWallModify(Object.assign(cloneObject(wall.wall), override));
	}
      },
      wallOverlay = div({"style": {"position": "absolute", "height": "10px"}, "draggable": "true", "ondragstart": (e: DragEvent) => {
	const wall = walls.get(selectedWall);
	if (wall) {
		colour.set(e, colourDragKey, iconImg);
		scattering.set(e, scatteringDragKey);
	}
      }, "ondragover": validWallDrag, "ondrop": (e: DragEvent) => wallDrop(e, selectedWall), "onmousedown": (e: Event) => e.stopPropagation()}),
      fWallOverlay = foreignObject({"height": 10}, wallOverlay),
      genWalls = () => {
	clearNode(wallLayer);
	wallMap.clear();
	for (const {layer, wall} of walls.values()) {
		if (!layer.hidden) {
			const {id, x1, y1, x2, y2, colour, scattering} = wall;
			amendNode(wallLayer, setAndReturn(wallMap, id, rect({"x": x1, "y": y1 - 5, "width": Math.hypot(x1 - x2, y1 - y2), "class": "wall", "transform": `rotate(${Math.atan2(y2 - y1, x2 - x1) * 180 / Math.PI}, ${x1}, ${y1 - 5})`, "fill": colour, "stroke": colour.toHexString(), "ondragover": validWallDrag, "ondrop": (e: DragEvent) => wallDrop(e, id), "onmousedown": (e: MouseEvent) => {
				const wall = walls.get(id);
				if (wall) {
					const {x1, y1, x2, y2} = wall.wall,
					      width = Math.round(Math.hypot(x1 - x2, y1 - y2));
					amendNode(wallOverlay, {"style": {"width": width + "px"}});
					amendNode(root, [
						amendNode(fWallOverlay, {width, "x": x1, "y": y1 - 5, "transform": `rotate(${Math.atan2(y2 - y1, x2 - x1) * 180 / Math.PI}, ${x1}, ${y1 - 5})`}),
						amendNode(draggableMarker1, {"transform": `translate(${x1 - 10}, ${y1 - 10})`}),
						amendNode(draggableMarker2, {"transform": `translate(${x2 - 10}, ${y2 - 10})`})
					]);
					selectedWall = id;
					e.stopPropagation();
				}
			}}, title(`${lang["TOOL_WALL_LAYER"]}: ${layer.path}\n${lang["TOOL_WALL_COLOUR"]}: ${colour}\n${lang["TOOL_WALL_SCATTER"]}: ${scattering}`))));
		}
	}
	if (selectedWall && !walls.has(selectedWall)) {
		deselectWall();
	}
      },
      [startEscape, cancelEscape] = keyEvent("Escape", () => {
	      cancelWallDraw();
	      cancelMarkerDrag();
      }),
      icon = svg({"width": 30, "height": 20, "viewBox": "0 0 90 60"}, [
		defs(pattern({"id": "brick", "patternUnits": "userSpaceOnUse", "width": 30, "height": 30}, path({"d": "M15,30 V15 H0 V0 H30 V15 H15 M0,30 H30", "fill": "none", "style": "stroke: currentColor", "stroke-width": 3}))),
		path({"d": "M60,15 V0.5 H0.5 V59.5 H89.5 V15 Z", "fill": "url(#brick)", "style": "stroke: currentColor", "stroke-width": 2})
      ]),
      iconStr = svgData(icon),
      iconImg = img({"src": iconStr}),
      [draggableMarker1, draggableMarker2] = Array.from({length: 2}, (_, n: Uint) => path({"d": "M8,0 h4 v8 h8 v4 h-8 v8 h-4 v-8 h-8 v-4 h8 z", "class": "wallMarker", "onmousedown": (e: MouseEvent) => {
	if (e.button === 0) {
		selectedMarker = n;
		startMarkerDrag();
		e.stopPropagation();
	}
      }})),
      [startMarkerDrag, cancelMarkerDrag] = mouseDragEvent(0, (e: MouseEvent) => {
	const wall = walls.get(selectedWall);
	if (wall) {
		const {x1, y1, x2, y2} = wall.wall,
		      wallRect = wallMap.get(selectedWall)!,
		      [x, y] = screen2Grid(e.clientX, e.clientY, snap.checked),
		      [ax1, ay1] = selectedMarker === 0 ? [x, y] : [x1, y1],
		      [ax2, ay2] = selectedMarker === 1 ? [x, y] : [x2, y2];
		amendNode(wallRect, {"x": ax1, "y": ay1 - 5, "width": Math.hypot(ax1 - ax2, ay1 - ay2), "transform": `rotate(${Math.atan2(ay2 - ay1, ax2 - ax1) * 180 / Math.PI}, ${ax1}, ${ay1})`});
		amendNode(selectedMarker ? draggableMarker2 : draggableMarker1, {"transform": `translate(${x - 10}, ${y - 10})`});
	} else {
		deselectWall();
	}
      }, (e: MouseEvent) => {
	const wall = walls.get(selectedWall);
	if (wall) {
		const {x1, y1, x2, y2} = wall.wall,
		      wallRect = wallMap.get(selectedWall)!;
		if (e.isTrusted) {
			const {colour, scattering} = wall.wall,
			      [x, y] = screen2Grid(e.clientX, e.clientY, snap.checked),
			      [ax1, ay1] = selectedMarker === 0 ? [x, y] : [x1, y1],
			      [ax2, ay2] = selectedMarker === 1 ? [x, y] : [x2, y2];
			amendNode(selectedMarker ? draggableMarker2 : draggableMarker1, {"transform": `translate(${x - 10}, ${y - 10})`});
			doWallModify({"id": selectedWall, "x1": ax1, "y1": ay1, "x2": ax2, "y2": ay2, colour, scattering})
		} else {
			amendNode(wallRect, {"x": x1, "y": y1 - 5, "width": Math.hypot(x1 - x2, y1 - y2), "transform": `rotate(${Math.atan2(y2 - y1, x2 - x1) * 180 / Math.PI}, ${x1}, ${y1})`});
			amendNode(draggableMarker1, {"transform": `translate(${x1 - 10}, ${y1 - 10})`}),
			amendNode(draggableMarker2, {"transform": `translate(${x2 - 10}, ${y2 - 10})`})
		}
	}
      }),
      deselectWall = () => {
	selectedWall = 0;
	fWallOverlay.remove();
	draggableMarker1.remove();
	draggableMarker2.remove();
	cancelMarkerDrag();
      };

addTool({
	"name": lang["TOOL_WALL"],
	icon,
	"options": div([
		fieldset([
			legend(lang["TOOL_WALL_MODE"]),
			labels(`${lang["TOOL_WALL_SELECT"]}: `, selectWall, false),
			br(),
			labels(`${lang["TOOL_WALL_PLACE"]}: `, placeWall, false)
		]),
		labels(`${lang["TOOL_WALL_SNAP"]}: `, snap, false),
		br(),
		labels(`${lang["TOOL_WALL_COLOUR"]}: `, makeColourPicker(optionsWindow, lang["TOOL_WALL_COLOUR"], () => wallColour, (c: Colour) => amendNode(wall, {"fill": wallColour = c, "stroke": c.toHexString()}), iconStr)),
		br(),
		labels(`${lang["TOOL_WALL_SCATTER"]}: `, scatteringI, true, {"draggable": "true", "ondragstart": (e: DragEvent) => scattering.set(e, dragKey, iconImg)})
	]),
	"mapMouse0": (e: MouseEvent) => {
		if (e.ctrlKey) {
			return true;
		}
		if (placeWall.checked) {
			const [x, y] = screen2Grid(e.clientX, e.clientY, snap.checked);
			amendNode(root, amendNode(wall, {"width": 0, "x": coords[0] = x, "y": (coords[1] = y) - 5, "transform": undefined}));
			startWallDraw();
		} else {
			deselectWall();
		}
		return false;
	},
	"mapMouseOver": () => {
		updateCursorState();
		return false;
	},
	"set": () => {
		active = true;
		deselectToken();
		amendNode(snap, {"checked": autosnap.value});
		genWalls();
		amendNode(root, {"style": {"cursor": placeWall.checked ? "none" : undefined}}, [
			wallLayer,
			placeWall.checked ? marker : []
		]);
		setupShiftSnap();
		startEscape();
	},
	"unset": () => {
		active = false;
		cancelShiftSnap();
		cancelCursorMove();
		cancelWallDraw();
		cancelEscape();
		wallLayer.remove();
		if (w) {
			w.remove();
			w = null;
		}
		deselectWall();
	}
});

inited.then(() => {
	const gw = () => {
		if (active) {
			setTimeout(genWalls, 0);
		}
	};
	for (const wait of ["waitWallAdded", "waitWallRemoved", "waitWallModified", "waitLayerMove", "waitLayerRemove", "waitLayerShift", "waitLayerShow", "waitLayerHide"] as (keyof RPCWaits)[]) {
		(combined as Omit<typeof combined, "images" | "audio" | "characters" | "map">)[wait]().then(gw);
	}
});
