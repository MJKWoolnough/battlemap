import {Colour, FromTo, IDName, Int, Uint, MapDetails, LayerFolder, LayerMove, LayerRename, TokenSet, Token, TokenMoveLayerPos, WallPath} from './types.js';
import {Subscription} from './lib/inter.js';
import {autoFocus} from './lib/dom.js';
import {createHTML, br, button, input, h1, label} from './lib/html.js';
import {createSVG, g, rect} from './lib/svg.js';
import {SortNode} from './lib/ordered.js';
import place, {item, menu, List} from './lib/context.js';
import {windows} from './windows.js';
import {SVGLayer, SVGFolder, SVGToken, SVGShape, SVGDrawing, addLayer, addLayerFolder, getLayer, getParentLayer, isSVGFolder, isSVGLayer, removeLayer, renameLayer, setLayerVisibility, moveLayer, setMapDetails, setLightColour, globals, mapView, walkFolders, isTokenImage, isTokenDrawing, updateLight, normaliseWall, splitAfterLastSlash} from './map.js';
import {edit as tokenEdit, characterData} from './characters.js';
import {autosnap} from './settings.js';
import Undo from './undo.js';
import {toolTokenMouseDown, toolTokenContext, toolTokenWheel, toolTokenMouseOver} from './tools.js';
import {makeColourPicker, mapLayersSend, mapLoadReceive, mapLoadedSend, tokenSelected, noColour, handleError, screen2Grid, requestShell} from './misc.js';
import {panZoom} from './tools_default.js';
import {tokenContext, tokenDataFilter} from './plugins.js';
import {rpc, combined as combinedRPC} from './rpc.js';
import lang from './language.js';

const makeLayerContext = (folder: SVGFolder, fn: (sl: SVGLayer) => void, disabled = ""): List => (folder.children as SortNode<SVGFolder | SVGLayer>).map(e => e.id < 0 ? [] : isSVGFolder(e) ? menu(e.name, makeLayerContext(e, fn, disabled)) : item(e.name, () => fn(e), {"disabled": e.name === disabled})),
      ratio = (mDx: Int, mDy: Int, width: Uint, height: Uint, dX: (-1 | 0 | 1), dY: (-1 | 0 | 1), min = 10) => {
	mDx *= dX;
	mDy *= dY;
	if (dX !== 0 && mDy < mDx * height / width || dY === 0) {
		mDy = mDx * height / width;
	} else {
		mDx = mDy * width / height;
	}
	if (dX !== 0 && width + mDx < min) {
		mDx = min - width;
		mDy = min * height / width - height;
	}
	if (dY !== 0 && height + mDy < min) {
		mDx = min * width / height - width;
		mDy = min - height;
	}
	return [mDx * dX, mDy * dY];
      },
      subFn = <T>(): [(data: T) => void, Subscription<T>] => {
	let fn: (data: T) => void;
	const sub = new Subscription<T>(resolver => fn = resolver);
	return [fn!, sub];
      },
      waitAdded = subFn<IDName[]>(),
      waitMoved = subFn<FromTo>(),
      waitRemoved = subFn<string>(),
      waitFolderAdded = subFn<string>(),
      waitFolderMoved = subFn<FromTo>(),
      waitFolderRemoved = subFn<string>(),
      waitLayerShow = subFn<string>(),
      waitLayerHide = subFn<string>(),
      waitLayerPositionChange = subFn<LayerMove>(),
      waitLayerRename = subFn<LayerRename>(),
      invalidRPC = () => Promise.reject("invalid");

export const getToken = () => {
	const {token} = globals.selected;
	if (token instanceof SVGToken && !token.isPattern) {
		const {src, width, height, patternWidth, patternHeight, rotation, flip, flop, snap} = token,
		      tokenData = JSON.parse(JSON.stringify(token.tokenData));
		for (const f of tokenDataFilter()) {
			delete(tokenData[f]);
		}
		return {src, width, height, patternWidth, patternHeight, rotation, flip, flop, tokenData, snap};
	}
	return undefined;
};

export default function(base: HTMLElement) {
	let canceller = () => {};
	mapLoadReceive(mapID => rpc.getMapData(mapID).then(mapData => {
		canceller();
		Object.assign(globals.selected, {"layer": null, "token": null});
		let tokenDragX = 0, tokenDragY = 0, tokenDragMode = 0;
		const oldBase = base;
		oldBase.replaceWith(base = mapView(oldBase, mapData));
		const {root, definitions, layerList} = globals,
		      undo = new Undo(),
		      tokenDrag = (e: MouseEvent) => {
			let {x, y, width, height, rotation} = tokenMousePos;
			const dx = (e.clientX - tokenMousePos.mouseX) / panZoom.zoom,
			      dy = (e.clientY - tokenMousePos.mouseY) / panZoom.zoom,
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
					x = Math.round(x / sq) * sq;
					y = Math.round(y / sq) * sq;
				}
				break;
			case 1: {
				rotation = Math.round(-128 * Math.atan2(panZoom.zoom * (x + width / 2) + panZoom.x - (panZoom.zoom - 1) * mapData.width / 2 - e.clientX, panZoom.zoom * (y + height / 2) + panZoom.y - (panZoom.zoom - 1) * mapData.height / 2 - e.clientY) / Math.PI);
				while (rotation < 0) {
					rotation += 256;
				}
				if (selectedToken.snap) {
					rotation = Math.round(rotation / 32) * 32 % 256;
				}
				outline.setAttribute("class", `cursor_${((rotation + 143) >> 5) % 4}`);
			}
			break;
			default: {
				const r = -360 * rotation / 256,
				      {x: aDx, y: aDy} = new DOMPoint(dx, dy).matrixTransform(new DOMMatrix().rotateSelf(r)),
				      fr = new DOMMatrix().translateSelf(x + width / 2, y + height / 2).rotateSelf(-r).translateSelf(-(x + width / 2), -(y + height / 2)),
				      dirX = [2, 5, 7].includes(tokenDragMode) ? -1 : [4, 6, 9].includes(tokenDragMode) ? 1 : 0,
				      dirY = [2, 3, 4].includes(tokenDragMode) ? -1 : [7, 8, 9].includes(tokenDragMode) ? 1 : 0,
				      [mDx, mDy] = ratio(aDx, aDy, width, height, dirX, dirY, selectedToken!.snap ? sq : 10);
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
				if (selectedToken!.snap) {
					width = Math.round(width / sq) * sq;
					height = Math.round(height / sq) * sq;
				}
				const {x: cx, y: cy} = new DOMPoint(x + width/2, y + height/2).matrixTransform(fr),
				      {x: nx, y: ny} = new DOMPoint(x, y).matrixTransform(fr).matrixTransform(new DOMMatrix().translateSelf(cx, cy).rotateSelf(r).translateSelf(-cx, -cy));
				x = nx;
				y = ny;
				if (selectedToken!.snap) {
					x = Math.round(x / sq) * sq;
					y = Math.round(y / sq) * sq;
				}
			}}
			selectedToken!.x = x;
			selectedToken!.y = y;
			selectedToken!.width = width;
			selectedToken!.rotation = rotation;
			selectedToken!.height = height;
			selectedToken!.updateNode();
			createSVG(outline, {"--outline-width": width + "px", "--outline-height": height + "px", "transform": selectedToken!.transformString(false)});
		      },
		      tokenMouseUp = (e: MouseEvent) => {
			if (!globals.selected.token || e.button !== 0 || !globals.selected.layer) {
				return;
			}
			document.body.removeEventListener("mousemove", tokenDrag);
			document.body.removeEventListener("mouseup", tokenMouseUp);
			root.style.removeProperty("--outline-cursor");
			const {layer, token} = globals.selected,
			      {x, y, width, height, rotation} = tokenMousePos,
			      newX = Math.round(token.x),
			      newY = Math.round(token.y),
			      newRotation = Math.round(token.rotation),
			      newWidth = Math.round(token.width),
			      newHeight = Math.round(token.height);
			if (newX !== x || newY !== y || newWidth !== width || newHeight !== height || newRotation !== rotation) {
				doTokenSet({"id": token.id, "x": newX, "y": newY, "width": newWidth, "height": newHeight, "rotation": newRotation}, true);
			}
		      },
		      tokenMousePos = {mouseX: 0, mouseY: 0, x: 0, y: 0, width: 0, height: 0, rotation: 0},
		      unselectToken = () => {
			globals.selected.token = null;
			outline.style.setProperty("display", "none");
			tokenSelected();
		      },
		      removeS = (path: string) => {
			checkSelectedLayer(path);
			removeLayer(path);
			return rpc.removeLayer(path);
		      },
		      checkSelectedLayer = (path: string) => {
			const {layer} = globals.selected;
			if (layer && (layer.path === path || layer.path.startsWith(path + "/"))) {
				globals.selected.layer = null;
				if (globals.selected.token) {
					unselectToken();
				}
			}
		      },
		      outline = globals.outline = g();
		globals.undo = undo;
		globals.deselectToken = unselectToken;
		createSVG(root, {"ondragover": (e: DragEvent) => {
			if (e.dataTransfer && (e.dataTransfer.types.includes("character") || e.dataTransfer.types.includes("imageasset"))) {
				e.preventDefault();
				e.dataTransfer!.dropEffect = "link";
			}
		      }, "ondrop": (e: DragEvent) => {
			if (globals.selected.layer === null) {
				return;
			}
			const token = {"id": 0, "src": 0, "x": 0, "y": 0, "width": 0, "height": 0, "patternWidth": 0, "patternHeight": 0, "stroke": noColour, "strokeWidth": 0, "rotation": 0, "flip": false, "flop": false, "tokenData": {}, "tokenType": 0, "snap": autosnap.value, "lightColour": noColour, "lightIntensity": 0};
			if (e.dataTransfer!.types.includes("character")) {
				const tD = JSON.parse(e.dataTransfer!.getData("character")),
				      char = characterData.get(tD.id)!;
				if (char["store-token-data"]) {
					Object.assign(token, char["store-token-data"].data);
				} else {
					token.src = parseInt(char["store-image-icon"].data);
					token.width = tD.width;
					token.height = tD.height;
				}
				if (char["store-image-id"]) {
					token.tokenData = char["store-image-id"].data;
				}
			} else {
				const tokenData = JSON.parse(e.dataTransfer!.getData("imageAsset"));
				token.src = tokenData.id;
				token.width = tokenData.width;
				token.height = tokenData.height;
			}
			[token.x, token.y] = screen2Grid(e.clientX, e.clientY, token.snap);
			if (token.snap && token.tokenData === 0) {
				const sq = mapData.gridSize;
				token.width = Math.max(Math.round(token.width / sq) * sq, sq);
				token.height = Math.max(Math.round(token.height / sq) * sq, sq);
			}
			const lp = globals.selected.layer.path;
			doTokenAdd(lp, token, true);
		      }, "onmousedown": (e: MouseEvent) => {
			const {layer} = globals.selected;
			if (!layer || e.button !== 0) {
				return;
			}
			const newToken = (layer.tokens as (SVGToken | SVGShape)[]).reduce((old, t) => t.at(e.clientX, e.clientY) ? t : old, null as SVGToken | SVGShape | null);
			if (!e.ctrlKey) {
				unselectToken();
			}
			if (!newToken || e.ctrlKey) {
				return;
			}
			globals.selected.token = newToken;
			autoFocus(createSVG(outline, {"transform": newToken.transformString(false), "style": `--outline-width: ${newToken.width}px; --outline-height: ${newToken.height}px`, "--zoom": panZoom.zoom, "class": `cursor_${((newToken.rotation + 143) >> 5) % 4}`}));
			tokenMousePos.x = newToken.x;
			tokenMousePos.y = newToken.y;
			tokenMousePos.width = newToken.width;
			tokenMousePos.height = newToken.height;
			tokenMousePos.rotation = newToken.rotation;
			tokenSelected();
		      }, "onkeydown": (e: KeyboardEvent) => {
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
				}
			}
		      }}, createSVG(outline, {"id": "outline", "tabindex": "-1", "style": "display: none", "onkeyup": (e: KeyboardEvent) => {
			const {token} = globals.selected;
			if (!token) {
				return;
			}
			if (e.key === "Delete") {
				doTokenRemove(token.id, true);
				return;
			}
			let newX = token.x,
			    newY = token.y;
			if (token.snap) {
				const sq = mapData.gridSize;
				switch (e.key) {
				case "ArrowUp":
					newY -= sq;
					break;
				case "ArrowDown":
					newY += sq;
					break;
				case "ArrowLeft":
					newX -= sq;
					break;
				case "ArrowRight":
					newX += sq;
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
					break;
				default:
					return;
				}
			}
			doTokenSet({"id": token.id, "x": newX, "y": newY, "width": token.width, "height": token.height, "rotation": token.rotation}, true);
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
				token.x--;
				break;
			case "ArrowRight":
				token.x++;
				break;
			default:
				return;
			}
			token.updateNode();
			outline.setAttribute("transform", token.transformString(false));
		      }, "oncontextmenu": function (this: SVGGElement, e: MouseEvent) {
			toolTokenContext.call(this, e);
			if (e.defaultPrevented) {
				return;
			}
			e.preventDefault();
			const {layer: currLayer, token: currToken} = globals.selected;
			if (!currLayer || !currToken) {
				return;
			}
			const tokenPos = currLayer.tokens.findIndex(t => t === currToken);
			place(base, [e.clientX, e.clientY], [
				tokenContext(),
				isTokenImage(currToken) ? [
					item(lang["CONTEXT_EDIT_TOKEN"], () => currToken instanceof SVGToken && tokenEdit(currToken.id, "Edit Token", currToken.tokenData, false)),
					item(lang["CONTEXT_FLIP"], () => {
						if (!(currToken instanceof SVGToken)) {
							return;
						}
						doTokenSet({"id": currToken.id, "flip": currToken.flip}, true);
						outline.focus();
					}),
					item(lang["CONTEXT_FLOP"], () => {
						if (!(currToken instanceof SVGToken)) {
							return;
						}
						doTokenSet({"id": currToken.id, "flop": currToken.flop = !currToken.flop}, true);
						outline.focus();
					}),
					item(currToken.isPattern ? lang["CONTEXT_SET_IMAGE"] : lang["CONTEXT_SET_PATTERN"], () => {
						if (!(currToken instanceof SVGToken)) {
							return;
						}
						if (currToken.isPattern) {
							doTokenSet({"id": currToken.id, "patternWidth": currToken.width, "patternHeight": currToken.height}, true);
						} else {
							doTokenSet({"id": currToken.id, "patternWidth": 0, "patternHeight": 0}, true);
						}
					}),
				] : [],
				item(currToken.snap ? lang["CONTEXT_UNSNAP"] : lang["CONTEXT_SNAP"], () => {
					const snap = currToken.snap,
					      sq = mapData.gridSize,
					      {x, y, width, height, rotation} = currToken;
					if (!snap) {
						const newX = Math.round(x / sq) * sq,
						      newY = Math.round(y / sq) * sq,
						      newWidth = Math.max(Math.round(width / sq) * sq, sq),
						      newHeight = Math.max(Math.round(height / sq) * sq, sq),
						      newRotation = Math.round(rotation / 32) * 32 % 256;
						if (x !== newX || y !== newY || width !== newWidth || height !== newHeight || rotation !== newRotation) {
							doTokenSet({"id": currToken.id, "x": newX, "y": newY, "width": newWidth, "height": newHeight, "rotation": newRotation, "snap": !snap}, true);
						}
					} else {
						doTokenSet({"id": currToken.id, "snap": !snap}, true);
					}
				}),
				item(lang["CONTEXT_SET_LIGHTING"], () => {
					let c = currToken.lightColour;
					const t = Date.now(),
					      w = requestShell().appendChild(windows({"window-title": lang["CONTEXT_SET_LIGHTING"]})),
					      i = input({"id": `tokenIntensity_${t}`, "type": "number", "value": currToken.lightIntensity, "min": 0, "step": 1});
					w.appendChild(createHTML(null, [
						h1(lang["CONTEXT_SET_LIGHTING"]),
						label({"for": `tokenLighting_${t}`}, `${lang["LIGHTING_COLOUR"]}: `),
						makeColourPicker(w, "Pick Token Lighting Colour", () => c, d => c = d, `tokenLighting_${t}`),
						br(),
						label({"for": `tokenIntensity_${t}`}, `${lang["LIGHTING_INTENSITY"]}: `),
						i,
						br(),
						button({"onclick": () => {
							if (globals.selected.token === currToken) {
								const cc = c,
								      ci = parseInt(i.value);
								if (ci >= 0) {
									const {lightColour, lightIntensity} = currToken,
									      doIt = () => {
										rpc.setTokenLight(currToken.id, currToken.lightColour = cc, currToken.lightIntensity = ci);
										updateLight();
										return () => {
											rpc.setTokenLight(currToken.id, currToken.lightColour = lightColour, currToken.lightIntensity = lightIntensity);
											updateLight();
											return doIt;
										};
									};
									undo.add(doIt());
								}
							}
							w.close();
						}}, lang["SAVE"])
					]));
				}),
				tokenPos < currLayer.tokens.length - 1 ? [
					item(lang["CONTEXT_MOVE_TOP"], () => {
						if (!globals.tokens[currToken.id]) {
							return;
						}
						const currLayer = globals.tokens[currToken.id].layer;
						doTokenMoveLayerPos(currToken.id, currLayer.path, currLayer.tokens.length - 1, true);
					}),
					item(lang["CONTEXT_MOVE_UP"], () => {
						if (!globals.tokens[currToken.id]) {
							return;
						}
						const currLayer = globals.tokens[currToken.id].layer,
						      newPos = currLayer.tokens.findIndex(t => t === currToken) + 1;
						doTokenMoveLayerPos(currToken.id, currLayer.path, newPos, true);
					})
				] : [],
				tokenPos > 0 ? [
					item(lang["CONTEXT_MOVE_DOWN"], () => {
						if (!globals.tokens[currToken.id]) {
							return;
						}
						const currLayer = globals.tokens[currToken.id].layer,
						      newPos = currLayer.tokens.findIndex(t => t === currToken) - 1;
						doTokenMoveLayerPos(currToken.id, currLayer.path, newPos, true);
					}),
					item(lang["CONTEXT_MOVE_BOTTOM"], () => {
						if (!globals.tokens[currToken.id]) {
							return;
						}
						const currLayer = globals.tokens[currToken.id].layer;
						doTokenMoveLayerPos(currToken.id, currLayer.path, 0, true);
					})
				] : [],
				menu(lang["CONTEXT_MOVE_LAYER"], makeLayerContext(layerList, (sl: SVGLayer) => {
					if (!globals.tokens[currToken.id]) {
						return;
					}
					const currLayer = globals.tokens[currToken.id].layer;
					doTokenMoveLayerPos( currToken.id, currLayer.path, currLayer.tokens.length, true);
				}, currLayer.name)),
				item(lang["CONTEXT_DELETE"], () => doTokenRemove(currToken.id))
			]);
		}, "onwheel": toolTokenWheel}, Array.from({length: 10}, (_, n) => rect({"data-outline": n, "onmouseover": toolTokenMouseOver, "onmousedown": function(this: SVGRectElement, e: MouseEvent) {
			toolTokenMouseDown.call(this, e);
			if (e.defaultPrevented || e.button !== 0 || e.ctrlKey || ! globals.selected.token) {
				return;
			}
			e.stopImmediatePropagation();
			document.body.addEventListener("mousemove", tokenDrag);
			document.body.addEventListener("mouseup", tokenMouseUp);
			tokenDragMode = parseInt(this.getAttribute("data-outline")!);
			root.style.setProperty("--outline-cursor", ["move", "cell", "nwse-resize", "ns-resize", "nesw-resize", "ew-resize"][tokenDragMode < 2 ? tokenDragMode : (3.5 - Math.abs(5.5 - tokenDragMode) + ((globals.selected.token.rotation + 143) >> 5)) % 4 + 2]);
			tokenMousePos.mouseX = e.clientX;
			tokenMousePos.mouseY = e.clientY;
		      }}))));
		mapLayersSend({
			"waitAdded": () => waitAdded[1],
			"waitMoved": () => waitMoved[1],
			"waitRemoved": () => waitRemoved[1],
			"waitLinked": () => new Subscription<IDName>(() => {}),
			"waitFolderAdded": () => waitFolderAdded[1],
			"waitFolderMoved": () => waitFolderMoved[1],
			"waitFolderRemoved": () => waitFolderRemoved[1],
			"waitLayerSetVisible": () => waitLayerShow[1],
			"waitLayerSetInvisible": () => waitLayerHide[1],
			"waitLayerPositionChange": () => waitLayerPositionChange[1],
			"waitLayerRename": () => waitLayerRename[1],
			"list": () => Promise.resolve(layerList as LayerFolder),
			"createFolder": (path: string) => rpc.addLayerFolder(path).then(doLayerFolderAdd),
			"move": invalidRPC,
			"moveFolder": invalidRPC,
			"renameLayer": (path: string, name: string) => rpc.renameLayer(path, name).then(({name}) => (doLayerRename(path, name), name)),
			"remove": path => {
				undo.clear();
				return removeS(path);
			},
			"removeFolder": path => {
				undo.clear();
				return removeS(path);
			},
			"link": invalidRPC,
			"newLayer": (name: string) => rpc.addLayer(name).then(doLayerAdd),
			"setVisibility": (path: string, visibility: boolean) => (visibility ? rpc.showLayer : rpc.hideLayer)(doShowHideLayer(path, visibility)),
			"setLayer": (path: string) => {
				globals.selected.layer = getLayer(path) as SVGLayer;
				unselectToken();
			},
			"setLayerMask": (path: string) => {},
			"moveLayer": (from: string, to: string, position: Uint) => {
				doLayerMove(from, to, position);
				return rpc.moveLayer(from, to, position);
			},
			"getMapDetails": () => mapData,
			"setMapDetails": (details: MapDetails) => {
				doMapChange(details);
				return rpc.setMapDetails(details)
			},
			"getLightColour": () => mapData.lightColour,
			"setLightColour": (c: Colour) => {
				doSetLightColour(c);
				return rpc.setLightColour(c)
			},
		});
		const doMapChange = (details: MapDetails) => {
			const oldDetails = {"width": mapData.width, "height": mapData.height, "gridSize": mapData.gridSize, "gridStroke": mapData.gridStroke, "gridColour": mapData.gridColour},
			      doIt = (sendRPC = true) => {
				setMapDetails(details);
				if (sendRPC) {
					rpc.setMapDetails(details);
				}
				return () => {
					setMapDetails(oldDetails)
					rpc.setMapDetails(oldDetails);
					return doIt;
				};
			      };
			undo.add(doIt(false));
		      },
		      doSetLightColour = (c: Colour) => {
			const oldColour = mapData.lightColour,
			      doIt = (sendRPC = true) => {
				setLightColour(c);
				if (sendRPC) {
					rpc.setLightColour(c);
				}
				return () => {
					setLightColour(oldColour);
					rpc.setLightColour(oldColour);
					return doIt;
				};
			      };
			undo.add(doIt(false));
		      },
		      doShowHideLayer = (path: string, visibility: boolean) => {
			const doIt = (sendRPC = true) => {
				checkSelectedLayer(path);
				setLayerVisibility(path, visibility);
				if (sendRPC) {
					if (visibility) {
						rpc.showLayer(path);
						waitLayerShow[0](path);
					} else {
						rpc.hideLayer(path);
						waitLayerHide[0](path);
					}
				}
				visibility = !visibility;
				return doIt;
			      };
			undo.add(doIt(false));
			return path;
		      },
		      doLayerAdd = (name: string) => {
			const path = "/" + name,
			      doIt = (sendRPC = true) => {
				addLayer(name);
				if (sendRPC) {
					waitAdded[0]([{id: 1, name}]);
					rpc.addLayer(name);
				}
				return () => {
					checkSelectedLayer(path);
					removeLayer(path);
					waitRemoved[0](path);
					rpc.removeLayer(path);
					return doIt;
				};
			      };
			undo.add(doIt(false));
			return name;
		      },
		      doLayerFolderAdd = (path: string) => {
			const doIt = (sendRPC = true) => {
				addLayerFolder(path);
				if (sendRPC) {
					waitFolderAdded[0](path);
					rpc.addLayerFolder(path);
				}
				return () => {
					checkSelectedLayer(path);
					removeLayer(path);
					rpc.removeLayer(path);
					return doIt;
				};
			      };
			undo.add(doIt(false));
			return path;
		      },
		      doLayerMove = (from: string, to: string, newPos: Uint) => {
			const [parent, layer] = getParentLayer(from);
			if (!parent || !layer) {
				handleError("Invalid layer move");
				return;
			}
			let oldPos = parent.children.indexOf(layer);
			const doIt = (sendRPC = true) => {
				unselectToken();
				moveLayer(from, to, newPos);
				if (sendRPC) {
					rpc.moveLayer(from, to, newPos);
					waitLayerPositionChange[0]({
						from,
						to,
						"position": newPos
					});
				}
				[to, from] = [from, to];
				[oldPos, newPos] = [newPos, oldPos];
				return doIt;
			      };
			undo.add(doIt(false));
		      },
		      doLayerRename = (oldPath: string, newName: string) => {
			let [parentPath, oldName] = splitAfterLastSlash(oldPath),
			    newPath = parentPath + "/" + oldName;
			const doIt = (sendRPC = true) => {
				renameLayer(oldPath, newName);
				if (sendRPC) {
					rpc.renameLayer(oldPath, newName);
					waitLayerRename[0]({"path": oldPath, "name": newName});
				}
				[oldPath, newPath] = [newPath, oldPath];
				[oldName, newName] = [newName, oldName];
				return doIt;
			      };
			undo.add(doIt(false));
		      },
		      doTokenAdd = (path: string, tk: Token, sendRPC = false) => {
			const layer = getLayer(path);
			if (!layer || !isSVGLayer(layer)) {
				handleError("Invalid layer for token add");
				return () => {};
			}
			const token = isTokenImage(tk) ? SVGToken.from(tk) : isTokenDrawing(tk) ? SVGDrawing.from(tk) : SVGShape.from(tk),
			      addToken = (id: Uint) => {
				token.id = id;
				layer.tokens.push(token);
				globals.tokens[id] = {
					layer,
					token
				};
			      },
			      doIt = (sendRPC = true) => {
				if (sendRPC) {
					rpc.addToken(path, token).then(addToken);
				}
				return () => {
					delete globals.tokens[token.id];
					layer.tokens.pop();
					rpc.removeToken(token.id);
					return doIt;
				};
			      };
			undo.add(doIt(sendRPC));
			return addToken;
		      },
		      doTokenMoveLayerPos = (id: Uint, to: string, newPos: Uint, sendRPC = false) => {
			const {layer, token} = globals.tokens[id],
			      newParent = getLayer(to);
			if (!layer || !token || !newParent || !isSVGLayer(newParent)) {
				handleError("Invalid Token Move Layer/Pos");
				return;
			}
			if (newPos > newParent.tokens.length) {
				newPos = newParent.tokens.length;
			}
			const currentPos = layer.tokens.findIndex(t => t === token),
			      doIt = (sendRPC = true) => {
				newParent.tokens.splice(newPos, 0, layer.tokens.splice(currentPos, 1)[0]);
				globals.tokens[id].layer = newParent;
				if (token.lightColour.a > 0 && token.lightIntensity > 0) {
					updateLight();
				}
				if (globals.selected.token === token) {
					unselectToken();
				}
				if (sendRPC) {
					rpc.setTokenLayerPos(id, layer.path, newPos);
				}
				return () => {
					newParent.tokens.splice(currentPos, 0, layer.tokens.splice(newPos, 1)[0]);
					globals.tokens[id].layer = layer;
					if (token.lightColour.a > 0 && token.lightIntensity > 0) {
						updateLight();
					}
					if (globals.selected.token === token) {
						unselectToken();
					}
					rpc.setTokenLayerPos(id, newParent.path, currentPos);
					return doIt;
				};
			      };
			undo.add(doIt(sendRPC));
		      },
		      doTokenSet = (ts: TokenSet, sendRPC = false) => {
			const {token} = globals.tokens[ts.id];
			if (!token) {
				handleError("Invalid token for token set");
				return;
			}
			let original: TokenSet = {"id": ts.id, "tokenData": {}, "removeTokenData": []};
			for (const k in ts) {
				switch (k) {
				case "id":
					break;
				case "tokenData":
					if (token instanceof SVGToken) {
						const tokenData = ts[k];
						for (const k in tokenData) {
							if (token["tokenData"][k]) {
								original["tokenData"]![k] = token["tokenData"][k];
							} else {
								original["removeTokenData"]!.push(k);
							}
						}
					}
					break;
				case "removeTokenData":
					if (token instanceof SVGToken) {
						const removeTokenData = ts[k]!;
						for (const k of removeTokenData) {
							original["tokenData"]![k] = token["tokenData"][k];
						}
					}
					break;
				default:
					(original as Record<string, any>)[k] = ts[k as keyof TokenSet]
				}
			}
			const updatePattern = isTokenImage(token) && (!!ts["patternWidth"] || !!ts["patternHeight"]),
			      doIt = (sendRPC = true) => {
				for (const k in ts) {
					switch (k) {
					case "id":
						break;
					case "tokenData":
						if (token instanceof SVGToken) {
							const tokenData = ts[k];
							for (const k in tokenData) {
								token["tokenData"][k] = tokenData[k];
							}
						}
						break;
					case "removeTokenData":
						if (token instanceof SVGToken) {
							const removeTokenData = ts[k]!;
							for (const k of removeTokenData) {
								delete token["tokenData"][k];
							}
						}
						break;
					default:
						(token as Record<string, any>)[k] = ts[k as keyof TokenSet]
					}
				}
				token.updateNode()
				if (sendRPC) {
					rpc.setToken(ts);
				}
				[original, ts] = [ts, original];
				return doIt;
			      };
			undo.add(doIt(sendRPC));
		      },
		      doTokenRemove = (tk: Uint, sendRPC = false) => {
			const {layer, token} = globals.tokens[tk];
			if (!token) {
				handleError("invalid token for removal");
				return;
			}
			const pos = layer.tokens.findIndex(t => t === token),
			      doIt = (sendRPC = true) => {
				layer.tokens.splice(pos, 1);
				if (token instanceof SVGToken) {
					token.cleanup();
					if (token.lightColour.a > 0 && token.lightIntensity > 0) {
						updateLight();
					}
				}
				if (sendRPC) {
					rpc.removeToken(token.id);
				}
				return () => {
					layer.tokens.splice(pos, 0, token);
					rpc.addToken(layer.path, token).then(id => {
						token.id = id;
						globals.tokens[id] = {layer, token};
					});
					return doIt;
				};
			      };
			undo.add(doIt(sendRPC));
		      },
		      doLayerShift = (path: string, dx: Uint, dy: Uint, sendRPC = false) => {
			const layer = getLayer(path);
			if (!layer || !isSVGLayer(layer)) {
				handleError("invalid layer for shifting");
				return;
			}
			const doIt = (sendRPC = true) => {
				(layer.tokens as (SVGToken | SVGShape)[]).forEach(t => {
					t.x += dx;
					t.y += dy;
					t.updateNode();
				});
				layer.walls.forEach(w => {
					w.x1 += dx;
					w.y1 += dy;
					w.x2 += dx;
					w.y2 += dy;
				});
				updateLight();
				if (sendRPC) {
					rpc.shiftLayer(path, dx, dy);
				}
				dx = -dx;
				dy = -dy;
				return doIt;
			      };
			undo.add(doIt(sendRPC));
		      },
		      doLightShift = (x: Uint, y: Uint, sendRPC = false) => {
			let {lightX: oldX, lightY: oldY} = mapData;
			const doIt = (sendRPC = true) => {
				mapData.lightX = x;
				mapData.lightY = y;
				updateLight();
				if (sendRPC) {
					rpc.shiftLight(x, y);
				}
				[x, oldX] = [oldX, x];
				[y, oldY] = [oldY, y];
				return doIt;
			      };
			undo.add(doIt(sendRPC));
		      },
		      doWallAdd = (w: WallPath, sendRPC = false) => {
			const layer = getLayer(w.path);
			if (!layer || !isSVGLayer(layer)) {
				handleError("invalid layer for wall add")
				return;
			}
			const {path, x1, y1, x2, y2, colour: {r, g, b, a}} = w,
			      colour = {r, g, b, a},
			      wall = normaliseWall({"id": w.id, x1, y1, x2, y2, colour}),
			      doIt = (sendRPC = true) => {
				layer.walls.push(wall);
				updateLight();
				if (sendRPC) {
					rpc.addWall(path, x1, y1, x2, y2, colour).then(id => {
						wall.id = id;
						globals.walls[id] = {layer, wall};
					});
				} else if (w.id > 0) {
					globals.walls[w.id] = {layer, wall};
				}
				return () => {
					layer.walls.splice(layer.walls.findIndex(w => w === wall), 1);
					updateLight();
					rpc.removeWall(wall.id);
					delete globals.walls[wall.id];
					wall.id = 0;
					return doIt;
				};
			      };
			undo.add(doIt(sendRPC));
		      },
		      doWallRemove = (wID: Uint, sendRPC = false) => {
				const {layer, wall} = globals.walls[wID];
				if (!layer || !wall) {
					handleError("invalid wall to remove");
					return;
				}
				const doIt = (sendRPC = true) => {
					layer.walls.splice(layer.walls.findIndex(w => w === wall), 1);
					updateLight();
					if (sendRPC) {
						rpc.removeWall(wall.id);
					}
					delete globals.walls[wall.id];
					wall.id = 0;
					return () => {
						layer.walls.push(wall);
						updateLight();
						rpc.addWall(layer.path, wall.x1, wall.y1, wall.x2, wall.y2, wall.colour).then(id => {
							wall.id = id;
							globals.walls[id] = {layer, wall};
						});
						return doIt;
					};
				      };
				undo.add(doIt(sendRPC));
		      },
		      doTokenLightChange = (id: Uint, lightColour: Colour, lightIntensity: Uint, sendRPC = false) => {
			const {token} = globals.tokens[id];
			if (!token) {
				handleError("invalid token for light change");
				return;
			}
			let {lightColour: oldLightColour, lightIntensity: oldLightIntensity} = token;
			const doIt = (sendRPC = true) => {
				token.lightColour = lightColour;
				token.lightIntensity = lightIntensity;
				updateLight();
				if (sendRPC) {
					rpc.setTokenLight(id, lightColour, lightIntensity);
				}
				[lightColour, oldLightColour] = [oldLightColour, lightColour];
				[lightIntensity, oldLightIntensity] = [oldLightIntensity, lightIntensity];
				return doIt;
			      };
			undo.add(doIt(sendRPC));
		      },
		      doMapDataSet = (key: string, data: any, sendRPC = false) => {
			const oldData = mapData.data[key],
			      doIt = (sendRPC = true) => {
				mapData.data[key] = data;
				if (sendRPC) {
					rpc.setMapKeyData(key, data);
				}
				return () => {
					if (oldData) {
						rpc.setMapKeyData(key, mapData.data[key] = oldData);
					} else {
						delete mapData.data[key];
						rpc.removeMapKeyData(key);
					}
					return doIt;
				};
			      };
			undo.add(doIt(false));
		      };
		canceller = Subscription.canceller(
			rpc.waitMapChange().then(doMapChange),
			rpc.waitMapLightChange().then(doSetLightColour),
			rpc.waitLayerShow().then(path => waitLayerShow[0](doShowHideLayer(path, true))),
			rpc.waitLayerHide().then(path => waitLayerHide[0](doShowHideLayer(path, false))),
			rpc.waitLayerAdd().then(name => waitAdded[0]([{id: 1, "name": doLayerAdd(name)}])),
			rpc.waitLayerFolderAdd().then(path => waitFolderAdded[0](doLayerFolderAdd(path))),
			rpc.waitLayerMove().then(({from, to, position}) => {
				doLayerMove(from, to, position);
				waitLayerPositionChange[0]({from, to, position});
			}),
			rpc.waitLayerRename().then(lr => {
				doLayerRename(lr["path"], lr["name"]);
				waitLayerRename[0](lr);
			}),
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
			}),
			rpc.waitTokenAdd().then(({path, token}) => doTokenAdd(path, token)(token.id)),
			rpc.waitTokenMoveLayerPos().then(({id, to, newPos}) => doTokenMoveLayerPos(id, to, newPos)),
			rpc.waitTokenSet().then(doTokenSet),
			rpc.waitTokenRemove().then(doTokenRemove),
			rpc.waitLayerShift().then(({path, dx, dy}) => doLayerShift(path, dx, dy)),
			rpc.waitLightShift().then(pos => doLightShift(pos.x, pos.y)),
			rpc.waitWallAdded().then(doWallAdd),
			rpc.waitWallRemoved().then(doWallRemove),
			rpc.waitTokenLightChange().then(({id, lightColour, lightIntensity}) => doTokenLightChange(id, lightColour, lightIntensity)),
			rpc.waitMapDataSet().then(({key, data}) => doMapDataSet(key, data)),
			rpc.waitMapDataRemove().then(key => {
				const oldData = mapData.data[key];
				if (!oldData) {
					return;
				}
				const doIt = (sendRPC = true) => {
					delete mapData.data[key];
					if (sendRPC) {
						rpc.removeMapKeyData(key);
					}
					return () => {
						rpc.setMapKeyData(key, mapData.data[key] = oldData);
						return doIt;
					};
				      };
				undo.add(doIt(false));
			})
		);
		mapLoadedSend(true);
	}));
}
