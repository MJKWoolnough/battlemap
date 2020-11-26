import {Colour, FromTo, IDName, Int, Uint, MapDetails, LayerFolder, LayerMove, LayerRename, TokenSet} from './types.js';
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
				const lp = globals.selected.layer.path,
				      doIt = () => {
					token.x = newX;
					token.y = newY;
					token.rotation = newRotation;
					token.width = newWidth;
					token.height = newHeight;
					token.updateNode();
					if (globals.selected.token === token) {
						tokenMousePos.x = newX;
						tokenMousePos.y = newY;
						tokenMousePos.rotation = newRotation;
						tokenMousePos.width = newWidth;
						tokenMousePos.height = newHeight;
						createSVG(outline, {"--outline-width": newWidth + "px", "--outline-height": newHeight + "px", "transform": token.transformString(false)});
					}
					rpc.setToken({"id": token.id, "x": newX, "y": newY, "width": newWidth, "height": newHeight, "rotation": newRotation});
					return () => {
						token.x = x;
						token.y = y;
						token.rotation = rotation;
						token.width = width;
						token.height = height;
						token.updateNode();
						if (globals.selected.token === token) {
							tokenMousePos.x = x;
							tokenMousePos.y = y;
							tokenMousePos.rotation = rotation;
							tokenMousePos.width = width;
							tokenMousePos.height = height;
							createSVG(outline, {"--outline-width": newWidth + "px", "--outline-height": newHeight + "px", "transform": token.transformString(false)});
						}
						rpc.setToken({"id": token.id, x, y, width, height, rotation});
						return doIt;
					};
				      };
				undo.add(doIt());
			}
		      },
		      tokenMousePos = {mouseX: 0, mouseY: 0, x: 0, y: 0, width: 0, height: 0, rotation: 0},
		      deleteToken = () => {
			const {layer, token} = globals.selected;
			if (!layer || !token) {
				return;
			}
			const pos = layer.tokens.findIndex(t => t == token),
			      l = globals.selected.layer,
			      doIt = () => {
				layer.tokens.splice(pos, 1);
				unselectToken();
				rpc.removeToken(token.id);
				return () => {
					layer.tokens.splice(pos, 0, token);
					rpc.addToken(layer.path, token).then(id => token.id = id);
					return doIt;
				};
			      };
			undo.add(doIt());
		      },
		      unselectToken = () => {
			globals.selected.token = null;
			outline.style.setProperty("display", "none");
			tokenSelected();
		      },
		      removeS = (path: string) => {
			const {layer} = globals.selected;
			if (layer && (layer.path === path || layer.path.startsWith(path + "/"))) {
				globals.selected.layer = null;
				if (globals.selected.token) {
					unselectToken();
				}
			}
			removeLayer(path);
			return rpc.removeLayer(path);
		      },
		      checkLayer = (path: string) => {
			if (globals.selected.layer?.path.startsWith(path)) {
				unselectToken();
				// select new layer???
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
			let charID = 0;
			const token = {"id": 0, "src": 0, "x": 0, "y": 0, "width": 0, "height": 0, "patternWidth": 0, "patternHeight": 0, "stroke": noColour, "strokeWidth": 0, "rotation": 0, "flip": false, "flop": false, "tokenData": {}, "tokenType": 0, "snap": autosnap.value, "lightColour": noColour, "lightIntensity": 0};
			if (e.dataTransfer!.types.includes("character")) {
				const tD = JSON.parse(e.dataTransfer!.getData("character")),
				      char = characterData.get(tD.id)!;
				if (char["store-token-data"]) {
					Object.assign(token, char["store-token-data"].data);
				} else {
					charID = tD.id;
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
			const l = globals.selected.layer,
			      lp = l.path,
			      doIt = () => {
				const sToken = SVGToken.from(token),
				      pos = l.tokens.push(sToken) - 1;
				rpc.addToken(lp, token).then(id => {
					token.id = id;
					globals.tokens[id] = {layer: l, token: sToken};
				});
				return () => {
					if (globals.selected.token === token) {
						unselectToken();
					}
					l.tokens.pop();
					rpc.removeToken(token.id);
					return doIt;
				};
			};
			undo.add(doIt());
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
				deleteToken();
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
			const oldX = tokenMousePos.x,
			      oldY = tokenMousePos.y,
			      doIt = () => {
				token.x = newX;
				token.y = newY;
				token.updateNode();
				if (globals.selected.token === token) {
					tokenMousePos.x = newX;
					tokenMousePos.y = newY;
					outline.setAttribute("transform", token.transformString(false));
				}
				rpc.setToken({"id": token.id, "x": newX, "y": newY, "width": token.width, "height": token.height, "rotation": token.rotation});
				return () => {
					token.x = oldX;
					token.y = oldY;
					token.updateNode();
					if (globals.selected.token === token) {
						tokenMousePos.x = oldX;
						tokenMousePos.y = oldY;
						outline.setAttribute("transform", token.transformString(false));
					}
					rpc.setToken({"id": token.id, "x": oldX, "y": oldY, "width": token.width, "height": token.height, "rotation": token.rotation});
					return doIt;
				};
			      };
			undo.add(doIt());
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
						const doIt = () => {
							currToken.updateNode();
							rpc.setToken({"id": currToken.id, "flip": currToken.flip = !currToken.flip});
							return doIt;
						      };
						undo.add(doIt());
						outline.focus();
					}),
					item(lang["CONTEXT_FLOP"], () => {
						if (!(currToken instanceof SVGToken)) {
							return;
						}
						const doIt = () => {
							currToken.updateNode();
							rpc.setToken({"id": currToken.id, "flop": currToken.flop = !currToken.flop});
							return doIt;
						      };
						undo.add(doIt());
						outline.focus();
					}),
					item(currToken.isPattern ? lang["CONTEXT_SET_IMAGE"] : lang["CONTEXT_SET_PATTERN"], () => {
						if (!(currToken instanceof SVGToken)) {
							return;
						}
						const isPattern = currToken.isPattern,
						      doIt = () => {
							currToken.setPattern(!isPattern);
							if (isPattern) {
								rpc.setToken({"id": currToken.id, "patternWidth": 0, "patternHeight": 0});
							} else {
								rpc.setToken({"id": currToken.id, "patternWidth": currToken.width, "patternHeight": currToken.height});
							}
							return () => {
								currToken.setPattern(isPattern);
								if (isPattern) {
									rpc.setToken({"id": currToken.id, "patternWidth": currToken.width, "patternHeight": currToken.height});
								} else {
									rpc.setToken({"id": currToken.id, "patternWidth": 0, "patternHeight": 0});
								}
								return doIt;
							};
						      };
						undo.add(doIt());
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
							const doIt = () => {
								createSVG(currToken.node, {"width": currToken.width = newWidth, "height": currToken.height = newHeight});
								currToken.x = newX;
								currToken.y = newY;
								currToken.rotation = newRotation;
								currToken.updateNode();
								if (globals.selected.token === currToken) {
									tokenMousePos.x = newX;
									tokenMousePos.y = newY;
									tokenMousePos.rotation = newRotation;
									createSVG(outline, {"--outline-width": (tokenMousePos.width = newWidth) + "px", "--outline-height": (tokenMousePos.height = newHeight) + "px", "transform": currToken.transformString(false)});
								}
								rpc.setToken({"id": currToken.id, "x": newX, "y": newY, "width": newWidth, "height": newHeight, "rotation": newRotation, "snap": currToken.snap = !snap});
								return () => {
									createSVG(currToken.node, {"width": currToken.width = width, "height": currToken.height = height});
									currToken.x = x;
									currToken.y = y;
									currToken.rotation = rotation;
									currToken.updateNode();
									if (globals.selected.token === currToken) {
										tokenMousePos.x = x;
										tokenMousePos.y = y;
										tokenMousePos.rotation = rotation;
										createSVG(outline, {"--outline-width": (tokenMousePos.width = width) + "px", "--outline-height": (tokenMousePos.height = height) + "px", "transform": currToken.transformString(false)});
									}
									rpc.setToken({"id": currToken.id, x, y, width, height, rotation, "snap": currToken.snap = snap});
									return doIt;
								};
							};
							undo.add(doIt());
							return;
						}
					}
					const doIt = () => {
						rpc.setToken({"id": currToken.id, "snap": currToken.snap = !snap});
						return () => {
							rpc.setToken({"id": currToken.id, "snap": currToken.snap = snap});
							return doIt;
						};
					      };
					undo.add(doIt());
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
						const currLayer = globals.tokens[currToken.id].layer,
						      newPos = currLayer.tokens.length - 1,
						      doIt = () => {
							currLayer.tokens.push(currLayer.tokens.splice(tokenPos, 1)[0]);
							rpc.setTokenPos(currToken.id, newPos);
							return () => {
								currLayer.tokens.splice(tokenPos, 0, currLayer.tokens.pop()!);
								rpc.setTokenPos(currToken.id, tokenPos);
								return doIt;
							};
						      };
						undo.add(doIt());
					}),
					item(lang["CONTEXT_MOVE_UP"], () => {
						if (!globals.tokens[currToken.id]) {
							return;
						}
						const currLayer = globals.tokens[currToken.id].layer,
						      tokenPos = currLayer.tokens.findIndex(t => t === currToken);
						if (tokenPos < currLayer.tokens.length - 1) {
							const doIt = () => {
								currLayer.tokens.splice(tokenPos + 1, 0, currLayer.tokens.splice(tokenPos, 1)[0]);
								rpc.setTokenPos(currToken.id, tokenPos + 1);
								return () => {
									currLayer.tokens.splice(tokenPos, 0, currLayer.tokens.splice(tokenPos + 1, 1)[0]);
									rpc.setTokenPos(currToken.id, tokenPos);
									return doIt;
								};
							      };
							undo.add(doIt());
						}
					})
				] : [],
				tokenPos > 0 ? [
					item(lang["CONTEXT_MOVE_DOWN"], () => {
						if (!globals.tokens[currToken.id]) {
							return;
						}
						const currLayer = globals.tokens[currToken.id].layer,
						      tokenPos = currLayer.tokens.findIndex(t => t === currToken);
						if (tokenPos > 0) {
							const doIt = () => {
								currLayer.tokens.splice(tokenPos - 1, 0, currLayer.tokens.splice(tokenPos, 1)[0]);
								rpc.setTokenPos(currToken.id, tokenPos - 1);
								return () => {
									currLayer.tokens.splice(tokenPos, 0, currLayer.tokens.splice(tokenPos - 1, 1)[0]);
									rpc.setTokenPos(currToken.id, tokenPos);
									return doIt;
								};
							      };
							undo.add(doIt());
						}
					}),
					item(lang["CONTEXT_MOVE_BOTTOM"], () => {
						if (!globals.tokens[currToken.id]) {
							return;
						}
						const currLayer = globals.tokens[currToken.id].layer,
						      tokenPos = currLayer.tokens.findIndex(t => t === currToken),
						      doIt = () => {
							currLayer.tokens.unshift(currLayer.tokens.splice(tokenPos, 1)[0]);
							rpc.setTokenPos(currToken.id, 0);
							return () => {
								currLayer.tokens.splice(tokenPos, 0, currLayer.tokens.shift()!);
								rpc.setTokenPos(currToken.id, tokenPos);
								return doIt;
							};
						      };
						undo.add(doIt());
					})
				] : [],
				menu(lang["CONTEXT_MOVE_LAYER"], makeLayerContext(layerList, (sl: SVGLayer) => {
					if (!globals.tokens[currToken.id]) {
						return;
					}
					const currLayer = globals.tokens[currToken.id].layer,
					      tokenPos = currLayer.tokens.findIndex(t => t === currToken),
					      doIt = () => {
						if (globals.selected.token === currToken) {
							unselectToken();
						}
						sl.tokens.push(currLayer.tokens.splice(tokenPos, 1)[0]);
						rpc.setTokenLayer(currToken.id, sl.path);
						globals.tokens[currToken.id].layer = sl;
						return () => {
							if (globals.selected.token === currToken) {
								unselectToken();
							}
							currLayer.tokens.splice(tokenPos, 0, sl.tokens.pop()!);
							rpc.setTokenLayer(currToken.id, currLayer.path).then(() => rpc.setTokenPos(currToken.id, tokenPos));
							globals.tokens[currToken.id].layer = currLayer;
							return doIt;
						};
					      };
					undo.add(doIt());
				}, currLayer.name)),
				item(lang["CONTEXT_DELETE"], deleteToken)
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
			"createFolder": (path: string) => rpc.addLayerFolder(path).then(newPath => {
				const undoIt = () => {
					removeS(newPath);
					waitFolderRemoved[0](newPath);
					return () => {
						addLayerFolder(newPath);
						waitFolderAdded[0](newPath);
						rpc.addLayerFolder(path);
						return undoIt;
					};
				      };
				undo.add(undoIt);
				return addLayerFolder(newPath);
			}),
			"move": invalidRPC,
			"moveFolder": invalidRPC,
			"renameLayer": (path: string, name: string) => rpc.renameLayer(path, name).then(({name}) => {
				const [parentPath, oldName] = splitAfterLastSlash(path),
				      newPath = parentPath + "/" + name,
				      undoIt = () => {
					rpc.renameLayer(newPath, oldName);
					renameLayer(newPath, oldName);
					waitLayerRename[0]({"path": newPath, "name": oldName});
					return () => {
						rpc.renameLayer(path, name);
						renameLayer(path, name);
						waitLayerRename[0]({path, name});
						return undoIt;
					};
				      };
				undo.add(undoIt);
				return renameLayer(path, name);
			}),
			"remove": path => {
				undo.clear();
				return removeS(path);
			},
			"removeFolder": path => {
				undo.clear();
				return removeS(path);
			},
			"link": invalidRPC,
			"newLayer": (name: string) => rpc.addLayer(name).then(name => {
				const path = "/" + name,
				      undoIt = () => {
					removeS(path);
					waitRemoved[0](path);
					return () => {
						addLayer(name);
						waitAdded[0]([{id: 1, name}]);
						rpc.addLayer(name);
						return undoIt;
					};
				};
				undo.add(undoIt);
				return addLayer(name);
			}),
			"setVisibility": (path: string, visibility: boolean) => {
				const undoIt = () => {
					checkLayer(path);
					setLayerVisibility(path, !visibility);
					if (visibility) {
						rpc.hideLayer(path);
						waitLayerHide[0](path);
					} else {
						rpc.showLayer(path);
						waitLayerShow[0](path);
					}
					return () => {
						checkLayer(path);
						setLayerVisibility(path, visibility);
						if (!visibility) {
							rpc.hideLayer(path);
							waitLayerHide[0](path);
						} else {
							rpc.showLayer(path);
							waitLayerShow[0](path);
						}
						return undoIt;
					};
				      };
				undo.add(undoIt);
				setLayerVisibility(path, visibility);
				checkLayer(path);
				return (visibility ? rpc.showLayer : rpc.hideLayer)(path);
			},
			"setLayer": (path: string) => {
				globals.selected.layer = getLayer(path) as SVGLayer;
				unselectToken();
			},
			"setLayerMask": (path: string) => {},
			"moveLayer": (from: string, to: string, position: Uint, oldPos: Uint) => {
				const undoIt = () => {
					unselectToken();
					moveLayer(to, from, oldPos);
					rpc.moveLayer(to, from, oldPos);
					waitLayerPositionChange[0]({
						"from": to,
						"to": from,
						"position": oldPos
					});
					return () => {
						unselectToken();
						moveLayer(from, to, position);
						rpc.moveLayer(from, to, position);
						waitLayerPositionChange[0]({
							to,
							from,
							position
						});
						return undoIt;
					};
				      };
				undo.add(undoIt);
				unselectToken();
				moveLayer(from, to, position);
				return rpc.moveLayer(from, to, position);
			},
			"getMapDetails": () => mapData,
			"setMapDetails": (details: MapDetails) => {
				const oldDetails = {"width": mapData.width, "height": mapData.height, "gridSize": mapData.gridSize, "gridStroke": mapData.gridStroke, "gridColour": mapData.gridColour},
				      undoIt = () => {
					rpc.setMapDetails(setMapDetails(oldDetails))
					return () => {
						rpc.setMapDetails(setMapDetails(details))
						return undoIt;
					};
				      };
				undo.add(undoIt);
				return rpc.setMapDetails(setMapDetails(details))
			},
			"getLightColour": () => mapData.lightColour,
			"setLightColour": (c: Colour) => {
				const oldColour = mapData.lightColour,
				      undoIt = () => {
					rpc.setLightColour(setLightColour(oldColour))
					return () => {
						rpc.setLightColour(setLightColour(c))
						return undoIt;
					};
				      };
				undo.add(undoIt);
				return rpc.setLightColour(setLightColour(c))
			},
		});
		canceller = Subscription.canceller(
			rpc.waitMapChange().then(details => {
				const oldDetails = {"width": mapData.width, "height": mapData.height, "gridSize": mapData.gridSize, "gridStroke": mapData.gridStroke, "gridColour": mapData.gridColour},
				      undoIt = () => {
					rpc.setMapDetails(setMapDetails(oldDetails))
					return () => {
						rpc.setMapDetails(setMapDetails(details))
						return undoIt;
					};
				      };
				undo.add(undoIt);
				setMapDetails(details);
			}),
			rpc.waitMapLightChange().then(c => {
				const oldColour = mapData.lightColour,
				      undoIt = () => {
					rpc.setLightColour(setLightColour(oldColour))
					return () => {
						rpc.setLightColour(setLightColour(c))
						return undoIt;
					};
				      };
				undo.add(undoIt);
				setLightColour(c);
			}),
			rpc.waitLayerShow().then(path => {
				setLayerVisibility(path, true);
				waitLayerShow[0](path);
				const undoIt = () => {
					setLayerVisibility(path, false);
					waitLayerHide[0](path);
					checkLayer(path);
					rpc.hideLayer(path);
					return () => {
						setLayerVisibility(path, true);
						waitLayerShow[0](path);
						rpc.showLayer(path);
						return undoIt;
					};
				      };
				undo.add(undoIt);
			}),
			rpc.waitLayerHide().then(path => {
				setLayerVisibility(path, false);
				waitLayerHide[0](path);
				checkLayer(path);
				const undoIt = () => {
					setLayerVisibility(path, true);
					waitLayerShow[0](path);
					rpc.showLayer(path);
					return () => {
						setLayerVisibility(path, false);
						waitLayerHide[0](path);
						checkLayer(path);
						rpc.hideLayer(path);
						return undoIt;
					};
				      };
				undo.add(undoIt);
			}),
			rpc.waitLayerAdd().then(name => {
				addLayer(name);
				waitAdded[0]([{id: 1, name}]);
				const path = "/" + name,
				      undoIt = () => {
					removeLayer(path);
					checkLayer(path);
					waitRemoved[0](path);
					return () => {
						addLayer(name);
						waitAdded[0]([{id: 1, name}]);
						return undoIt;
					};
				};
				undo.add(undoIt);
			}),
			rpc.waitLayerFolderAdd().then(name => {
				addLayerFolder(name);
				waitFolderAdded[0](name);
				const path = "/" + name,
				      undoIt = () => {
					removeLayer(path);
					checkLayer(path);
					waitFolderRemoved[0](path);
					return () => {
						addLayer(name);
						waitFolderAdded[0](name);
						return undoIt;
					};
				};
				undo.add(undoIt);
			}),
			rpc.waitLayerMove().then(({from, to, position}) => {
				const [parent, layer] = getParentLayer(from);
				if (!parent || !layer) {
					handleError("Invalid layer move");
					return;
				}
				const oldPos = parent.children.indexOf(layer),
				      undoIt = () => {
					unselectToken();
					moveLayer(to, from, oldPos);
					rpc.moveLayer(to, from, oldPos);
					waitLayerPositionChange[0]({
						"from": to,
						"to": from,
						"position": oldPos
					});
					return () => {
						unselectToken();
						moveLayer(from, to, position);
						rpc.moveLayer(from, to, position);
						waitLayerPositionChange[0]({
							to,
							from,
							position
						});
						return undoIt;
					};
				      };
				undo.add(undoIt);
				unselectToken();
				moveLayer(from, to, position);
			}),
			rpc.waitLayerRename().then(lr => {
				const [parentPath, oldName] = splitAfterLastSlash(lr.path),
				      newPath = parentPath + "/" + name,
				      undoIt = () => {
					waitLayerRename[0]({"path": lr.path, "name": oldName});
					renameLayer(newPath, oldName);
					rpc.renameLayer(newPath, oldName);
					return () => {
						waitLayerRename[0](lr);
						renameLayer(lr.path, lr.name);
						rpc.renameLayer(lr.path, lr.name);
						return undoIt;
					};
				      };
				undo.add(undoIt);
				waitLayerRename[0](lr);
				return renameLayer(lr.path, lr.name);
			}),
			rpc.waitLayerRemove().then(removeLayer),
			rpc.waitTokenAdd().then(tk => {
				const layer = getLayer(tk.path),
				      path = tk.path;
				if (!layer || !isSVGLayer(layer)) {
					// error
					return;
				}
				delete tk["path"];
				const token = (isTokenImage(tk.token) ? SVGToken : isTokenDrawing(tk.token) ? SVGDrawing : SVGShape.from(tk.token)).from(tk.token),
				      undoIt = () => {
					if (token === globals.selected.token) {
						unselectToken();
					}
					layer.tokens.pop();
					rpc.removeToken(token.id);
					return () => {
						rpc.addToken(path, tk.token).then(id => {
							token.id = id;
							layer.tokens.push(token);
						});
						return undoIt;
					};
				      };
				layer.tokens.push(token);
				undo.add(undoIt);
			}),
			rpc.waitTokenMoveLayer().then(tm => {
				const {layer, token} = globals.tokens[tm.id];
				if (token instanceof SVGToken) {
					const newParent = getLayer(tm.to);
					if (newParent && isSVGLayer(newParent)) {
						newParent.tokens.push(layer.tokens.splice(layer.tokens.findIndex(t => t === token), 1)[0]);
						globals.tokens[tm.id].layer = newParent;
						if (token.lightColour.a > 0 && token.lightIntensity > 0) {
							updateLight();
						}
					}
				}
			}),
			rpc.waitTokenSet().then(ts => {
				const {token} = globals.tokens[ts.id];
				if (!token) {
					return;
				}
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
			}),
			rpc.waitTokenRemove().then(tk => {
				const {layer, token} = globals.tokens[tk];
				layer.tokens.splice(layer.tokens.findIndex(t => t === token), 1)[0];
				if (token instanceof SVGToken) {
					token.cleanup();
					if (token.lightColour.a > 0 && token.lightIntensity > 0) {
						updateLight();
					}
				}
			}),
			rpc.waitTokenMovePos().then(to => {
				const {layer, token} = globals.tokens[to.id];
				if (layer && token) {
					layer.tokens.splice(to.newPos, 0, layer.tokens.splice(layer.tokens.findIndex(t => t === token), 1)[0])
					if (token.lightColour.a > 0 && token.lightIntensity > 0) {
						updateLight();
					}
				}
			}),
			rpc.waitLayerShift().then(ls => {
				const layer = getLayer(ls.path);
				if (!layer || !isSVGLayer(layer)) {
					// error
					return;
				}
				(layer.tokens as (SVGToken | SVGShape)[]).forEach(t => {
					t.x += ls.dx;
					t.y += ls.dy;
					t.updateNode();
				});
				layer.walls.forEach(w => {
					w.x1 += ls.dx;
					w.y1 += ls.dy;
					w.x2 += ls.dx;
					w.y2 += ls.dy;
				});
				updateLight();
			}),
			rpc.waitLightShift().then(pos => {
				mapData.lightX = pos.x;
				mapData.lightY = pos.y;
				updateLight();
			}),
			rpc.waitWallAdded().then(w => {
				const layer = getLayer(w.path);
				if (!layer || !isSVGLayer(layer)) {
					// error
					return;
				}
				delete w.path;
				layer.walls.push(normaliseWall(w));
				updateLight();
			}),
			rpc.waitWallRemoved().then(wp => {
				const {layer, wall} = globals.walls[wp];
				layer.walls.splice(layer.walls.findIndex(w => w === wall), 1);
				updateLight();
			}),
			rpc.waitTokenLightChange().then(lc => {
				const {token} = globals.tokens[lc.id];
				if (token instanceof SVGToken) {
					token.lightColour = lc.lightColour;
					token.lightIntensity = lc.lightIntensity;
					updateLight();
				}
			}),
			rpc.waitMapDataSet().then(kd => {
				mapData.data[kd.key] = kd.data;
			}),
			rpc.waitMapDataRemove().then(key => {
				delete mapData.data[key];
			}),
			rpc.waitTokenSet().then(ts => {
				undo.clear();
			}),
			rpc.waitLayerRemove().then(path => {
				checkLayer(path);
				const layer = getLayer(path);
				if (!layer) {
					handleError("Invalid layer remove");
					return;
				}
				(isSVGFolder(layer) ? waitFolderRemoved : waitRemoved)[0](path);
				undo.clear();
			}),
			rpc.waitLayerShift().then(ls => {
				const layer = getLayer(ls.path);
				if (!layer || !isSVGLayer(layer)) {
					// error
					return;
				}
				const undoIt = () => {
					(layer.tokens as (SVGToken | SVGShape)[]).forEach(t => {
						t.x -= ls.dx;
						t.y -= ls.dy;
						t.updateNode();
					});
					rpc.shiftLayer(ls.path, -ls.dx, -ls.dy);
					return () => {
						(layer.tokens as (SVGToken | SVGShape)[]).forEach(t => {
							t.x += ls.dx;
							t.y += ls.dy;
							t.updateNode();
						});
						rpc.shiftLayer(ls.path, ls.dx, ls.dy);
						return undoIt;
					};
				};
				undo.add(undoIt);
			}),
			...([
				rpc.waitTokenRemove,
				rpc.waitTokenMoveLayer,
				rpc.waitTokenMovePos,
			] as (() => Subscription<any>)[]).map(p => p().then(() => undo.clear()))
		);
		mapLoadedSend(true);
	}));
}
