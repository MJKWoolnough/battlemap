import type {TokenSet, Token, Uint} from './types.js';
import type {NodeArray} from './lib/nodes.js';
import type {SVGLayer, SVGFolder} from './map.js';
import {autoFocus, createDocumentFragment} from './lib/dom.js';
import {createHTML, br, button, h1, img, input} from './lib/html.js';
import {createSVG, rect} from './lib/svg.js';
import place, {item, menu, List} from './lib/context.js';
import {edit as tokenEdit} from './characters.js';
import {tokenContext} from './plugins.js';
import {SVGToken, SVGShape, SVGDrawing, getLayer, isSVGFolder, isSVGLayer, isTokenImage, removeLayer, mapView, panZoom, screen2Grid, showSignal} from './map.js';
import {checkSelectedLayer, doMapChange, doSetLightColour, doShowHideLayer, doLayerAdd, doLayerFolderAdd, doLayerMove, doLayerRename, doTokenAdd, doTokenMoveLayerPos, doTokenSet, doTokenRemove, doLayerShift, doLightShift, doMaskAdd, doMaskRemove, doMaskSet, doWallAdd, doWallRemove, doTokenLightChange, doMapDataSet, doMapDataRemove, setLayer, snapTokenToGrid, tokenMousePos, waitAdded, waitRemoved, waitFolderAdded, waitFolderRemoved, waitLayerShow, waitLayerHide, waitLayerPositionChange, waitLayerRename} from './map_fns.js';
import {autosnap, measureTokenMove} from './settings.js';
import undo from './undo.js';
import {defaultTool, toolTokenMouseDown, toolTokenWheel, toolTokenMouseOver} from './tools.js';
import {startMeasurement, measureDistance, stopMeasurement} from './tools_measure.js';
import {characterData, checkInt, deselectToken, getCharacterToken, globals, labels, mapLoadReceive, mapLoadedSend, mod, tokenSelected, SQRT3} from './shared.js';
import {makeColourPicker, noColour} from './colours.js';
import {windows, shell} from './windows.js';
import {uploadImages} from './assets.js';
import {keyEvent, mouseDragEvent} from './events.js';
import {rpc, handleError} from './rpc.js';
import lang from './language.js';

let copiedToken: Token | null = null;

export default (base: HTMLElement) => {
	let tokenDragMode = -1,
	    overToken = false;
	const makeLayerContext = (folder: SVGFolder, fn: (sl: SVGLayer) => void, disabled = ""): List => (folder.children as NodeArray<SVGFolder | SVGLayer>).map(e => e.id < 0 ? [] : isSVGFolder(e) ? menu(e.name, makeLayerContext(e, fn, disabled)) : item(e.name, () => fn(e), {"disabled": e.name === disabled})),
	      [setupTokenDrag, cancelTokenDrag] = mouseDragEvent(0, (e: MouseEvent) => {
		let {x, y, width, height, rotation} = tokenMousePos;
		const [bdx, bdy] = screen2Grid(e.clientX, e.clientY),
		      dx = bdx - tokenMousePos.mouseX,
		      dy = bdy - tokenMousePos.mouseY,
		      mapData = globals.mapData,
		      sq = mapData.gridSize,
		      {token: selectedToken} = globals.selected;
		if (!selectedToken) {
			return;
		}
		switch (tokenDragMode) {
		case 0:
			x += dx;
			y += dy;
			if (selectedToken.snap) {
				[x, y] = snapTokenToGrid(x, y, width, height);
			}
			if (measureTokenMove.value) {
				measureDistance(x + (width >> 1), y + (height >> 1));
			}
			break;
		case 1: {
			rotation = mod(Math.round(-128 * Math.atan2(panZoom.zoom * (x + width / 2) + panZoom.x - (panZoom.zoom - 1) * mapData.width / 2 - e.clientX, panZoom.zoom * (y + height / 2) + panZoom.y - (panZoom.zoom - 1) * mapData.height / 2 - e.clientY) / Math.PI), 256);
			if (selectedToken.snap) {
				const deg = 256 / (mapData.gridType === 1 || mapData.gridType === 2 ? 12 : 8);
				rotation = Math.round(rotation / deg) * deg % 256;
			}
			globals.outline.setAttribute("class", `cursor_${((rotation + 143) >> 5) % 4}`);
		}
		break;
		default: {
			const r = -360 * rotation / 256,
			      {x: aDx, y: aDy} = new DOMPoint(dx, dy).matrixTransform(new DOMMatrix().rotateSelf(r)),
			      fr = new DOMMatrix().translateSelf(x + width / 2, y + height / 2).rotateSelf(-r).translateSelf(-(x + width / 2), -(y + height / 2)),
			      dirX = [2, 5, 7].includes(tokenDragMode) ? -1 : [4, 6, 9].includes(tokenDragMode) ? 1 : 0,
			      dirY = [2, 3, 4].includes(tokenDragMode) ? -1 : [7, 8, 9].includes(tokenDragMode) ? 1 : 0,
			      min = selectedToken.snap ? sq : 10;
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
			if (selectedToken.snap) {
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
			if (selectedToken.snap) {
				width = Math.max(Math.round(width / sq) * sq, sq);
				height = Math.max(Math.round(height / sq) * sq, sq);
				[x, y] = snapTokenToGrid(x, y, width, height);
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
		createSVG(globals.outline, {"style": {"--outline-width": width + "px", "--outline-height": height + "px"}, "transform": selectedToken.transformString(false)});
	      }, () => {
		if (!globals.selected.token || !globals.selected.layer) {
			return;
		}
		globals.root.style.removeProperty("--outline-cursor");
		tokenDragMode = -1;
		const {token} = globals.selected,
		      {x, y, width, height, rotation} = tokenMousePos,
		      newX = Math.round(token.x),
		      newY = Math.round(token.y),
		      newRotation = Math.round(token.rotation),
		      newWidth = Math.round(token.width),
		      newHeight = Math.round(token.height),
		      ts: TokenSet = {"id": token.id};
		let changed = false;
		if (newX !== x) {
			token.x = x;
			ts.x = newX;
			changed = true;
		}
		if (newY !== y) {
			token.y = y;
			ts.y = newY;
			changed = true;
		}
		if (newWidth !== width) {
			token.width = width;
			ts.width = newWidth;
			changed = true;
		}
		if (newHeight !== height) {
			token.height = height;
			ts.height = newHeight;
			changed = true;
		}
		if (newRotation !== rotation) {
			token.rotation = rotation;
			ts.rotation = newRotation;
			changed = true;
		}
		if (changed) {
			doTokenSet(ts);
		}
		stopMeasurement();
	      }),
	      outline = createSVG(globals.outline, {"id": "outline", "tabindex": -1, "style": "display: none", "onkeyup": (e: KeyboardEvent) => {
		const {token} = globals.selected;
		if (!token) {
			return;
		}
		if (tokenDragMode > -1) {
			if (e.key === "Escape") {
				globals.root.style.removeProperty("--outline-cursor");
				tokenDragMode = -1;
				const {selected: {token}} = globals,
				      {x, y, width, height, rotation} = tokenMousePos;
				if (token) {
					token.x = x;
					token.y = y;
					token.width = width;
					token.rotation = rotation;
					token.height = height;
					token.updateNode();
					createSVG(globals.outline, {"style": {"--outline-width": width + "px", "--outline-height": height + "px"}, "transform": token.transformString(false)});
				}
				stopMeasurement();
				cancelTokenDrag();
			}
			return;
		}
		if (e.key === "Escape") {
			deselectToken();
			return;
		}
		if (e.key === "Delete") {
			doTokenRemove(token.id);
			return;
		}
		let {x, y, rotation} = token;
		if (token.snap) {
			const {mapData: {gridSize, gridType}} = globals,
			      h = gridType === 2 ? Math.round(1.5 * gridSize / SQRT3) : gridType === 1 ? gridSize >> 1 : gridSize,
			      v = gridType === 1 ? Math.round(1.5 * gridSize / SQRT3) : gridType === 2 ? gridSize >> 1 : gridSize;
			switch (e.key) {
			case "ArrowUp":
				y -= v;
				break;
			case "ArrowDown":
				y += v;
				break;
			case "ArrowLeft":
				if (e.shiftKey) {
					const {mapData: {gridType}} = globals,
					      deg = 256 / (gridType === 1 || gridType === 2 ? 12 : 8);
					rotation = mod(Math.round(rotation - deg), 256);
					e.preventDefault();
				} else {
					x -= h;
				}
				break;
			case "ArrowRight":
				if (e.shiftKey) {
					const {mapData: {gridType}} = globals,
					      deg = 256 / (gridType === 1 || gridType === 2 ? 12 : 8);
					rotation = mod(Math.round(rotation + deg), 256);
					e.preventDefault();
				} else {
					x += h;
				}
				break;
			default:
				return;
			}
		} else {
			switch (e.key) {
			case "ArrowUp":
			case "ArrowDown":
			case "ArrowLeft":
			case "ArrowRight":
				token.x = tokenMousePos.x;
				token.y = tokenMousePos.y;
				token.rotation = tokenMousePos.rotation;
				break;
			default:
				return;
			}
		}
		doTokenSet({"id": token.id, x, y, rotation});
	      }, "onkeydown": (e: KeyboardEvent) => {
		const {token} = globals.selected;
		if (!token) {
			return;
		}
		if (token.snap) {
			return;
		}
		switch (e.key) {
		case "ArrowUp":
			token.y--;
			break;
		case "ArrowDown":
			token.y++;
			break;
		case "ArrowLeft":
			if (e.shiftKey) {
				token.rotation = mod(token.rotation - 1, 256);
				e.preventDefault();
			} else {
				token.x--;
			}
			break;
		case "ArrowRight":
			if (e.shiftKey) {
				token.rotation = mod(token.rotation + 1, 256);
				e.preventDefault();
			} else {
				token.x++;
			}
			break;
		default:
			return;
		}
		token.updateNode();
		outline.setAttribute("transform", token.transformString(false));
	      }, "onwheel": toolTokenWheel}, Array.from({length: 10}, (_, n) => rect({"onmouseover": toolTokenMouseOver, "onmousedown": function(this: SVGRectElement, e: MouseEvent) { toolTokenMouseDown.call(this, e, n); }}))),
	      mapOnDragOver = (e: DragEvent) => {
		if (e.dataTransfer) {
			if (e.dataTransfer.types.includes("character") || e.dataTransfer.types.includes("imageasset")) {
				e.preventDefault();
				e.dataTransfer.dropEffect = "link";
			} else if (e.dataTransfer.types.includes("Files")) {
				for (const i of e.dataTransfer.items) {
					if (i["kind"] !== "file") {
						return;
					}
					switch (i["type"]) {
					case "image/gif":
					case "image/png":
					case "image/jpeg":
					case "image/webp":
					case "video/apng":
						break;
					default:
						return;
					}
				}
				e.preventDefault();
				e.dataTransfer.dropEffect = "copy";
			}
		}
	      },
	      mapOnDrop = (e: DragEvent) => {
		if (globals.selected.layer === null || !e.dataTransfer) {
			return;
		}
		if (e.dataTransfer.types.includes("Files")) {
			const f = new FormData(),
			      [x, y] = screen2Grid(e.clientX, e.clientY),
			      {selected: {layer}} = globals;
			for (const file of e.dataTransfer.files) {
				f.append("asset", file);
			}
			uploadImages(f).then(images => {
				for (const image of images) {
					img({"src": `/images/${image.id}`, "onload": function(this: HTMLImageElement) {
						if (globals.selected.layer === layer && this.width > 0 && this.height > 0) {
							const token = {"id": 0, "src": image.id, x, y, "width": this.width, "height": this.height, "patternWidth": 0, "patternHeight": 0, "stroke": noColour, "strokeWidth": 0, "rotation": 0, "flip": false, "flop": false, "tokenData": {}, "tokenType": 0, "snap": autosnap.value, "lightColour": noColour, "lightIntensity": 0};
							if (token.snap) {
								[token.x, token.y] = snapTokenToGrid(token.x, token.y, token.width, token.height);
							}
							doTokenAdd(layer.path, token);
						}
					}});
				}
			}).catch(handleError);
			e.preventDefault();
			return;
		}
		const token = {"id": 0, "src": 0, "x": 0, "y": 0, "width": 0, "height": 0, "patternWidth": 0, "patternHeight": 0, "stroke": noColour, "strokeWidth": 0, "rotation": 0, "flip": false, "flop": false, "tokenData": {}, "tokenType": 0, "snap": autosnap.value, "lightColour": noColour, "lightIntensity": 0};
		if (e.dataTransfer.types.includes("character")) {
			const tD = JSON.parse(e.dataTransfer.getData("character")),
			      char = characterData.get(tD.id);
			if (char) {
				const ct = getCharacterToken(char);
				if (ct) {
					Object.assign(token, ct);
				} else {
					token.src = parseInt(char["store-image-icon"].data);
					token.width = tD.width;
					token.height = tD.height;
				}
			}
		} else if (e.dataTransfer.types.includes("imageasset")) {
			const tokenData = JSON.parse(e.dataTransfer.getData("imageasset"));
			token.src = tokenData.id;
			token.width = tokenData.width;
			token.height = tokenData.height;
		}
		[token.x, token.y] = screen2Grid(e.clientX, e.clientY);
		if (token.snap) {
			[token.x, token.y] = snapTokenToGrid(token.x, token.y, token.width, token.height);
		}
		doTokenAdd(globals.selected.layer.path, token);
	      },
	      allTokens = function* (folder: SVGFolder = globals.layerList): Iterable<SVGToken | SVGShape> {
		for (const e of (folder.children as (SVGFolder | SVGLayer)[])) {
			if (isSVGLayer(e)) {
				yield* e.tokens;
			} else {
				yield* allTokens(e);
			}
		}
	      },
	      selectToken = (newToken: SVGToken | SVGShape | SVGDrawing) => {
		setLayer(globals.tokens.get(newToken.id)!.layer);
		globals.selected.token = newToken;
		autoFocus(createSVG(outline, {"transform": newToken.transformString(false), "style": undefined, "class": `cursor_${((newToken.rotation + 143) >> 5) % 4}`}));
		window.setTimeout(() => outline.setAttribute("style", `--outline-width: ${newToken.width}px; --outline-height: ${newToken.height}px; --zoom: ${panZoom.zoom}`)); // TODO: Remove once Firefox bug is fixed!
		tokenMousePos.x = newToken.x;
		tokenMousePos.y = newToken.y;
		tokenMousePos.width = newToken.width;
		tokenMousePos.height = newToken.height;
		tokenMousePos.rotation = newToken.rotation;
		tokenSelected();
	      },
	      mapOnKeyDown = (e: KeyboardEvent) => {
		if (e.ctrlKey) {
			switch (e.key) {
			case 'z':
				if (!e.shiftKey) {
					undo.undo();
					e.preventDefault();
					break;
				}
			case 'r':
			case 'y':
				undo.redo();
				e.preventDefault();
				break;
			case 'x':
			case 'c':
				const t = globals.selected.token;
				if (t) {
					copiedToken = JSON.parse(JSON.stringify(t));
					if (e.key === 'x') {
						doTokenRemove(t.id);
					}
				}
				break;
			case 'v':
				if (!copiedToken || !globals.selected.layer) {
					return;
				}
				const [x, y] = copiedToken.snap ? snapTokenToGrid(pasteCoords[0], pasteCoords[1], copiedToken.width, copiedToken.height) : pasteCoords;
				doTokenAdd(globals.selected.layer.path, Object.assign(JSON.parse(JSON.stringify(copiedToken)), {"id": 0, x, y}));
			}
		}
	      },
	      pasteCoords = [0, 0],
	      moveMap = function (this: SVGElement, e: MouseEvent) {
		this.style.setProperty("--outline-cursor", "grabbing");
		let mX = e.clientX,
		    mY = e.clientY,
		    moved = false;
		const viewDrag = (e: MouseEvent) => {
			moved = true;
			panZoom.x += e.clientX - mX;
			panZoom.y += e.clientY - mY;
			createSVG(this, {"style": {"left": panZoom.x + "px", "top": panZoom.y + "px"}});
			mX = e.clientX;
			mY = e.clientY;
		      },
		      stop = () => {
			if (!moved && !e.ctrlKey) {
				deselectToken();
			}
			this.style.removeProperty("--outline-cursor");
			this.removeEventListener("mousemove", viewDrag);
			this.removeEventListener("mouseup", stop);
			this.removeEventListener("mouseleave", stop);
		      };
		this.addEventListener("mousemove", viewDrag);
		this.addEventListener("mouseup", stop);
		this.addEventListener("mouseleave", stop)
		return false
	      },
	      [setupControlOverride, cancelControlOverride] = keyEvent("Control", () => {
		if (overToken) {
			document.body.style.setProperty("--outline-cursor", "grab");
		}
	      }, () => {
		if (overToken) {
			document.body.style.setProperty("--outline-cursor", "pointer");
		}
	      });
	mapLoadReceive(mapID => rpc.getMapData(mapID).then(mapData => {
		Object.assign(globals.selected, {"layer": null, "token": null});
		const oldBase = base;
		oldBase.replaceWith(base = mapView(mapData));
		createSVG(globals.root, {"ondragover": mapOnDragOver, "ondrop": mapOnDrop, "onkeydown": mapOnKeyDown}, createHTML(outline, {"style": "display: none"}));
		pasteCoords[0] = 0;
		pasteCoords[1] = 0;
		mapLoadedSend(true);
	}));
	defaultTool.mapMouse0 = function (this: SVGElement, e: MouseEvent) {
		[pasteCoords[0], pasteCoords[1]] = screen2Grid(e.clientX, e.clientY);
		const {layer} = globals.selected;
		if (layer && (!e.ctrlKey || e.shiftKey)) {
			let newToken: SVGToken | SVGShape | SVGDrawing | null = null;
			for (const t of (e.ctrlKey ? allTokens() : layer.tokens) as Iterable<SVGToken | SVGShape>) {
				if (t.at(e.clientX, e.clientY)) {
					newToken = t;
				}
			}
			if (newToken) {
				selectToken(newToken);
				return false;
			}
		}
		if (!e.ctrlKey) {
			const {outline} = globals;
			if (document.body.style.getPropertyValue("--outline-cursor") === "pointer") {
				document.body.style.removeProperty("--outline-cursor");
				return false;
			} else if (e.target && (e.target as ChildNode).parentNode === outline) {
				return false;
			}
		}
		return moveMap.call(this, e);
	}
	defaultTool.mapMouse1 = moveMap;
	defaultTool.mapMouseOver = (e: MouseEvent) => {
		const {selected: {layer: selectedLayer}, outline} = globals,
		      overOutline = e.target && (e.target as ChildNode).parentNode === outline,
		      currentlyOverToken = overOutline || selectedLayer !== null && (selectedLayer.tokens as SVGToken[]).some(t => t.at(e.clientX, e.clientY)),
		      {root} = globals;
		let ctrl = e.ctrlKey;
		if (ctrl && !e.shiftKey) {
			document.body.style.setProperty("--outline-cursor", "grab");
		} else if (!overOutline) {
			if (currentlyOverToken) {
				document.body.style.setProperty("--outline-cursor", "pointer");
			} else {
				document.body.style.setProperty("--outline-cursor", "grab");
			}
		}
		if (!overOutline) {
			if (selectedLayer) {
				overToken = currentlyOverToken;
				const mouseMove = (e: MouseEvent) => {
					if (!ctrl && (selectedLayer.tokens as SVGToken[]).some(t => t.at(e.clientX, e.clientY))) {
						if (!overToken) {
							overToken = true;
							document.body.style.setProperty("--outline-cursor", "pointer");
						}
					} else if (overToken) {
						document.body.style.setProperty("--outline-cursor", "grab");
						overToken = false;
					}
				      };
				setupControlOverride();
				root.addEventListener("mousemove", mouseMove);
				root.addEventListener("mouseout", () => {
					document.body.style.removeProperty("--outline-cursor");
					cancelControlOverride();
					root.removeEventListener("mousemove", mouseMove);
				}, {"once": true})
			} else {
				root.addEventListener("mouseout", () => document.body.style.removeProperty("--outline-cursor"), {"once": true})
			}
		} else {
			const keyUp = (e: KeyboardEvent) => {
				if (e.key === "Control") {
					document.body.style.removeProperty("--outline-cursor");
					window.removeEventListener("keyup", keyUp);
					ctrl = false;
				} else if (ctrl && e.key === "Shift") {
					document.body.style.setProperty("--outline-cursor", "grab");
				}
			      },
			      keyDown = (e: KeyboardEvent) => {
				if (e.key === "Control" && !e.shiftKey) {
					document.body.style.setProperty("--outline-cursor", "grab");
					window.addEventListener("keyup", keyUp);
					ctrl = true;
				} else if (ctrl && e.key === "Shift") {
					document.body.style.removeProperty("--outline-cursor");
				}
			      };
			window.addEventListener("keydown", keyDown);
			if (ctrl || e.shiftKey) {
				window.addEventListener("keyup", keyUp);
			}
			root.addEventListener("mouseout", () => {
				document.body.style.removeProperty("--outline-cursor");
				window.removeEventListener("keydown", keyDown);
				window.removeEventListener("keyup", keyUp);
			}, {"once": true})
		}
		return false;
	};
	defaultTool.tokenMouse0 = (e: MouseEvent, n: Uint) => {
		if ((e.ctrlKey && !e.shiftKey) || !globals.selected.token) {
			return false;
		}
		e.stopPropagation();
		if (n === 0 && e.shiftKey) {
			const {layer, token} = globals.selected;
			if (!layer) {
				return false;
			}
			let newToken: SVGToken | SVGShape | SVGDrawing | null = null;
			for (const tk of (e.ctrlKey ? allTokens() : layer.tokens) as Iterable<SVGToken | SVGShape>) {
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
			return false;
		}
		setupTokenDrag();
		tokenDragMode = n;
		globals.root.style.setProperty("--outline-cursor", ["move", "cell", "nwse-resize", "ns-resize", "nesw-resize", "ew-resize"][tokenDragMode < 2 ? tokenDragMode : (3.5 - Math.abs(5.5 - tokenDragMode) + ((globals.selected.token.rotation + 143) >> 5)) % 4 + 2]);
		[tokenMousePos.mouseX, tokenMousePos.mouseY] = screen2Grid(e.clientX, e.clientY);
		if (n === 0 && measureTokenMove.value) {
			const {selected: {token}} = globals;
			startMeasurement(token.x + (token.width >> 1), token.y + (token.height >> 1));
		}
		return false;
	};
	defaultTool.tokenMouse2 = (e: MouseEvent) => {
		e.stopPropagation();
		const {layer: currLayer, token: currToken} = globals.selected;
		if (!currLayer || !currToken) {
			return false;
		}
		const tokenPos = currLayer.tokens.findIndex(t => t === currToken);
		place(document.body, [e.clientX, e.clientY], [
			tokenContext(),
			isTokenImage(currToken) ? [
				item(lang["CONTEXT_EDIT_TOKEN"], () => currToken instanceof SVGToken && tokenEdit(currToken.id, lang["CONTEXT_EDIT_TOKEN"], currToken.tokenData, false)),
				item(lang["CONTEXT_FLIP"], () => {
					if (!(currToken instanceof SVGToken)) {
						return;
					}
					doTokenSet({"id": currToken.id, "flip": !currToken.flip});
					globals.outline.focus();
				}),
				item(lang["CONTEXT_FLOP"], () => {
					if (!(currToken instanceof SVGToken)) {
						return;
					}
					doTokenSet({"id": currToken.id, "flop": !currToken.flop});
					globals.outline.focus();
				}),
				item(currToken.isPattern ? lang["CONTEXT_SET_IMAGE"] : lang["CONTEXT_SET_PATTERN"], () => {
					if (!(currToken instanceof SVGToken)) {
						return;
					}
					if (!currToken.isPattern) {
						doTokenSet({"id": currToken.id, "patternWidth": currToken.width, "patternHeight": currToken.height});
					} else {
						doTokenSet({"id": currToken.id, "patternWidth": 0, "patternHeight": 0});
					}
					globals.outline.focus();
				}),
			] : [],
			item(currToken.snap ? lang["CONTEXT_UNSNAP"] : lang["CONTEXT_SNAP"], () => {
				const snap = currToken.snap,
				      {x, y, width, height, rotation} = currToken;
				if (!snap) {
					const [newX, newY] = snapTokenToGrid(x, y, width, height),
					      newRotation = Math.round(rotation / 32) * 32 % 256;
					if (x !== newX || y !== newY || rotation !== newRotation) {
						doTokenSet({"id": currToken.id, "x": newX, "y": newY, "rotation": newRotation, "snap": !snap});
					}
				} else {
					doTokenSet({"id": currToken.id, "snap": !snap});
				}
				globals.outline.focus();
			}),
			item(lang["CONTEXT_SET_LIGHTING"], () => {
				let c = currToken.lightColour;
				const w = shell.appendChild(windows({"window-title": lang["CONTEXT_SET_LIGHTING"], "onremove": () => globals.outline.focus()})),
				      i = input({"type": "number", "value": currToken.lightIntensity, "min": 0, "step": 1});
				w.appendChild(createDocumentFragment([
					h1(lang["CONTEXT_SET_LIGHTING"]),
					labels(`${lang["LIGHTING_COLOUR"]}: `, makeColourPicker(w, lang["LIGHTING_PICK_COLOUR"], () => c, d => c = d)),
					br(),
					labels(`${lang["LIGHTING_INTENSITY"]}: `, i),
					br(),
					button({"onclick": () => {
						if (globals.selected.token === currToken) {
							doTokenLightChange(currToken.id, c, checkInt(parseInt(i.value), 0));
						}
						w.close();
					}}, lang["SAVE"])
				]));
			}),
			tokenPos < currLayer.tokens.length - 1 ? [
				item(lang["CONTEXT_MOVE_TOP"], () => {
					if (!globals.tokens.has(currToken.id)) {
						return;
					}
					const currLayer = globals.tokens.get(currToken.id)!.layer;
					doTokenMoveLayerPos(currToken.id, currLayer.path, currLayer.tokens.length - 1);
					globals.outline.focus();
				}),
				item(lang["CONTEXT_MOVE_UP"], () => {
					if (!globals.tokens.has(currToken.id)) {
						return;
					}
					const currLayer = globals.tokens.get(currToken.id)!.layer,
					      newPos = currLayer.tokens.findIndex(t => t === currToken) + 1;
					doTokenMoveLayerPos(currToken.id, currLayer.path, newPos);
					globals.outline.focus();
				})
			] : [],
			tokenPos > 0 ? [
				item(lang["CONTEXT_MOVE_DOWN"], () => {
					if (!globals.tokens.has(currToken.id)) {
						return;
					}
					const currLayer = globals.tokens.get(currToken.id)!.layer,
					      newPos = currLayer.tokens.findIndex(t => t === currToken) - 1;
					doTokenMoveLayerPos(currToken.id, currLayer.path, newPos);
				}),
				item(lang["CONTEXT_MOVE_BOTTOM"], () => {
					if (!globals.tokens.has(currToken.id)) {
						return;
					}
					const currLayer = globals.tokens.get(currToken.id)!.layer;
					doTokenMoveLayerPos(currToken.id, currLayer.path, 0);
					globals.outline.focus();
				})
			] : [],
			menu(lang["CONTEXT_MOVE_LAYER"], makeLayerContext(globals.layerList, (sl: SVGLayer) => {
				if (!globals.tokens.has(currToken.id)) {
					return;
				}
				doTokenMoveLayerPos(currToken.id, sl.path, sl.tokens.length);
				globals.outline.focus();
			}, currLayer.name)),
			item(lang["CONTEXT_DELETE"], () => doTokenRemove(currToken.id))
		]);
		return false;
	};
	defaultTool.mapMouse2 = (e: MouseEvent) => {
		const pos = screen2Grid(e.clientX, e.clientY);
		showSignal(pos);
		if (e.ctrlKey) {
			if (e.altKey) {
				rpc.setMapStart(pos[0], pos[1]);
			}
			rpc.signalMovePosition(pos);
		} else {
			rpc.signalPosition(pos);
		}
		return false;
	};
	rpc.waitSignalPosition().then(showSignal);
	rpc.waitMapChange().then(d => doMapChange(d, false));
	rpc.waitMapLightChange().then(c => doSetLightColour(c, false));
	rpc.waitLayerShow().then(path => waitLayerShow[0](doShowHideLayer(path, true, false)));
	rpc.waitLayerHide().then(path => waitLayerHide[0](doShowHideLayer(path, false, false)));
	rpc.waitLayerAdd().then(name => waitAdded[0]([{id: 1, "name": doLayerAdd(name, false)}]));
	rpc.waitLayerFolderAdd().then(path => waitFolderAdded[0](doLayerFolderAdd(path, false)));
	rpc.waitLayerMove().then(({from, to, position}) => {
		doLayerMove(from, to, position, false);
		waitLayerPositionChange[0]({from, to, position});
	});
	rpc.waitLayerRename().then(lr => {
		doLayerRename(lr["path"], lr["name"], false);
		waitLayerRename[0](lr);
	});
	rpc.waitLayerRemove().then(path => {
		checkSelectedLayer(path);
		const layer = getLayer(path);
		if (!layer) {
			handleError("Invalid layer remove");
			return;
		}
		(isSVGFolder(layer) ? waitFolderRemoved : waitRemoved)[0](path);
		removeLayer(path);
		undo.clear();
	});
	rpc.waitTokenAdd().then(({path, token}) => doTokenAdd(path, token, false)(token.id));
	rpc.waitTokenMoveLayerPos().then(({id, to, newPos}) => doTokenMoveLayerPos(id, to, newPos, false));
	rpc.waitTokenSet().then(t => doTokenSet(t, false));
	rpc.waitTokenRemove().then(tid => doTokenRemove(tid, false));
	rpc.waitLayerShift().then(({path, dx, dy}) => doLayerShift(path, dx, dy, false));
	rpc.waitLightShift().then(pos => doLightShift(pos.x, pos.y, false));
	rpc.waitWallAdded().then(w => doWallAdd(w, false));
	rpc.waitWallRemoved().then(wid => doWallRemove(wid, false));
	rpc.waitTokenLightChange().then(({id, lightColour, lightIntensity}) => doTokenLightChange(id, lightColour, lightIntensity, false));
	rpc.waitMapDataSet().then(({key, data}) => {
		if (key) {
			doMapDataSet(key, data, false)
		}
	});
	rpc.waitMapDataRemove().then(key => doMapDataRemove(key, false));
	rpc.waitMaskAdd().then(m => doMaskAdd(m, false));
	rpc.waitMaskRemove().then(i => doMaskRemove(i, false));
	rpc.waitMaskSet().then(ms => doMaskSet(ms, false));
};
