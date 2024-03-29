import type {MenuItems} from './lib/menu.js';
import type {NodeArray} from './lib/nodes.js';
import type {SVGFolder, SVGLayer} from './map.js';
import type {RPCWaits} from './rpc.js';
import type {Byte, Uint, Wall} from './types.js';
import type {WindowElement} from './windows.js';
import {add, ids} from './lib/css.js';
import {amendNode, clearNode} from './lib/dom.js';
import {DragTransfer} from './lib/drag.js';
import {setDragEffect} from './lib/drag.js';
import {keyEvent, mouseDragEvent, mouseMoveEvent} from './lib/events.js';
import {br, div, fieldset, img, input, legend} from './lib/html.js';
import {item, menu, submenu} from './lib/menu.js';
import {checkInt, setAndReturn} from './lib/misc.js';
import {defs, foreignObject, g, path, pattern, rect, svg, svgData, title} from './lib/svg.js';
import {Colour, ColourSetting, dragColour, hex2Colour, makeColourPicker, noColour} from './colours.js';
import {settingsTicker} from './ids.js';
import lang from './language.js';
import {isSVGFolder, layerList, panZoom, root, screen2Grid} from './map.js';
import {doWallAdd, doWallModify, doWallMove, doWallRemove} from './map_fns.js';
import {deselectToken, selected} from './map_tokens.js';
import {combined, inited, isAdmin} from './rpc.js';
import {autosnap} from './settings.js';
import {cloneObject, labels, walls} from './shared.js';
import {addTool, marker, optionsWindow} from './tools.js';

inited.then(() => {
	if (!isAdmin) {
		return;
	}
	let wallColour = hex2Colour("#000"),
	    active = false,
	    selectedWall = 0,
	    selectedLayer: SVGLayer | null = null,
	    selectedMarker = 0,
	    w: WindowElement | null = null;

	const [wallID, selectWallID, wallMarkerID, brick] = ids(4),
	      updateCursorState = () => {
		if (placeWall.checked) {
			amendNode(root, {"style": {"cursor": "none"}, "class": {[selectWallID]: false}}, marker);
			startCursorMove();
		} else {
			amendNode(root, {"class": [selectWallID]});
			cancelCursorMove();
		}
	      },
	      dragScattering = new DragTransfer<Byte>("scattering"),
	      selectWall = input({"type": "radio", "name": "wallTool", "class": settingsTicker, "checked": true, "onchange": updateCursorState}),
	      placeWall = input({"type": "radio", "name": "wallTool", "class": settingsTicker, "onchange": () => {
		updateCursorState();
		deselectWall();
	      }}),
	      scatteringI = input({"type": "range", "min": 0, "max": 255, "value": 0, "ondragover": setDragEffect({"copy": [dragScattering]}), "ondrop": (e: DragEvent) => {
		if (dragScattering.is(e)) {
			scatteringI.value = dragScattering.get(e) + "";
		}
	      }}),
	      continuous = input({"type": "checkbox", "class": settingsTicker}),
	      dragKey = dragScattering.register(() => checkInt(parseInt(scatteringI.value), 0, 255, 0)),
	      scatteringDragKey = dragScattering.register(() => walls.get(selectedWall)?.wall.scattering ?? 0),
	      colourDragKey = dragColour.register(() => walls.get(selectedWall)?.wall.colour ?? noColour),
	      snap = input({"type": "checkbox", "class": settingsTicker}),
	      shiftSnap = () => snap.click(),
	      [setupShiftSnap, cancelShiftSnap] = keyEvent("Shift", shiftSnap, shiftSnap),
	      [startCursorMove, cancelCursorMove] = mouseMoveEvent((e: MouseEvent) => {
		const [x, y] = screen2Grid(e.clientX, e.clientY, snap.checked);
		amendNode(marker, {"transform": `translate(${x - 10 / panZoom.zoom}, ${y - 10 / panZoom.zoom}) scale(${1/panZoom.zoom})`});
	      }, () => {
		amendNode(root, {"style": {"cursor": undefined}});
		marker.remove()
	      }),
	      [startWallDelete, cancelWallDelete] = keyEvent("Delete", () => {
		if (selectedWall) {
			doWallRemove(selectedWall);
			deselectWall();
		}
	      }),
	      coords = [0, 0],
	      wall = rect({"height": 10, "fill": "#000", "stroke": "#000", "stroke-width": 2}),
	      wallMouseMove = (e: MouseEvent) => {
		const [x, y] = screen2Grid(e.clientX, e.clientY, snap.checked);
		amendNode(wall, {"width": Math.hypot(x - coords[0], y - coords[1]), "transform": `rotate(${Math.atan2(y - coords[1], x - coords[0]) * 180 / Math.PI}, ${coords[0]}, ${coords[1]})`});
	      },
	      wallMouseStop = (e: MouseEvent) => {
		if (e.isTrusted && selected.layer) {
			const [x2, y2] = screen2Grid(e.clientX, e.clientY, snap.checked);
			doWallAdd({"path": selected.layer.path, "wall": {"id": 0, "x1": coords[0], "y1": coords[1], x2, y2, "colour": wallColour, "scattering": checkInt(parseInt(scatteringI.value), 0, 255, 0)}});
		}
		wall.remove();
	      },
	      [startWallDraw, cancelWallDraw] = mouseDragEvent(0, wallMouseMove, wallMouseStop),
	      [startWallMove, cancelWallMove] = mouseMoveEvent(wallMouseMove, () => wall.remove()),
	      wallUnderlay = rect({"width": "100%", "height": "100%"}),
	      underlayColour = new ColourSetting("underlayColour", new Colour(255, 255, 255, 63)).wait(fill => amendNode(wallUnderlay, {fill})),
	      wallLayer = g(wallUnderlay),
	      wallMap = new Map<Uint, SVGRectElement>(),
	      validWallDrag = setDragEffect({"copy": [dragColour, dragScattering]}),
	      wallDrop = (e: DragEvent, id: Uint) => {
		const wall = walls.get(id);
		if (wall) {
			const override: Partial<Wall> = {"colour": wall.wall.colour};
			if (dragColour.is(e)) {
				override["colour"] = dragColour.get(e);
			} else if (dragScattering.is(e)) {
				override["scattering"] = dragScattering.get(e);
			} else {
				return;
			}
			e.preventDefault();
			doWallModify(Object.assign(cloneObject(wall.wall), override));
		}
	      },
	      makeLayerContext = (fn: (sl: SVGLayer) => void, disabled = "", folder: SVGFolder = layerList): MenuItems => (folder.children as NodeArray<SVGFolder | SVGLayer>).map(e => e.id < 0 ? [] : isSVGFolder(e) ? submenu([item(e.name), menu(makeLayerContext(fn, disabled, e))]) : item(e.name === disabled ? {"disabled": true} : {"onselect": () => fn(e)}, e.name)),
	      wallOverlay = div({"style": "position: absolute; height: 10px", "draggable": "true", "ondragstart": (e: DragEvent) => {
		if (walls.has(selectedWall)) {
			dragColour.set(e, colourDragKey, iconImg);
			dragScattering.set(e, scatteringDragKey);
		}
	      }, "ondragover": validWallDrag, "ondrop": (e: DragEvent) => wallDrop(e, selectedWall), "oncontextmenu": (e: MouseEvent) => {
		e.stopPropagation();
		e.preventDefault();
		if (selectedLayer) {
			const wallID = selectedWall;
			amendNode(document.body, menu({"x": e.clientX, "y": e.clientY}, [
				item({"onselect": () => {
					if (selectedWall === wallID) {
						const wall = walls.get(wallID);
						if (wall) {
							wall.wall["colour"] = wallColour;
							doWallModify(cloneObject(wall.wall));
						}
					}
				}}, lang["TOOL_WALL_COLOUR_SET"]),
				item({"onselect": () => {
					if (selectedWall === wallID) {
						const wall = walls.get(wallID);
						if (wall) {
							wall.wall["scattering"] = checkInt(parseInt(scatteringI.value), 0, 255, 0);
							doWallModify(cloneObject(wall.wall));
						}
					}
				}}, lang["TOOL_WALL_SCATTER_SET"]),
				submenu([
					item(lang["CONTEXT_MOVE_LAYER"]),
					menu(makeLayerContext((sl: SVGLayer) => {
						if (selectedWall === wallID) {
							doWallMove(wallID, sl.path);
						}
					}, selectedLayer.name))
				]),
				item({"onselect": () => {
					if (selectedWall === wallID) {
						doWallRemove(wallID);
						deselectWall();
					}
				}}, lang["CONTEXT_DELETE"])
			]));
		}
	      }}),
	      fWallOverlay = foreignObject({"height": 10}, wallOverlay),
	      setOverlay = (x1: Uint, y1: Uint, x2: Uint, y2: Uint) => {
		const width = Math.round(Math.hypot(x1 - x2, y1 - y2));
		amendNode(wallOverlay, {"style": {"width": width + "px"}});
		amendNode(root, [
			amendNode(fWallOverlay, {width, "x": x1, "y": y1 - 5, "transform": `rotate(${Math.atan2(y2 - y1, x2 - x1) * 180 / Math.PI}, ${x1}, ${y1})`}),
			amendNode(draggableMarker1, {"transform": `translate(${x1 - 10}, ${y1 - 10})`}),
			amendNode(draggableMarker2, {"transform": `translate(${x2 - 10}, ${y2 - 10})`})
		]);
	      },
	      genWalls = () => {
		clearNode(wallLayer, wallUnderlay);
		wallMap.clear();
		let hasSelected = false;
		for (const {layer, wall} of walls.values()) {
			if (!layer.hidden && !layer.locked) {
				const {id, x1, y1, x2, y2, colour, scattering} = wall;
				if (id === selectedWall) {
					setOverlay(x1, y1, x2, y2);
					hasSelected = true;
				}
				amendNode(wallLayer, setAndReturn(wallMap, id, rect({"x": x1, "y": y1 - 5, "width": Math.hypot(x1 - x2, y1 - y2), "class": wallID, "transform": `rotate(${Math.atan2(y2 - y1, x2 - x1) * 180 / Math.PI}, ${x1}, ${y1})`, "fill": colour, "stroke": colour.toHexString(), "ondragover": validWallDrag, "ondrop": (e: DragEvent) => wallDrop(e, id), "onmousedown": (e: MouseEvent) => {
					if (selectWall.checked && wall && e.button === 0) {
						setOverlay(x1, y1, x2, y2);
						selectedWall = id;
						selectedLayer = layer;
						startWallDelete();
						startWallEscape();
						e.stopPropagation();
					}
				}}, title([lang["TOOL_WALL_LAYER"], `: ${layer.path}\n`, lang["TOOL_WALL_COLOUR"], `: ${colour}\n`, lang["TOOL_WALL_SCATTER"], `: ${scattering}`]))));
			}
		}
		if (!hasSelected) {
			deselectWall();
		}
	      },
	      [startEscape, cancelEscape] = keyEvent("Escape", () => {
		      cancelWallDraw();
		      cancelMarkerDrag();
		      cancelWallMove();
	      }),
	      icon = svg({"viewBox": "0 0 90 60"}, [
		title(lang["TOOL_WALL"]),
		defs(pattern({"id": brick, "patternUnits": "userSpaceOnUse", "width": 30, "height": 30}, path({"d": "M15,30 V15 H0 V0 H30 V15 H15 M0,30 H30", "fill": "none", "style": "stroke: currentColor", "stroke-width": 3}))),
		path({"d": "M60,15 V0.5 H0.5 V59.5 H89.5 V15 Z", "fill": `url(#${brick})`, "style": "stroke: currentColor", "stroke-width": 2})
	      ]),
	      iconStr = svgData(icon),
	      iconImg = img({"src": iconStr}),
	      [draggableMarker1, draggableMarker2] = Array.from({length: 2}, (_, n: Uint) => path({"d": "M8,0 h4 v8 h8 v4 h-8 v8 h-4 v-8 h-8 v-4 h8 z", "class": wallMarkerID, "onmousedown": (e: MouseEvent) => {
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
				doWallModify({"id": selectedWall, "x1": ax1, "y1": ay1, "x2": ax2, "y2": ay2, colour, scattering});
			} else {
				amendNode(wallRect, {"x": x1, "y": y1 - 5, "width": Math.hypot(x1 - x2, y1 - y2), "transform": `rotate(${Math.atan2(y2 - y1, x2 - x1) * 180 / Math.PI}, ${x1}, ${y1})`});
				amendNode(draggableMarker1, {"transform": `translate(${x1 - 10}, ${y1 - 10})`}),
				amendNode(draggableMarker2, {"transform": `translate(${x2 - 10}, ${y2 - 10})`})
			}
		}
	      }),
	      deselectWall = () => {
		selectedWall = 0;
		selectedLayer = null;
		fWallOverlay.remove();
		draggableMarker1.remove();
		draggableMarker2.remove();
		cancelMarkerDrag();
		cancelWallDelete();
		cancelWallEscape();
	      },
	      [startWallEscape, cancelWallEscape] = keyEvent("Escape", deselectWall),
	      gw = () => {
		if (active) {
			setTimeout(genWalls);
		}
	      };
	add({
		[`.${wallID}`]: {
			"height": "10px",
			"stroke-width": 2
		},
		[`.${selectWallID} .${wallID}`]: {
			"cursor": "pointer"
		},
		[`.${wallMarkerID}`]: {
			"fill": "#000",
			"stroke": "#fff",
			"cursor": "move"
		}
	});
	addTool({
		"name": lang["TOOL_WALL"],
		"id": "tool_wall",
		icon,
		"options": div([
			fieldset([
				legend(lang["TOOL_WALL_MODE"]),
				labels(selectWall, [lang["TOOL_WALL_SELECT"], ": "]),
				br(),
				labels(placeWall, [lang["TOOL_WALL_PLACE"], ": "])
			]),
			labels(snap, [lang["TOOL_WALL_SNAP"], ": "]),
			br(),
			labels(continuous, [lang["TOOL_WALL_CONTINUOUS"], ": "]),
			br(),
			labels([lang["TOOL_WALL_COLOUR"], ": "], makeColourPicker(optionsWindow, lang["TOOL_WALL_COLOUR"], () => wallColour, (c: Colour) => amendNode(wall, {"fill": wallColour = c, "stroke": c.toHexString()}), iconStr)),
			br(),
			labels([lang["TOOL_WALL_SCATTER"], ": "], scatteringI, {"draggable": "true", "ondragstart": (e: DragEvent) => dragScattering.set(e, dragKey, iconImg)}),
			br(),
			labels([lang["TOOL_WALL_UNDERLAY"], ": "], makeColourPicker(optionsWindow, lang["TOOL_WALL_UNDERLAY"], () => underlayColour.value, (c: Colour) => underlayColour.set(c), iconStr))
		]),
		"mapMouse0": (e: MouseEvent) => {
			if (e.ctrlKey && !e.shiftKey) {
				return true;
			}
			if (placeWall.checked) {
				if (continuous.checked) {
					if (wall.parentNode) {
						wallMouseStop(e);
					}
					startWallMove();
				} else {
					startWallDraw();
				}
				const [x, y] = screen2Grid(e.clientX, e.clientY, snap.checked);
				amendNode(root, amendNode(wall, {"width": 0, "x": coords[0] = x, "y": (coords[1] = y) - 5, "transform": undefined}));
			} else {
				deselectWall();
			}
			return false;
		},
		"mapMouse2": () => {
			cancelWallMove();
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
			cancelWallMove();
			cancelEscape();
			wallLayer.remove();
			if (w) {
				w.remove();
				w = null;
			}
			deselectWall();
		}
	});

	for (const wait of ["waitWallAdded", "waitWallRemoved", "waitWallModified", "waitWallMoved", "waitLayerMove", "waitLayerRemove", "waitLayerShift", "waitLayerShow", "waitLayerHide", "waitLayerLock", "waitLayerUnlock"] as (keyof RPCWaits)[]) {
		(combined as Omit<typeof combined, "images" | "audio" | "characters" | "map">)[wait]().when(gw);
	}
});
