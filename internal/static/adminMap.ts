import type {ID, Token, TokenLight, TokenSet, Uint} from './types.js';
import type {MenuItems} from './lib/menu.js';
import type {Colour} from './colours.js';
import type {SVGFolder, SVGLayer} from './map.js';
import type {SVGDrawing, SVGShape} from './map_tokens.js';
import {add, id} from './lib/css.js';
import {amendNode} from './lib/dom.js';
import {DragTransfer, setDragEffect} from './lib/drag.js';
import {keyEvent, mouseDragEvent, mouseMoveEvent, mouseX, mouseY} from './lib/events.js';
import {button, div, h1, img, input, table, tbody, td, th, thead, tr} from './lib/html.js';
import {Pipe} from './lib/inter.js';
import {item, menu, submenu} from './lib/menu.js';
import {checkInt, mod} from './lib/misc.js';
import {NodeArray, node, noSort} from './lib/nodes.js';
import {rect} from './lib/svg.js';
import {dragImage, dragImageFiles, uploadImages} from './assets.js';
import {dragCharacter, edit as tokenEdit} from './characters.js';
import {makeColourPicker, noColour} from './colours.js';
import {adminHideLight, hiddenLayer, itemControl, layerLight, mapID, selectedLayerID} from './ids.js';
import {registerKeyEvent} from './keys.js';
import lang from './language.js';
import {getLayer, isSVGFolder, isSVGLayer, isTokenImage, layerList, mapData, mapView, panZoom, removeLayer, root, screen2Grid, showSignal} from './map.js';
import {checkSelectedLayer, doLayerAdd, doLayerFolderAdd, doLayerMove, doLayerRename, doLayerShift, doLockUnlockLayer, doMapChange, doMapDataRemove, doMapDataSet, doMaskAdd, doMaskRemove, doMaskSet, doSetLightColour, doShowHideLayer, doTokenAdd, doTokenMoveLayerPos, doTokenRemove, doTokenSet, doTokenSetMulti, doWallAdd, doWallModify, doWallMove, doWallRemove, setLayer, snapTokenToGrid, tokenMousePos, waitAdded, waitFolderAdded, waitFolderRemoved, waitLayerHide, waitLayerLock, waitLayerPositionChange, waitLayerRename, waitLayerShow, waitLayerUnlock, waitRemoved} from './map_fns.js';
import {SQRT3, SVGToken, cursors, deselectToken, outline, outlineRotationClass, selected, tokens, tokenSelected, tokenSelectedReceive} from './map_tokens.js';
import {tokenContext} from './plugins.js';
import {handleError, rpc} from './rpc.js';
import {autosnap, hiddenLayerOpacity, hiddenLayerSelectedOpacity, measureTokenMove} from './settings.js';
import {characterData, cloneObject, getCharacterToken, mapLoadedSend} from './shared.js';
import {lightGrid, lightOnOffStr, remove} from './symbols.js';
import {defaultTool, toolTokenMouseDown, toolTokenMouseOver, toolTokenWheel} from './tools.js';
import {measureDistance, startMeasurement, stopMeasurement} from './tools_measure.js';
import undo from './undo.js';
import {shell, windows} from './windows.js';

export const [mapLoadSend, mapLoadReceive] = new Pipe<Uint>().bind(3),
dragLighting = new DragTransfer<ID & TokenLight>("light"),
selectToken = (newToken: SVGToken | SVGShape | SVGDrawing) => {
	setLayer(tokens.get(newToken.id)!.layer);
	selected.token = newToken;
	amendNode(outline, {"transform": newToken.transformString(false), "style": `--outline-width: ${newToken.width}px; --outline-height: ${newToken.height}px`, "class": outlineRotationClass(newToken.rotation)});
	for (const k of ["x", "y", "rotation", "width", "height"] as const) {
		tokenMousePos[k] = newToken[k];
	}
	tokenSelected();
};

export default (base: HTMLElement) => {
	let copiedToken: Token | null = null,
	    tokenDragMode = -1,
	    lastToken: Token | null = null,
	    mX = 0,
	    mY = 0,
	    moved = false,
	    overOutline = false;

	const makeLayerContext = (fn: (sl: SVGLayer) => void, disabled = "", folder: SVGFolder = layerList): MenuItems => (folder.children as NodeArray<SVGFolder | SVGLayer>).map(e => e.id < 0 ? [] as MenuItems : isSVGFolder(e) ? submenu([item(e.name), menu(makeLayerContext(fn, disabled, e))]) : item(e.name === disabled ? {"disabled": true} : {"onselect": () => fn(e)}, e.name)),
	      [setupTokenDrag, cancelTokenDrag] = mouseDragEvent(0, (e: MouseEvent) => {
		let {x, y, width, height, rotation} = tokenMousePos;
		const [bdx, bdy] = screen2Grid(e.clientX, e.clientY),
		      dx = bdx - tokenMousePos.mouseX,
		      dy = bdy - tokenMousePos.mouseY,
		      sq = mapData.gridSize,
		      selectedToken = selected.token,
		      snap = (selectedToken?.snap ?? false) != e.shiftKey;
		if (!selectedToken) {
			return;
		}
		switch (tokenDragMode) {
		case 0:
			x += dx;
			y += dy;
			if (snap) {
				[x, y] = snapTokenToGrid(x, y, width, height);
			}
			if (measureTokenMove.value) {
				measureDistance(x + (width >> 1), y + (height >> 1));
			}
			break;
		case 1:
			rotation = mod(Math.round(-128 * Math.atan2(panZoom.zoom * (x + width / 2) + panZoom.x - (panZoom.zoom - 1) * mapData.width / 2 - e.clientX, panZoom.zoom * (y + height / 2) + panZoom.y - (panZoom.zoom - 1) * mapData.height / 2 - e.clientY) / Math.PI), 256);
			if (snap) {
				const deg = 256 / (mapData.gridType === 1 || mapData.gridType === 2 ? 12 : 8);
				rotation = Math.round(rotation / deg) * deg % 256;
			}
			amendNode(outline, {"class": outlineRotationClass(rotation)});
			break;
		default: {
			const r = -360 * rotation / 256,
			      {x: aDx, y: aDy} = new DOMPoint(dx, dy).matrixTransform(new DOMMatrix().rotateSelf(r)),
			      fr = new DOMMatrix().translateSelf(x + width / 2, y + height / 2).rotateSelf(-r).translateSelf(-(x + width / 2), -(y + height / 2)),
			      dirX = [2, 5, 7].includes(tokenDragMode) ? -1 : [4, 6, 9].includes(tokenDragMode) ? 1 : 0,
			      dirY = [2, 3, 4].includes(tokenDragMode) ? -1 : [7, 8, 9].includes(tokenDragMode) ? 1 : 0,
			      min = snap ? sq : 10;
			let mDx = aDx * dirX,
			    mDy = aDy * dirY;
			if (dirX !== 0 && mDy < mDx * height / width || dirY === 0) {
				mDy = mDx * height / width;
			} else {
				mDx = mDy * width / height;
			}
			if (dirX !== 0 && width + mDx < min) {
				mDx = min - width;
				mDy = min * height / width - height;
			}
			if (dirY !== 0 && height + mDy < min) {
				mDx = min * width / height - width;
				mDy = min - height;
			}
			mDx *= dirX;
			mDy *= dirY;
			if (snap) {
				mDx = Math.round(mDx / sq) * sq;
				mDy = Math.round(mDy / sq) * sq;
			}
			if (dirX === -1) {
				x += mDx;
				width -= mDx;
			} else if (dirX === 1) {
				width += mDx;
			}
			if (dirY === -1) {
				y += mDy;
				height -= mDy;
			} else if (dirY === 1) {
				height += mDy;
			}
			if (snap) {
				[x, y] = snapTokenToGrid(x, y, width = Math.max(Math.round(width / sq) * sq, sq), height = Math.max(Math.round(height / sq) * sq, sq));
			}
			const {x: cx, y: cy} = new DOMPoint(x + width/2, y + height/2).matrixTransform(fr),
			      {x: nx, y: ny} = new DOMPoint(x, y).matrixTransform(fr).matrixTransform(new DOMMatrix().translateSelf(cx, cy).rotateSelf(r).translateSelf(-cx, -cy));
			x = nx;
			y = ny;
		}}
		selectedToken.x = Math.round(x);
		selectedToken.y = Math.round(y);
		selectedToken.width = Math.round(width);
		selectedToken.height = Math.round(height);
		selectedToken.rotation = Math.round(rotation);
		selectedToken.updateNode();
		amendNode(outline, {"style": {"--outline-width": width + "px", "--outline-height": height + "px"}, "transform": selectedToken.transformString(false)});
	      }, () => {
		if (!selected.token) {
			return;
		}
		amendNode(root, {"style": {"--outline-cursor": undefined}});
		tokenDragMode = -1;
		const {token} = selected,
		      ts: TokenSet = {
			"id": token.id,
			"x": Math.round(token.x),
			"y": Math.round(token.y),
			"rotation": Math.round(token.rotation),
			"width": Math.round(token.width),
			"height": Math.round(token.height)
		      };
		let changed = false;
		for (const k of ["x", "y", "rotation", "width", "height"] as const) {
			if (tokenMousePos[k] !== ts[k]) {
				token[k] = tokenMousePos[k];
				changed = true;
			} else {
				delete ts[k];
			}
		}
		if (changed) {
			doTokenSet(ts);
		}
		stopMeasurement();
	      }),
	      mapOnDragOver = setDragEffect({
		"link": [dragCharacter, dragImage],
		"copy": [dragImageFiles]
	      }),
	      mapOnDrop = (e: DragEvent) => {
		if (!selected.layer) {
			return;
		}
		if (dragImageFiles.is(e)) {
			const [x, y] = screen2Grid(e.clientX, e.clientY),
			      {layer} = selected;
			uploadImages(dragImageFiles.asForm(e, "asset")).then(images => {
				for (const image of images) {
					img({"src": `/images/${image.id}`, "onload": function(this: HTMLImageElement) {
						const {width, height} = this;
						if (selected.layer === layer && width > 0 && height > 0) {
							const token = {"id": 0, "src": image.id, x, y, width, height, "patternWidth": 0, "patternHeight": 0, "stroke": noColour, "strokeWidth": 0, "rotation": 0, "flip": false, "flop": false, "tokenData": {}, "tokenType": 0, "snap": autosnap.value, "lightColours": [], "lightStages": [], "lightTimings": []};
							if (token.snap) {
								[token.x, token.y] = snapTokenToGrid(token.x, token.y, token.width, token.height);
							}
							doTokenAdd(layer.path, token);
						}
					}});
				}
			}).catch(handleError);
			return;
		}
		const token = {"id": 0, "src": 0, "x": 0, "y": 0, "width": 0, "height": 0, "patternWidth": 0, "patternHeight": 0, "stroke": noColour, "strokeWidth": 0, "rotation": 0, "flip": false, "flop": false, "tokenData": {}, "tokenType": 0, "snap": autosnap.value, "lightColours": [], "lightStages": [], "lightTimings": []};
		if (dragCharacter.is(e)) {
			const {id, width, height} = dragCharacter.get(e),
			      char = characterData.get(id);
			if (char) {
				Object.assign(token, getCharacterToken(char) ?? {"src": parseInt(char["store-image-icon"].data), width, height});
			}
		} else if (dragImage.is(e)) {
			const {id, width, height} = dragImage.get(e);
			token.src = id;
			token.width = width;
			token.height = height;
		} else {
			return;
		}
		[token.x, token.y] = screen2Grid(e.clientX, e.clientY);
		if (token.snap) {
			[token.x, token.y] = snapTokenToGrid(token.x, token.y, token.width, token.height);
		}
		doTokenAdd(selected.layer.path, token);
	      },
	      allTokens = function* (folder: SVGFolder = layerList): Iterable<SVGToken | SVGShape | SVGDrawing> {
		for (const e of (folder.children as (SVGFolder | SVGLayer)[])) {
			yield* e.locked ? [] : isSVGLayer(e) ? e.tokens : allTokens(e);
		}
	      },
	      pasteCoords = [0, 0],
	      mapMove = (e: MouseEvent) => {
		moved = true;
		amendNode(root, {"style": {"left": (panZoom.x += e.clientX - mX) + "px", "top": (panZoom.y += e.clientY - mY) + "px"}});
		mX = e.clientX;
		mY = e.clientY;
	      },
	      [startMouseDrag0] = mouseDragEvent(0, mapMove, (e: MouseEvent) => {
		if (!moved && !e.ctrlKey) {
			deselectToken();
			updateCursor(e);
		}
		amendNode(root, {"style": {"--outline-cursor": undefined}});
	      }),
	      [startMouseDrag1] = mouseDragEvent(1, mapMove, () => amendNode(root, {"style": {"--outline-cursor": undefined}})),
	      moveMap = (e: MouseEvent, initFn: () => void) => {
		amendNode(root, {"style": {"--outline-cursor": "grabbing"}});
		mX = e.clientX;
		mY = e.clientY;
		moved = false;
		initFn();
		return false;
	      },
	      keyRepeats = [-1, -1, -1, -1],
	      keyMoveToken = (n: Uint, dir: string, shift: (tk: Token, dx: Uint, dy: Uint, shiftKey?: boolean) => void) => keyEvent([`Arrow${dir}`, `Shift+Arrow${dir}`], (e: KeyboardEvent) => {
		const {token} = selected;
		if (token && !token.snap) {
			keyRepeats[n] = setInterval(() => {
				shift(token, 1, 1, e.shiftKey);
				token.x = Math.min(Math.max(0, token.x), mapData.width - token.width);
				token.y = Math.min(Math.max(0, token.y), mapData.height - token.height);
				token.updateNode();
				amendNode(outline, {"transform": token.transformString(false)});
			}, 5);
		}
	      }, (e: KeyboardEvent) => {
		if (keyRepeats[n] !== -1) {
			clearInterval(keyRepeats[n]);
			keyRepeats[n] = -1;
			if (lastToken && keyRepeats.every(d => d === -1)) {
				const {id, x, y, rotation} = lastToken;
				lastToken.x = tokenMousePos.x;
				lastToken.y = tokenMousePos.y;
				lastToken.rotation = tokenMousePos.rotation;
				doTokenSet({id, x, y, rotation});
			}
		} else {
			const {gridSize, gridType, width, height} = mapData,
			      {token} = selected;
			if (e.isTrusted && token) {
				shift(token, gridType === 1 ? Math.round(1.5 * gridSize / SQRT3) : gridType === 2 ? gridSize >> 1 : gridSize, gridType === 2 ? Math.round(1.5 * gridSize / SQRT3) : gridType === 1 ? gridSize >> 1 : gridSize, e.shiftKey);
				token.x = Math.min(Math.max(0, token.x), width - token.width);
				token.y = Math.min(Math.max(0, token.y), height - token.height);
				if (lastToken) {
					const {id, x, y, rotation} = lastToken;
					lastToken.x = tokenMousePos.x;
					lastToken.y = tokenMousePos.y;
					lastToken.rotation = tokenMousePos.rotation;
					doTokenSet({id, x, y, rotation});
				}
			}
		}
	      }),
	      doTokenRotation = (tk: Token, dir = 1) => tk.rotation = mod(tk.snap ? Math.round(tk.rotation + dir * 256 / (mapData.gridType === 0 ? 8 : 12)) : tk.rotation + dir, 256),
	      updateCursor = ({target, clientX, clientY, ctrlKey}: {target: EventTarget | null, clientX: number, clientY: number, ctrlKey: boolean}) => amendNode(document.body, {"style": {"--outline-cursor": !ctrlKey && (overOutline = (target as HTMLElement)?.parentNode === outline) ? undefined : !ctrlKey && (selected.layer?.tokens as SVGToken[])?.some(t => t.at(clientX, clientY)) ? "pointer" : "grab"}}),
	      psuedoUpdateCursor = (target: EventTarget | null, ctrlKey: boolean) => updateCursor({target, "clientX": mouseX, "clientY": mouseY, ctrlKey}),
	      [startMapMouseMove, cancelMapMouseMove] = mouseMoveEvent(updateCursor),
	      ctrlOverride = (e: KeyboardEvent) => psuedoUpdateCursor(overOutline ? outline.firstChild : null, e.ctrlKey),
	      [startControlOverride, cancelControlOverride] = keyEvent("Control", ctrlOverride, ctrlOverride),
	      keys = [
		keyEvent("Ctrl+c", () => copiedToken = cloneObject(selected.token)),
		keyEvent("Ctrl+x", () => doTokenRemove((copiedToken = cloneObject(selected.token!)).id)),
		keyEvent("Escape", (e: KeyboardEvent) => {
			if (tokenDragMode == -1) {
				deselectToken();
				psuedoUpdateCursor(root, e.ctrlKey);
				return;
			}
			amendNode(root, {"style": {"--outline-cursor": undefined}});
			tokenDragMode = -1;
			const {token} = selected,
			      {x, y, width, height, rotation} = tokenMousePos;
			if (token) {
				token.x = x;
				token.y = y;
				token.width = width;
				token.rotation = rotation;
				token.height = height;
				token.updateNode();
				amendNode(outline, {"style": {"--outline-width": width + "px", "--outline-height": height + "px"}, "class": outlineRotationClass(rotation), "transform": token.transformString(false)});
			}
			stopMeasurement();
			cancelTokenDrag();
		}),
		keyEvent("Delete", () => doTokenRemove(selected.token!.id)),
		registerKeyEvent("tokenEdit", lang["CONTEXT_EDIT_TOKEN"], '', () => {
			const {token} = selected;
			if (token instanceof SVGToken && tokens.has(token.id)) {
				tokenEdit(token.id, lang["CONTEXT_EDIT_TOKEN"], token.tokenData, false);
			}
		}),
		...([
			["Up", (tk: Token, dy: Uint) => tk.y -= dy],
			["Down", (tk: Token, dy: Uint) => tk.y += dy],
			["Left", (tk: Token, _: Uint, dx: Uint, shift = false) => shift ? doTokenRotation(tk, -1) : tk.x -= dx],
			["Right", (tk: Token, _: Uint, dx: Uint, shift = false) => shift ? doTokenRotation(tk) : tk.x += dx]
		] as const).map(([dir, fn], n) => keyMoveToken(n, dir, fn))
	      ],
	      dragLightingOver = setDragEffect({"copy": [dragLighting]}),
	      cycleTokens = (e: KeyboardEvent) => {
		const {layer, token} = selected;
		if (layer) {
			const pos = layer.tokens.findIndex(t => t === token),
			      next = layer.tokens.at(e.shiftKey ? (pos + 1) % layer.tokens.length : pos < 0 ? -1 : pos - 1) as SVGToken | SVGDrawing | SVGShape | undefined;
			if (next && next !== token) {
				selectToken(next);
			}
			e.preventDefault();
		}
	      },
	      [startCycleTokensForwards, stopCycleTokensForwards] = registerKeyEvent("nextToken", lang["TOKEN_NEXT"], "Tab", cycleTokens),
	      [startCycleTokensBackwards, stopCycleTokensBackwards] = registerKeyEvent("prevToken", lang["TOKEN_PREV"], "Shift+Tab", cycleTokens),
	      outlineID = id();
	add({
		[`#${mapID}`]: {
			"cursor": "var(--outline-cursor)",
			"overflow": "visible"
		},
		[`#${outlineID}`]: {
			"outline": "none",
			"clip-path": "initial !important",
			" rect": {
				"stroke-width": "calc(1px / var(--zoom, 1))",
				"stroke": "#000",
				"width": "calc(10px / var(--zoom, 1))",
				"height": "calc(10px / var(--zoom, 1))",
				"fill": "#f00",
				":nth-child(1)": {
					"width": "var(--outline-width)",
					"height": "var(--outline-height)",
					"fill": "transparent",
					"cursor": "var(--outline-cursor, move)"
				},
				":nth-child(2)": {
					"x": "calc(var(--outline-width) / 2 - 5px / var(--zoom, 1))",
					"y": "calc(-20px / var(--zoom, 1))",
					"cursor": "var(--outline-cursor, cell)"
				},
				":nth-child(3)": {
					"x": "calc(-5px / var(--zoom, 1))",
					"y": "calc(-5px / var(--zoom, 1))"
				},
				":nth-child(4)": {
					"x": "calc(var(--outline-width) / 2 - 5px / var(--zoom, 1))",
					"y": "calc(-5px / var(--zoom, 1))"
				},
				":nth-child(5)": {
					"x": "calc(var(--outline-width) - 5px / var(--zoom, 1))",
					"y": "calc(-5px / var(--zoom, 1))"
				},
				":nth-child(6)": {
					"x": "calc(-5px / var(--zoom, 1))",
					"y": "calc(var(--outline-height) / 2 - 5px / var(--zoom, 1))"
				},
				":nth-child(7)": {
					"x": "calc(var(--outline-width) - 5px / var(--zoom, 1))",
					"y": "calc(var(--outline-height) / 2 - 5px / var(--zoom, 1))"
				},
				":nth-child(8)": {
					"x": "calc(-5px / var(--zoom, 1))",
					"y": "calc(var(--outline-height) - 5px / var(--zoom, 1))"
				},
				":nth-child(9)": {
					"x": "calc(var(--outline-width) / 2 - 5px / var(--zoom, 1))",
					"y": "calc(var(--outline-height) - 5px / var(--zoom, 1))"
				},
				":nth-child(10)": {
					"x": "calc(var(--outline-width) - 5px / var(--zoom, 1))",
					"y": "calc(var(--outline-height) - 5px / var(--zoom, 1))"
				}
			}
		},
		[`.${cursors[0]} :is(rect:nth-child(3), rect:nth-child(10)), .${cursors[1]} :is(rect:nth-child(6), rect:nth-child(7)), .${cursors[2]} :is(rect:nth-child(5), rect:nth-child(8)), .${cursors[3]} :is(rect:nth-child(4), rect:nth-child(9))`]: {
			"cursor": "var(--outline-cursor, nwse-resize)"
		},
		[`.${cursors[0]} :is(rect:nth-child(4), rect:nth-child(9)), .${cursors[1]} :is(rect:nth-child(3), rect:nth-child(10)), .${cursors[2]} :is(rect:nth-child(6), rect:nth-child(7)), .${cursors[3]} :is(rect:nth-child(5), rect:nth-child(8))`]: {
			"cursor": "var(--outline-cursor, ns-resize)"
		},
		[`.${cursors[0]} :is(rect:nth-child(5), rect:nth-child(8)), .${cursors[1]} :is(rect:nth-child(4), rect:nth-child(9)), .${cursors[2]} :is(rect:nth-child(3), rect:nth-child(10)), .${cursors[3]} :is(rect:nth-child(6), rect:nth-child(7))`]: {
			"cursor": "var(--outline-cursor, nesw-resize)"
		},
		[`.${cursors[0]} :is(rect:nth-child(6), rect:nth-child(7)), .${cursors[1]} :is(rect:nth-child(5), rect:nth-child(8)), .${cursors[2]} :is(rect:nth-child(4), rect:nth-child(9)), .${cursors[3]} :is(rect:nth-child(3), rect:nth-child(10))`]: {
			"cursor": "var(--outline-cursor, ew-resize)"
		},
		[`.${hiddenLayer}`]: {
			"opacity": "var(--hiddenLayerOpacity, 0.5)",
			[`.${selectedLayerID}`]: {
				"opacity": "var(--hiddenLayerSelectedOpacity, 0.5)"
			}
		},
		[`.${adminHideLight} #${layerLight}`]: {
			"display": "none"
		}
	});
	amendNode(outline, {"id": outlineID, "style": "display: none", "onwheel": toolTokenWheel}, Array.from({length: 10}, (_, n) => rect({"onmouseover": toolTokenMouseOver, "onmousedown": function(this: SVGRectElement, e: MouseEvent) { toolTokenMouseDown.call(this, e, n); }}))),
	tokenSelectedReceive(() => {
		if (selected.token) {
			for (const [fn] of keys) {
				fn();
			}
		} else {
			for (const [, fn] of keys) {
				fn();
			}
		}
		lastToken = selected.token;
	});
	keyEvent("Ctrl+z", undo.undo)[0]();
	keyEvent(["Ctrl+r", "Ctrl+y", "Ctrl+Shift+Z"], undo.redo)[0]();
	keyEvent("Ctrl+v", () => {
		if (copiedToken && selected.layer) {
			const {snap, width, height} = copiedToken,
			      [x, y] = snap ? snapTokenToGrid(pasteCoords[0] - (width >> 1), pasteCoords[1] - (height >> 1), width, height) : [pasteCoords[0] - (width >> 1), pasteCoords[1] - (height >> 1)],
			      tk: Token = Object.assign(cloneObject(copiedToken), {"id": 0, "x": Math.min(Math.max(0, x), mapData.width - width), "y": Math.min(Math.max(0, y), mapData.height - height)});
			doTokenAdd(selected.layer.path, tk);
		}
	})[0]();
	mapLoadReceive(mapID => rpc.getMapData(mapID).then(mapData => {
		deselectToken();
		selected.layer = null;
		const oldBase = base;
		oldBase.replaceWith(base = mapView(mapData));
		amendNode(root, {"ondragover": mapOnDragOver, "ondrop": mapOnDrop}, amendNode(outline, {"style": "display: none"}));
		pasteCoords[0] = 0;
		pasteCoords[1] = 0;
		mapLoadedSend(true);
	}));
	defaultTool.mapMouse0 = function (this: SVGElement, e: MouseEvent) {
		[pasteCoords[0], pasteCoords[1]] = screen2Grid(e.clientX, e.clientY);
		const {layer} = selected;
		if ((!e.ctrlKey || e.shiftKey)) {
			let newToken: SVGToken | SVGShape | SVGDrawing | null = null;
			for (const t of (e.ctrlKey ? allTokens() : layer?.tokens ?? []) as Iterable<SVGToken | SVGShape | SVGDrawing>) {
				if (t.at(e.clientX, e.clientY)) {
					newToken = t;
				}
			}
			if (newToken) {
				selectToken(newToken);
				psuedoUpdateCursor(outline.firstChild, e.ctrlKey);
				return false;
			}
		}
		if (!e.ctrlKey && (document.body.style.getPropertyValue("--outline-cursor") === "pointer" || e.target && (e.target as ChildNode).parentNode === outline)) {
			return false;
		}
		return moveMap(e, startMouseDrag0);
	}
	defaultTool.mapMouse1 = (e: MouseEvent) => moveMap(e, startMouseDrag1);
	defaultTool.mapMouseOver = () => {
		startMapMouseMove();
		startControlOverride();
		return false;
	};
	defaultTool.tokenMouse0 = (e: MouseEvent, n: Uint) => {
		if ((!e.ctrlKey || e.shiftKey) && selected.token) {
			e.stopPropagation();
			if (n === 0 && e.shiftKey) {
				const {layer, token} = selected;
				if (layer) {
					let newToken: SVGToken | SVGShape | SVGDrawing | null = null;
					for (const tk of (e.ctrlKey ? allTokens() : layer.tokens) as Iterable<SVGToken | SVGShape | SVGDrawing>) {
						if (tk === token) {
							if (newToken)  {
								break;
							}
						} else if (tk.at(e.clientX, e.clientY)) {
							newToken = tk;
						}
					}
					if (newToken) {
						selectToken(newToken);
					}
				}
			} else {
				setupTokenDrag();
				tokenDragMode = n;
				amendNode(root, {"style": {"--outline-cursor": ["move", "cell", "nwse-resize", "ns-resize", "nesw-resize", "ew-resize"][tokenDragMode < 2 ? tokenDragMode : (3.5 - Math.abs(5.5 - tokenDragMode) + ((selected.token.rotation + 143) >> 5)) % 4 + 2]}});
				[tokenMousePos.mouseX, tokenMousePos.mouseY] = screen2Grid(e.clientX, e.clientY);
				if (n === 0 && measureTokenMove.value) {
					const {token} = selected;
					startMeasurement(token.x + (token.width >> 1), token.y + (token.height >> 1));
				}
			}
		}
		return false;
	};
	defaultTool.tokenMouse2 = (e: MouseEvent) => {
		e.stopPropagation();
		const {layer: currLayer, token: currToken} = selected;
		if (currLayer && currToken) {
			const tokenPos = currLayer.tokens.findIndex(t => t === currToken);
			amendNode(document.body, menu({"x": e.clientX, "y": e.clientY}, [
				tokenContext(),
				isTokenImage(currToken) ? [
					item({"onselect": () => currToken instanceof SVGToken && tokens.has(currToken.id) && tokenEdit(currToken.id, lang["CONTEXT_EDIT_TOKEN"], currToken.tokenData, false)}, lang["CONTEXT_EDIT_TOKEN"]),
					item({"onselect": () => {
						if (currToken instanceof SVGToken && tokens.has(currToken.id)) {
							doTokenSet({"id": currToken.id, "flip": !currToken.flip});
						}
					}}, lang["CONTEXT_FLIP"]),
					item({"onselect": () => {
						if (currToken instanceof SVGToken && tokens.has(currToken.id)) {
							doTokenSet({"id": currToken.id, "flop": !currToken.flop});
						}
					}}, lang["CONTEXT_FLOP"]),
					item({"onselect": () => {
						if (currToken instanceof SVGToken && tokens.has(currToken.id)) {
							if (!currToken.isPattern) {
								doTokenSet({"id": currToken.id, "patternWidth": currToken.width, "patternHeight": currToken.height});
							} else {
								doTokenSet({"id": currToken.id, "patternWidth": 0, "patternHeight": 0});
							}
						}
					}}, currToken.isPattern ? lang["CONTEXT_SET_IMAGE"] : lang["CONTEXT_SET_PATTERN"])
				] : [],
				item({"onselect": () => {
					const snap = currToken.snap,
					      {x, y, width, height, rotation} = currToken;
					if (tokens.has(currToken.id)) {
						if (!snap) {
							const [newX, newY] = snapTokenToGrid(x, y, width, height),
							      newRotation = Math.round(rotation / 32) * 32 % 256;
							doTokenSet({"id": currToken.id, "x": newX, "y": newY, "rotation": newRotation, "snap": !snap});
						} else {
							doTokenSet({"id": currToken.id, "snap": !snap});
						}
					}
				}}, currToken.snap ? lang["CONTEXT_UNSNAP"] : lang["CONTEXT_SNAP"]),
				item({"onselect": () => {
					if (tokens.has(currToken.id)) {
						type Timing = {
							[node]: HTMLTableCellElement;
							value: Uint;
						}
						type Stage = {
							[node]: HTMLTableRowElement;
							value: Uint;
							colours: NodeArray<ColourCell>;
						}
						type ColourCell = {
							[node]: HTMLTableCellElement;
							value: Colour;
						}
						const {lightColours, lightStages, lightTimings} = currToken,
						      makeChange = () => ({"id": currToken.id, "lightColours": stages.map(s => s.colours.map(c => c.value)), "lightStages": stages.map(s => s.value), "lightTimings": timings.map(t => t.value)}),
						      dragKey = dragLighting.register(makeChange),
						      lColours = cloneObject(lightColours),
						      lStages = lightStages.length ? cloneObject(lightStages) : [0],
						      lTimings = lightTimings.length ? cloneObject(lightTimings) : [0],
						      w = windows({"window-icon": lightOnOffStr, "window-title": lang["CONTEXT_SET_LIGHTING"], "resizable": true, "style": "--window-width: 50%; --window-height: 50%"}),
						      timingHeader = th({"colspan": lTimings.length}, lang["LIGHTING_TIMING"]),
						      stagesHeader = th({"rowspan": lStages.length + 1, "style": "min-width:1em; writing-mode: vertical-rl; transform: scale(-1, -1)"}, lang["LIGHTING_STAGES"]),
						      addTiming = (t = 0) => {
							const o = {
								[node]: th([
									input({"type": "number", "value": t, "onchange": function(this: HTMLInputElement) {
										o.value = checkInt(parseInt(this.value), 0);
									}}),
									remove({"title": lang["LIGHTING_REMOVE_TIMING"], "class": itemControl, "onclick": () => {
										const pos = timings.findIndex(t => Object.is(t, o));
										timings.splice(pos, 1);
										lTimings.pop();
										for (const s of stages) {
											s.colours.splice(pos, 1);
										}
										amendNode(timingHeader, {"colspan": timings.length});
									}})
								]),
								value: t
							      };
							return o;
						      },
						      addColour = (n = -1, m = -1) => {
							const o: ColourCell = {
								[node]: td(),
								value: lColours[n]?.[m] ?? noColour
							      };
							amendNode(o[node], makeColourPicker(w, lang["LIGHTING_SET_COLOUR"], () => o.value, c => o.value = c));
							return o;
						      },
						      addStage = (s = 0, n = -1) => {
							const p = tr(td([
								input({"type": "number", "value": s, "onchange": function(this: HTMLInputElement) {
									o.value = checkInt(parseInt(this.value), 0);
								}}),
								remove({"title": lang["LIGHTING_REMOVE_STAGE"], "class": itemControl, "onclick": () => {
									stages.filterRemove(t => t === o);
									amendNode(stagesHeader, {"rowspan": stages.length + 1});
								}})
							      ])),
							      o = {
								[node]: p,
								value: s,
								colours: new NodeArray<ColourCell>(p, noSort, lTimings.map((_, m) => addColour(n, m)))
							      };
							return o;
						      },
						      timings = new NodeArray<Timing>(amendNode(tr(), td({"colspan": 2})), noSort, lTimings.map(addTiming)),
						      stages = new NodeArray<Stage, HTMLTableSectionElement>(tbody(tr(stagesHeader)), noSort, lStages.map(addStage));
						amendNode(shell, amendNode(w, {"onremove": () => dragLighting.deregister(dragKey), "ondragover": dragLightingOver, "ondrop": (e: DragEvent) => {
							if (dragLighting.is(e)) {
								const {id, lightColours, lightStages, lightTimings} = dragLighting.get(e);
								if (id !== currToken.id) {
									lColours.splice(0, lColours.length, ...lightColours);
									lStages.splice(0, lStages.length, ...lightStages);
									lTimings.splice(0, lTimings.length, ...lightTimings);
									timings.splice(0, timings.length, ...lightTimings.map(addTiming));
									stages.splice(0, stages.length, ...lightStages.map(addStage));
									amendNode(timingHeader, {"colspan": timings.length});
									amendNode(stagesHeader, {"rowspan": stages.length + 1});
								}
							}
						}}, [
							h1([
								div({"draggable": "true", "style": "display: inline-block; cursor: grab", "ondragstart": (e: DragEvent) => dragLighting.set(e, dragKey)}, lightGrid({"title": lang["LIGHTING_DRAG"], "width": "1em", "height": "1em"})),
								lang["CONTEXT_SET_LIGHTING"]
							]),
							button({"onclick": () => amendNode(stagesHeader, {"rowspan": stages.push(addStage()) + 1})}, lang["LIGHTING_ADD_STAGE"]),
							button({"onclick": () => {
								amendNode(timingHeader, {"colspan": timings.push(addTiming())});
								lTimings.push(0);
								for (const s of stages) {
									s.colours.push(addColour());
								}
							}}, lang["LIGHTING_ADD_TIMING"]),
							table([
								thead([
									tr([
										td({"colspan": 2}),
										timingHeader
									]),
									timings[node]
								]),
								stages[node]
							]),
							button({"onclick": () => {
								if (tokens.has(currToken.id)) {
									doTokenSet(makeChange());
								}
								w.close();
							}}, lang["SAVE"])
						]));
					}
				}}, lang["CONTEXT_SET_LIGHTING"]),
				tokenPos < currLayer.tokens.length - 1 ? [
					item({"onselect": () => {
						const currLayer = tokens.get(currToken.id)?.layer;
						if (currLayer && tokens.has(currToken.id)) {
							doTokenMoveLayerPos(currToken.id, currLayer.path, currLayer.tokens.length - 1);
						}
					}}, lang["CONTEXT_MOVE_TOP"]),
					item({"onselect": () => {
						const currLayer = tokens.get(currToken.id)?.layer;
						if (currLayer && tokens.has(currToken.id)) {
							doTokenMoveLayerPos(currToken.id, currLayer.path, currLayer.tokens.findIndex(t => t === currToken) + 1);
						}
					}}, lang["CONTEXT_MOVE_UP"])
				] : [],
				tokenPos > 0 ? [
					item({"onselect": () => {
						const currLayer = tokens.get(currToken.id)?.layer;
						if (currLayer && tokens.has(currToken.id)) {
							doTokenMoveLayerPos(currToken.id, currLayer.path, currLayer.tokens.findIndex(t => t === currToken) - 1);
						}
					}}, lang["CONTEXT_MOVE_DOWN"]),
					item({"onselect": () => {
						const currLayer = tokens.get(currToken.id)?.layer;
						if (currLayer && tokens.has(currToken.id)) {
							doTokenMoveLayerPos(currToken.id, currLayer.path, 0);
						}
					}}, lang["CONTEXT_MOVE_BOTTOM"])
				] : [],
				submenu([
					item(lang["CONTEXT_MOVE_LAYER"]),
					menu(makeLayerContext((sl: SVGLayer) => {
						if (tokens.has(currToken.id)) {
							doTokenMoveLayerPos(currToken.id, sl.path, sl.tokens.length);
						}
					}, currLayer.name))
				]),
				item({"onselect": () => doTokenRemove(currToken.id)}, lang["CONTEXT_DELETE"])
			]));
		}
		return false;
	};
	defaultTool.mapMouse2 = (e: MouseEvent) => {
		const pos = screen2Grid(e.clientX, e.clientY);
		showSignal(pos);
		if (e.ctrlKey) {
			if (e.altKey) {
				rpc.setMapStart(pos);
				[mapData.startX, mapData.startY] = pos;
			}
			rpc.signalMovePosition(pos);
		} else {
			rpc.signalPosition(pos);
		}
		return false;
	};
	defaultTool.set = () => {
		startCycleTokensForwards();
		startCycleTokensBackwards();
	}
	defaultTool.unset = () => {
		stopCycleTokensForwards();
		stopCycleTokensBackwards();
		cancelMapMouseMove();
		cancelControlOverride();
		amendNode(document.body, {"style": {"--outline-cursor": undefined}});
	};
	rpc.waitMapChange().when(d => doMapChange(d, false));
	rpc.waitMapLightChange().when(c => doSetLightColour(c, false));
	rpc.waitLayerShow().when(path => waitLayerShow[1](doShowHideLayer(path, true, false)));
	rpc.waitLayerHide().when(path => waitLayerHide[1](doShowHideLayer(path, false, false)));
	rpc.waitLayerShow().when(path => waitLayerLock[1](doLockUnlockLayer(path, true, false)));
	rpc.waitLayerHide().when(path => waitLayerUnlock[1](doLockUnlockLayer(path, false, false)));
	rpc.waitLayerAdd().when(name => waitAdded[1]([{id: 1, "name": doLayerAdd(name, false)}]));
	rpc.waitLayerFolderAdd().when(path => waitFolderAdded[1](doLayerFolderAdd(path, false)));
	rpc.waitLayerMove().when(({from, to, position}) => {
		doLayerMove(from, to, position, false);
		waitLayerPositionChange[1]({from, to, position});
	});
	rpc.waitLayerRename().when(lr => {
		doLayerRename(lr["path"], lr["name"], false);
		waitLayerRename[1](lr);
	});
	rpc.waitLayerRemove().when(path => {
		checkSelectedLayer(path);
		const layer = getLayer(path);
		if (!layer) {
			handleError("Invalid layer remove");
			return;
		}
		(isSVGFolder(layer) ? waitFolderRemoved : waitRemoved)[1](path);
		removeLayer(path);
		undo.clear();
	});
	rpc.waitTokenAdd().when(({path, token}) => doTokenAdd(path, token, false)(token.id));
	rpc.waitTokenMoveLayerPos().when(({id, to, newPos}) => doTokenMoveLayerPos(id, to, newPos, false));
	rpc.waitTokenSet().when(t => doTokenSet(t, false));
	rpc.waitTokenSetMulti().when(t => doTokenSetMulti(t, false));
	rpc.waitTokenRemove().when(tid => doTokenRemove(tid, false));
	rpc.waitLayerShift().when(({path, dx, dy}) => doLayerShift(path, dx, dy, false));
	rpc.waitWallAdded().when(w => doWallAdd(w, false));
	rpc.waitWallRemoved().when(wid => doWallRemove(wid, false));
	rpc.waitWallModified().when(w => doWallModify(w, false));
	rpc.waitWallMoved().when(({id, path}) => doWallMove(id, path, false));
	rpc.waitMapDataSet().when(({key, data}) => {
		if (key) {
			doMapDataSet(key, data, false);
		}
	});
	rpc.waitMapDataRemove().when(key => doMapDataRemove(key, false));
	rpc.waitMaskAdd().when(m => doMaskAdd(m, false));
	rpc.waitMaskRemove().when(i => doMaskRemove(i, false));
	rpc.waitMaskSet().when(ms => doMaskSet(ms, false));
	hiddenLayerOpacity.wait(v => amendNode(document.body, {"style": {"--hiddenLayerOpacity": Math.max(Math.min(v, 255), 0) / 255}}));
	hiddenLayerSelectedOpacity.wait(v => amendNode(document.body, {"style": {"--hiddenLayerSelectedOpacity": Math.max(Math.min(v, 255), 0) / 255}}));
};
