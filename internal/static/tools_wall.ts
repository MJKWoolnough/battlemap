import type {RPCWaits, Uint, Wall} from './types.js';
import type {WindowElement} from './windows.js';
import {clearElement} from './lib/dom.js';
import {keyEvent, mouseDragEvent, mouseMoveEvent} from './lib/events.js';
import {createHTML, br, div, fieldset, img, input, legend} from './lib/html.js';
import {createSVG, svgData, defs, g, path, pattern, rect, svg, title} from './lib/svg.js';
import {Colour, hex2Colour, makeColourPicker} from './colours.js';
import lang from './language.js';
import {root, screen2Grid} from './map.js';
import {doWallAdd, doWallModify} from './map_fns.js';
import {autosnap} from './settings.js';
import {combined, inited} from './rpc.js';
import {checkInt, cloneObject, deselectToken, labels, selected, setAndReturn, walls} from './shared.js';
import {addTool, marker, optionsWindow} from './tools.js';

let wallColour = hex2Colour("#000"),
    active = false,
    selectedWall = 0,
    w: WindowElement | null = null;

const updateCursorState = () => {
	if (placeWall.checked) {
		createSVG(root, {"style": {"cursor": "none"}}, marker);
		startCursorMove();
	} else {
		cancelCursorMove();
	}
      },
      selectWall = input({"type": "radio", "name": "wallTool", "class": "settings_ticker", "checked": true, "onchange": updateCursorState}),
      placeWall = input({"type": "radio", "name": "wallTool", "class": "settings_ticker", "onchange": updateCursorState}),
      scattering = input({"type": "range", "min": 0, "max": 255, "value": 0}),
      snap = input({"type": "checkbox", "class": "settings_ticker"}),
      shiftSnap = () => snap.click(),
      [setupShiftSnap, cancelShiftSnap] = keyEvent("Shift", shiftSnap, shiftSnap),
      [startCursorMove, cancelCursorMove] = mouseMoveEvent((e: MouseEvent) => {
	const [x, y] = screen2Grid(e.clientX, e.clientY, snap.checked);
	createSVG(marker, {"transform": `translate(${x - 10}, ${y - 10})`});
      }, () => {
	createSVG(root, {"style": {"cursor": undefined}});
	marker.remove()
      }),
      coords = [0, 0],
      wall = rect({"height": 10, "fill": "#000", "stroke": "#000", "stroke-width": 2}),
      [startWallDraw, cancelWallDraw] = mouseDragEvent(0, (e: MouseEvent) => {
	const [x, y] = screen2Grid(e.clientX, e.clientY, snap.checked);
	createSVG(wall, {"width": Math.hypot(x - coords[0], y - coords[1]), "transform": `rotate(${Math.atan2(y - coords[1], x - coords[0]) * 180 / Math.PI}, ${coords[0]}, ${coords[1]})`});
      }, (e: MouseEvent) => {
	if (e.isTrusted && selected.layer) {
		const [x2, y2] = screen2Grid(e.clientX, e.clientY, snap.checked);
		doWallAdd({"path": selected.layer.path, "wall": {"id": 0, "x1": coords[0], "y1": coords[1], x2, y2, "colour": wallColour, "scattering": checkInt(parseInt(scattering.value), 0, 255, 0)}});
	}
	wall.remove();
      }),
      wallLayer = g(),
      wallMap = new Map<Uint, SVGRectElement>(),
      genWalls = () => {
	clearElement(wallLayer);
	wallMap.clear();
	for (const {layer, wall} of walls.values()) {
		if (!layer.hidden) {
			const {id, x1, y1, x2, y2, colour} = wall;
			createSVG(wallLayer, setAndReturn(wallMap, id, rect({"x": x1, "y": y1 - 5, "width": Math.hypot(x1 - x2, y1 - y2), "class": "wall", "transform": `rotate(${Math.atan2(y2 - y1, x2 - x1) * 180 / Math.PI}, ${x1}, ${y1})`, "fill": colour, "stroke": colour.toHexString(), "ondragover": (e: DragEvent) => {
				if (e.dataTransfer?.types.includes("colour") || e.dataTransfer?.types.includes("scattering")) {
					e.preventDefault();
					e.dataTransfer.dropEffect = "copy";
				}
			}, "ondrop": (e: DragEvent) => {
				const wall = walls.get(id);
				if (wall) {
					const override: Partial<Wall> = {};
					if (e.dataTransfer?.types.includes("colour")) {
						override["colour"] = Colour.from(JSON.parse(e.dataTransfer.getData("colour")));
					} else if (e.dataTransfer?.types.includes("scattering")) {
						override["scattering"] = JSON.parse(e.dataTransfer.getData("colour"));
					} else {
						return;
					}
					e.preventDefault();
					doWallModify(Object.assign(cloneObject(wall.wall), override));
				}
			}, "onmousedown": (e: MouseEvent) => {
				const wall = walls.get(id);
				if (wall) {
					const {x1, y1, x2, y2} = wall.wall
					createSVG(root, [
						createSVG(draggableMarker1, {"transform": `translate(${x1 - 10}, ${y1 - 10})`}),
						createSVG(draggableMarker2, {"transform": `translate(${x2 - 10}, ${y2 - 10})`})
					]);
					selectedWall = id;
					e.stopPropagation();
				}
			}}, title(layer.path))));
		}
	}
      },
      [startDrawEscape, cancelDrawEscape] = keyEvent("Escape", () => cancelWallDraw()),
      icon = svg({"width": 30, "height": 20, "viewBox": "0 0 90 60"}, [
		defs(pattern({"id": "brick", "patternUnits": "userSpaceOnUse", "width": 30, "height": 30}, path({"d": "M15,30 V15 H0 V0 H30 V15 H15 M0,30 H30", "fill": "none", "style": "stroke: currentColor", "stroke-width": 3}))),
		path({"d": "M60,15 V0.5 H0.5 V59.5 H89.5 V15 Z", "fill": "url(#brick)", "style": "stroke: currentColor", "stroke-width": 2})
      ]),
      iconStr = svgData(icon),
      iconImg = img({"src": iconStr}),
      [draggableMarker1, draggableMarker2] = Array.from({length: 2}, () => path({"d": "M8,0 h4 v8 h8 v4 h-8 v8 h-4 v-8 h-8 v-4 h8 z", "class": "wallMarker"}));

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
		labels(`${lang["TOOL_WALL_COLOUR"]}: `, makeColourPicker(optionsWindow, lang["TOOL_WALL_COLOUR"], () => wallColour, (c: Colour) => createSVG(wall, {"fill": wallColour = c, "stroke": c.toHexString()}), iconStr)),
		br(),
		labels(`${lang["TOOL_WALL_SCATTER"]}: `, scattering, true, {"draggable": "true", "ondragstart": (e: DragEvent) => {
			e.dataTransfer!.setDragImage(iconImg, -5, -5);
			e.dataTransfer!.setData("scattering", checkInt(parseInt(scattering.value), 0, 255, 0) + "");
		}})
	]),
	"mapMouse0": (e: MouseEvent) => {
		if (e.ctrlKey) {
			return true;
		}
		if (placeWall.checked) {
			const [x, y] = screen2Grid(e.clientX, e.clientY, snap.checked);
			createSVG(root, createSVG(wall, {"width": 0, "x": coords[0] = x, "y": (coords[1] = y) - 5, "transform": undefined}));
			startWallDraw();
		} else {
			draggableMarker1.remove();
			draggableMarker2.remove();
			selectedWall = 0;
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
		createHTML(snap, {"checked": autosnap.value});
		genWalls();
		createSVG(root, {"style": {"cursor": placeWall.checked ? "none" : undefined}}, [
			wallLayer,
			placeWall.checked ? marker : []
		]);
		setupShiftSnap();
		startDrawEscape();
	},
	"unset": () => {
		active = false;
		cancelShiftSnap();
		cancelCursorMove();
		cancelWallDraw();
		cancelDrawEscape();
		wallLayer.remove();
		if (w) {
			w.remove();
			w = null;
		}
		draggableMarker1.remove();
		draggableMarker2.remove();
		selectedWall = 0;
	}
});

inited.then(() => {
	const gw = () => {
		if (active) {
			window.setTimeout(genWalls, 0);
		}
	};
	for (const wait of ["waitWallAdded", "waitWallRemoved", "waitWallModified", "waitLayerMove", "waitLayerRemove", "waitLayerShift", "waitLayerShow", "waitLayerHide"] as (keyof RPCWaits)[]) {
		(combined as Omit<typeof combined, "images" | "audio" | "characters" | "map">)[wait]().then(gw);
	}
});
