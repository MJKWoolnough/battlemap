import {Colour, FromTo, IDName, Int, Uint, RPC, MapDetails, LayerFolder, LayerRPC, LayerMove, Token} from './types.js';
import {Subscription} from './lib/inter.js';
import {autoFocus, clearElement} from './lib/dom.js';
import {createSVG, g, rect} from './lib/svg.js';
import {SortNode} from './lib/ordered.js';
import place, {item, menu, List} from './lib/context.js';
import {ShellElement} from './windows.js';
import {SVGLayer, SVGFolder, SVGToken, SVGShape, addLayer, addLayerFolder, getLayer, isSVGFolder, isSVGLayer, removeLayer, renameLayer, setLayerVisibility, moveLayer, setMapDetails, setLightColour, globals, mapView, walkFolders, isTokenImage, isTokenDrawing} from './map.js';
import {edit as tokenEdit, characterData, tokenData} from './characters.js';
import {autosnap} from './settings.js';
import Undo from './undo.js';
import {toolTokenMouseDown, toolTokenContext, toolTokenWheel, toolTokenMouseOver} from './tools.js';
import {mapLayersSend, mapLoadReceive, noColour, handleError, screen2Grid} from './misc.js';
import {panZoom} from './tools_default.js';

const makeLayerContext = (folder: SVGFolder, fn: (sl: SVGLayer, path: string) => void, disabled = "", path = "/"): List => (folder.children as SortNode<SVGFolder | SVGLayer>).map(e => e.id < 0 ? [] : isSVGFolder(e) ? menu(e.name, makeLayerContext(e, fn, disabled, path + e.name + "/")) : item(e.name, () => fn(e, path + e.name), {"disabled": e.name === disabled})),
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
      waitFolderMoved = subFn<FromTo>(),
      waitFolderRemoved = subFn<string>(),
      waitLayerPositionChange = subFn<LayerMove>(),
      invalidRPC = () => Promise.reject("invalid");

export const getToken = () => {
	const {selectedToken} = globals;
	if (selectedToken instanceof SVGToken) {
		const {src, width, height, patternWidth, patternHeight, rotation, flip, flop, tokenData, snap} = selectedToken;
		return {src, width, height, patternWidth, patternHeight, rotation, flip, flop, tokenData, snap};
	}
	return undefined;
};

export default function(rpc: RPC, shell: ShellElement, oldBase: HTMLElement) {
	let canceller = () => {};
	mapLoadReceive(mapID => rpc.getMapData(mapID).then(mapData => {
		canceller();
		globals.selectedToken = null;
		let tokenDragX = 0, tokenDragY = 0, tokenDragMode = 0;
		const [base, cancel] = mapView(rpc, oldBase, mapData),
		      {root, definitions, layerList} = globals,
		      undo = new Undo(),
		      getSelectedTokenPos = () => (globals.selectedLayer!.tokens as SVGToken[]).findIndex(e => e === globals.selectedToken),
		      tokenDrag = (e: MouseEvent) => {
			let {x, y, width, height, rotation} = tokenMousePos;
			const dx = (e.clientX - tokenMousePos.mouseX) / panZoom.zoom,
			      dy = (e.clientY - tokenMousePos.mouseY) / panZoom.zoom,
			      sq = mapData.gridSize,
			      {selectedToken} = globals;
			switch (tokenDragMode) {
			case 0:
				x += dx;
				y += dy;
				if (selectedToken!.snap) {
					x = Math.round(x / sq) * sq;
					y = Math.round(y / sq) * sq;
				}
				break;
			case 1: {
				rotation = Math.round(-128 * Math.atan2(panZoom.zoom * (x + width / 2) + panZoom.x - (panZoom.zoom - 1) * mapData.width / 2 - e.clientX, panZoom.zoom * (y + height / 2) + panZoom.y - (panZoom.zoom - 1) * mapData.height / 2 - e.clientY) / Math.PI);
				while (rotation < 0) {
					rotation += 256;
				}
				if (selectedToken!.snap) {
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
			createSVG(selectedToken!.node, {width, height});
			selectedToken!.updateNode();
			createSVG(outline, {"--outline-width": width + "px", "--outline-height": height + "px", "transform": selectedToken!.transformString(false)});
		      },
		      tokenMouseUp = (e: MouseEvent) => {
			const {selectedToken: token} = globals;
			if (!token || e.button !== 0) {
				return;
			}
			document.body.removeEventListener("mousemove", tokenDrag);
			document.body.removeEventListener("mouseup", tokenMouseUp);
			root.style.removeProperty("--outline-cursor");
			const {x, y, width, height, rotation} = tokenMousePos,
			      newX = Math.round(token.x),
			      newY = Math.round(token.y),
			      newRotation = Math.round(token.rotation),
			      newWidth = Math.round(token.width),
			      newHeight = Math.round(token.height);
			if (newX !== x || newY !== y || newWidth !== width || newHeight !== height || newRotation !== rotation) {
				const tokenPos = getSelectedTokenPos(),
				      lp = globals.selectedLayerPath,
				      doIt = () => {
					token.x = newX;
					token.y = newY;
					token.rotation = newRotation;
					token.width = newWidth;
					token.height = newHeight;
					createSVG(token.node, {"width": newWidth, "height": newHeight});
					token.updateNode();
					if (globals.selectedToken === token) {
						tokenMousePos.x = newX;
						tokenMousePos.y = newY;
						tokenMousePos.rotation = newRotation;
						tokenMousePos.width = newWidth;
						tokenMousePos.height = newHeight;
						createSVG(outline, {"--outline-width": newWidth + "px", "--outline-height": newHeight + "px", "transform": token.transformString(false)});
					}
					rpc.setToken(lp, tokenPos, newX, newY, newWidth, newHeight, newRotation).catch(handleError);
					return () => {
						token.x = x;
						token.y = y;
						token.rotation = rotation;
						token.width = width;
						token.height = height;
						createSVG(token.node, {"width": newWidth, "height": newHeight});
						token.updateNode();
						if (globals.selectedToken === token) {
							tokenMousePos.x = x;
							tokenMousePos.y = y;
							tokenMousePos.rotation = rotation;
							tokenMousePos.width = width;
							tokenMousePos.height = height;
							createSVG(outline, {"--outline-width": newWidth + "px", "--outline-height": newHeight + "px", "transform": token.transformString(false)});
						}
						rpc.setToken(lp, tokenPos, x, y, width, height, rotation).catch(handleError);
						return doIt;
					};
				      };
				undo.add(doIt);
			}
		      },
		      tokenMousePos = {mouseX: 0, mouseY: 0, x: 0, y: 0, width: 0, height: 0, rotation: 0},
		      deleteToken = () => {
			const pos = getSelectedTokenPos(),
			      token = globals.selectedToken as SVGToken | SVGShape,
			      l = globals.selectedLayer!,
			      lp = globals.selectedLayerPath,
			      doIt = () => {
				l.tokens.splice(pos, 1);
				unselectToken();
				rpc.removeToken(lp, pos).catch(handleError);
				return () => {
					l.tokens.splice(pos, 0, token);
					rpc.addToken(lp, token).catch(handleError);
					return doIt;
				};
			      };
			undo.add(doIt);
		      },
		      unselectToken = () => {
			globals.selectedToken = null;
			outline.style.setProperty("display", "none");
		      },
		      removeS = (path: string) => {
			removeLayer(path).forEach(e => {
				if (globals.selectedLayer === e) {
					globals.selectedLayer = null;
				} else if (isSVGFolder(e) && walkFolders(e, e => Object.is(e, globals.selectedLayer))) {
				       globals.selectedLayer  = null;
				}
			});
			undo.clear();
			return rpc.removeLayer(path);
		      },
		      checkLayer = (path: string) => {
			if (globals.selectedLayerPath.startsWith(path)) {
				unselectToken();
				// select new layer???
			}
		      },
		      outline = g();
		createSVG(root, {"ondragover": (e: DragEvent) => {
			if (e.dataTransfer && (e.dataTransfer.types.includes("character") || e.dataTransfer.types.includes("imageasset"))) {
				e.preventDefault();
				e.dataTransfer!.dropEffect = "link";
			}
		      }, "ondrop": (e: DragEvent) => {
			if (globals.selectedLayer === null) {
				return;
			}
			let charID = 0;
			const token = {"src": 0, "x": 0, "y": 0, "width": 0, "height": 0, "patternWidth": 0, "patternHeight": 0, "stroke": noColour, "strokeWidth": 0, "rotation": 0, "flip": false, "flop": false, "tokenData": 0, "tokenType": 0, "snap": autosnap.value};
			if (e.dataTransfer!.types.includes("character")) {
				const tD = JSON.parse(e.dataTransfer!.getData("character")),
				      char = characterData.get(tD.id)!;
				if (char["token-data"]) {
					Object.assign(token, char["token-data"].data);
				} else {
					charID = tD.id;
					token.src = parseInt(char["store-image-icon"].data);
					token.width = tD.width;
					token.height = tD.height;
				}
				if (char["store-token-id"]) {
					token.tokenData = char["store-token-id"].data;
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
			const l = globals.selectedLayer,
			      lp = globals.selectedLayerPath,
			      doIt = () => {
				const pos = l.tokens.push(SVGToken.from(token)) - 1;
				let p: Promise<any> = rpc.addToken(lp, token);
				if (token.tokenData) {
					p = p.then(id => {
						tokenData.set(id, JSON.parse(JSON.stringify(tokenData.get(token.tokenData)!)));
						token.tokenData = id;
					});
				}
				if (charID) {
					p = p.then(() => rpc.tokenCreate(lp, pos))
					.then(id => {
						const data = {"store-character-id": {"user": false, "data": charID}};
						tokenData.set(token.tokenData = id, data);
						rpc.tokenSet(id, data)
					})
				}
				p.catch(handleError);
				return () => {
					if (globals.selectedToken === token) {
						unselectToken();
					}
					l.tokens.pop();
					rpc.removeToken(lp, pos).catch(handleError);
					return doIt;
				};
			};
			undo.add(doIt);
		      }, "onmousedown": (e: MouseEvent) => {
			const {selectedLayer} = globals;
			if (!selectedLayer || e.button !== 0) {
				return;
			}
			const newToken = (selectedLayer.tokens as (SVGToken | SVGShape)[]).reduce((old, t) => t.at(e.clientX, e.clientY) ? t : old, null as SVGToken | SVGShape | null);
			if (!e.ctrlKey) {
				unselectToken();
			}
			if (!newToken || e.ctrlKey) {
				return;
			}
			globals.selectedToken = newToken;
			autoFocus(createSVG(outline, {"transform": newToken.transformString(false), "style": `--outline-width: ${newToken.width}px; --outline-height: ${newToken.height}px`, "--zoom": panZoom.zoom, "class": `cursor_${((newToken.rotation + 143) >> 5) % 4}`}));
			tokenMousePos.x = newToken.x;
			tokenMousePos.y = newToken.y;
			tokenMousePos.width = newToken.width;
			tokenMousePos.height = newToken.height;
			tokenMousePos.rotation = newToken.rotation;
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
			const {selectedToken: token} = globals;
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
			      tokenPos = getSelectedTokenPos(),
			      lp = globals.selectedLayerPath,
			      doIt = () => {
				token.x = newX;
				token.y = newY;
				token.updateNode();
				if (globals.selectedToken === token) {
					tokenMousePos.x = newX;
					tokenMousePos.y = newY;
					outline.setAttribute("transform", token.transformString(false));
				}
				rpc.setToken(lp, tokenPos, newX, newY, token.width, token.height, token.rotation).catch(handleError);
				return () => {
					token.x = oldX;
					token.y = oldY;
					token.updateNode();
					if (globals.selectedToken === token) {
						tokenMousePos.x = oldX;
						tokenMousePos.y = oldY;
						outline.setAttribute("transform", token.transformString(false));
					}
					rpc.setToken(lp, tokenPos, oldX, oldY, token.width, token.height, token.rotation).catch(handleError);
					return doIt;
				};
			      };
			undo.add(doIt);
		      }, "onkeydown": (e: KeyboardEvent) => {
			const {selectedToken} = globals;
			if (!selectedToken || selectedToken.snap) {
				return;
			}
			switch (e.key) {
			case "ArrowUp":
				selectedToken.y--;
				break;
			case "ArrowDown":
				selectedToken.y++;
				break;
			case "ArrowLeft":
				selectedToken.x--;
				break;
			case "ArrowRight":
				selectedToken.x++;
				break;
			default:
				return;
			}
			selectedToken.updateNode();
			outline.setAttribute("transform", selectedToken!.transformString(false));
		      }, "oncontextmenu": function (this: SVGGElement, e: MouseEvent) {
			toolTokenContext.call(this, e);
			if (e.defaultPrevented) {
				return;
			}
			e.preventDefault();
			const tokenPos = getSelectedTokenPos(),
			      currLayerPath = globals.selectedLayerPath,
			      currLayer = globals.selectedLayer!,
			      currToken = globals.selectedToken!;
			place(base, [e.clientX, e.clientY], [
				isTokenImage(currToken) ? [
					currToken.tokenData !== 0 ? item("Edit Token", () => globals.selectedToken === currToken && tokenEdit(shell, rpc, currToken.tokenData, "Edit Token", tokenData.get(currToken.tokenData)!, false)) : [],
					currToken.tokenData === 0 ? item("Set as Token", () => {
						if (globals.selectedToken !== currToken && currToken.tokenData === 0) {
							return;
						}
						rpc.tokenCreate(currLayerPath, getSelectedTokenPos())
						.then(id => tokenData.set(currToken.tokenData = id, {}))
						.catch(handleError);
					}) : item("Unset as Token", () => {
						if (globals.selectedToken !== currToken || currToken.tokenData !== 0) {
							return;
						}
						tokenData.delete(currToken.tokenData);
						currToken.tokenData = 0;
						rpc.tokenDelete(currLayerPath, getSelectedTokenPos()).catch(handleError);
					}),
					item("Flip", () => {
						if (globals.selectedToken !== currToken) {
							return;
						}
						const tokenPos = getSelectedTokenPos(),
						      flip = !currToken.flip,
						      doIt = () => {
							currToken.flip = flip;
							currToken.updateNode();
							rpc.flipToken(currLayerPath, tokenPos, flip).catch(handleError);
							return () => {
								currToken.flip = !flip;
								currToken.updateNode();
								rpc.flipToken(currLayerPath, tokenPos, !flip).catch(handleError);
								return doIt;
							};
						      };
						undo.add(doIt);
						outline.focus();
					}),
					item("Flop", () => {
						if (globals.selectedToken !== currToken) {
							return;
						}
						const tokenPos = getSelectedTokenPos(),
						      flop = !currToken.flop,
						      doIt = () => {
							currToken.flop = flop;
							currToken.updateNode();
							rpc.flopToken(currLayerPath, tokenPos, flop).catch(handleError);
							return () => {
								currToken.flop = !flop;
								currToken.updateNode();
								rpc.flopToken(currLayerPath, tokenPos, !flop).catch(handleError);
								return doIt;
							};
						      };
						undo.add(doIt);
						outline.focus();
					}),
					item(`Set as ${currToken.isPattern ? "Image" : "Pattern"}`, () => {
						if (globals.selectedToken !== currToken || !(currToken instanceof SVGToken)) {
							return;
						}
						const tokenPos = getSelectedTokenPos(),
						      isPattern = currToken.isPattern,
						      doIt = () => {
							currToken.setPattern(!isPattern);
							(isPattern ? rpc.setTokenPattern : rpc.setTokenImage)(currLayerPath, tokenPos).catch(handleError);
							return () => {
								currToken.setPattern(!isPattern);
								(isPattern ? rpc.setTokenImage : rpc.setTokenPattern)(currLayerPath, tokenPos).catch(handleError);
								return doIt;
							};
						      };
						undo.add(doIt);
					}),
				] : [],
				item(currToken.snap ? "Unsnap" : "Snap", () => {
					if (globals.selectedToken !== currToken) {
						return;
					}
					const tokenPos = getSelectedTokenPos(),
					      snap = currToken.snap,
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
								if (globals.selectedToken === currToken) {
									tokenMousePos.x = newX;
									tokenMousePos.y = newY;
									tokenMousePos.rotation = newRotation;
									createSVG(outline, {"--outline-width": (tokenMousePos.width = newWidth) + "px", "--outline-height": (tokenMousePos.height = newHeight) + "px", "transform": currToken.transformString(false)});
								}
								rpc.setTokenSnap(currLayerPath, tokenPos, currToken.snap = !snap).catch(handleError);
								rpc.setToken(currLayerPath, tokenPos, newX, newY, newWidth, newHeight, newRotation).catch(handleError);
								return () => {
									createSVG(currToken.node, {"width": currToken.width = width, "height": currToken.height = height});
									currToken.x = x;
									currToken.y = y;
									currToken.rotation = rotation;
									currToken.updateNode();
									if (globals.selectedToken === currToken) {
										tokenMousePos.x = x;
										tokenMousePos.y = y;
										tokenMousePos.rotation = rotation;
										createSVG(outline, {"--outline-width": (tokenMousePos.width = width) + "px", "--outline-height": (tokenMousePos.height = height) + "px", "transform": currToken.transformString(false)});
									}
									rpc.setTokenSnap(currLayerPath, tokenPos, currToken.snap = snap).catch(handleError);
									rpc.setToken(currLayerPath, tokenPos, x, y, width, height, rotation).catch(handleError);
									return doIt;
								};
							};
							undo.add(doIt);
							return;
						}
					}
					const doIt = () => {
						rpc.setTokenSnap(currLayerPath, tokenPos, currToken.snap = !snap).catch(handleError);
						return () => {
							rpc.setTokenSnap(currLayerPath, tokenPos, currToken.snap = snap).catch(handleError);
							return doIt;
						};
					      };
					undo.add(doIt);
				}),
				tokenPos < currLayer.tokens.length - 1 ? [
					item(`Move to Top`, () => {
						if (globals.selectedToken !== currToken) {
							return;
						}
						const tokenPos = getSelectedTokenPos(),
						      newPos = currLayer.tokens.length - 1,
						      doIt = () => {
							currLayer.tokens.push(currLayer.tokens.splice(tokenPos, 1)[0]);
							rpc.setTokenPos(currLayerPath, tokenPos, newPos).catch(handleError);
							return () => {
								currLayer.tokens.splice(tokenPos, 0, currLayer.tokens.pop()!);
								rpc.setTokenPos(currLayerPath, newPos, tokenPos).catch(handleError);
								return doIt;
							};
						      };
						undo.add(doIt);
					}),
					item(`Move Up`, () => {
						if (globals.selectedToken !== currToken) {
							return;
						}
						const tokenPos = getSelectedTokenPos();
						if (tokenPos < currLayer.tokens.length - 1) {
							const doIt = () => {
								currLayer.tokens.splice(tokenPos + 1, 0, currLayer.tokens.splice(tokenPos, 1)[0]);
								rpc.setTokenPos(currLayerPath, tokenPos, tokenPos + 1).catch(handleError);
								return () => {
									currLayer.tokens.splice(tokenPos, 0, currLayer.tokens.splice(tokenPos + 1, 1)[0]);
									rpc.setTokenPos(currLayerPath, tokenPos + 1, tokenPos).catch(handleError);
									return doIt;
								};
							      };
							undo.add(doIt);
						}
					})
				] : [],
				tokenPos > 0 ? [
					item(`Move Down`, () => {
						if (globals.selectedToken !== currToken) {
							return;
						}
						const tokenPos = getSelectedTokenPos();
						if (tokenPos > 0) {
							const doIt = () => {
								currLayer.tokens.splice(tokenPos - 1, 0, currLayer.tokens.splice(tokenPos, 1)[0]);
								rpc.setTokenPos(currLayerPath, tokenPos, tokenPos - 1).catch(handleError);
								return () => {
									currLayer.tokens.splice(tokenPos, 0, currLayer.tokens.splice(tokenPos - 1, 1)[0]);
									rpc.setTokenPos(currLayerPath, tokenPos - 1, tokenPos).catch(handleError);
									return doIt;
								};
							      };
							undo.add(doIt);
						}
					}),
					item(`Move to Bottom`, () => {
						if (globals.selectedToken !== currToken) {
							return;
						}
						const tokenPos = getSelectedTokenPos(),
						      doIt = () => {
							currLayer.tokens.unshift(currLayer.tokens.splice(tokenPos, 1)[0]);
							rpc.setTokenPos(currLayerPath, tokenPos, 0).catch(handleError);
							return () => {
								currLayer.tokens.splice(tokenPos, 0, currLayer.tokens.shift()!);
								rpc.setTokenPos(currLayerPath, 0, tokenPos).catch(handleError);
								return doIt;
							};
						      };
						undo.add(doIt);
					})
				] : [],
				menu("Move To Layer", makeLayerContext(layerList, (sl: SVGLayer, path: string) => {
					if (globals.selectedToken !== currToken) {
						return;
					}
					const tokenPos = getSelectedTokenPos(),
					      doIt = () => {
						if (globals.selectedToken === currToken) {
							unselectToken();
						}
						sl.tokens.push(currLayer.tokens.splice(tokenPos, 1)[0]);
						rpc.setTokenLayer(currLayerPath, tokenPos, path).catch(handleError);
						return () => {
							if (globals.selectedToken === currToken) {
								unselectToken();
							}
							currLayer.tokens.splice(tokenPos, 0, sl.tokens.pop()!);
							rpc.setTokenLayer(path, sl.tokens.length, currLayerPath).then(() => rpc.setTokenPos(path, currLayer.tokens.length - 1, tokenPos)).catch(handleError);
							return doIt;
						};
					      };
					undo.add(doIt);
				}, currLayer.name)),
				item("Delete", deleteToken)
			]);
		}, "onwheel": toolTokenWheel}, Array.from({length: 10}, (_, n) => rect({"data-outline": n, "onmouseover": toolTokenMouseOver, "onmousedown": function(this: SVGRectElement, e: MouseEvent) {
			toolTokenMouseDown.call(this, e);
			if (e.defaultPrevented || e.button !== 0 || e.ctrlKey) {
				return;
			}
			e.stopImmediatePropagation();
			document.body.addEventListener("mousemove", tokenDrag);
			document.body.addEventListener("mouseup", tokenMouseUp);
			tokenDragMode = parseInt(this.getAttribute("data-outline")!);
			root.style.setProperty("--outline-cursor", ["move", "cell", "nwse-resize", "ns-resize", "nesw-resize", "ew-resize"][tokenDragMode < 2 ? tokenDragMode : (3.5 - Math.abs(5.5 - tokenDragMode) + ((globals.selectedToken!.rotation + 143) >> 5)) % 4 + 2]);
			tokenMousePos.mouseX = e.clientX;
			tokenMousePos.mouseY = e.clientY;
		      }}))));
		mapLayersSend({
			"waitAdded": () => waitAdded[1],
			"waitMoved": () => waitMoved[1],
			"waitRemoved": () => waitRemoved[1],
			"waitLinked": () => new Subscription<IDName>(() => {}),
			"waitFolderAdded": rpc.waitLayerFolderAdd,
			"waitFolderMoved": () => waitFolderMoved[1],
			"waitFolderRemoved": () => waitFolderRemoved[1],
			"waitLayerSetVisible": rpc.waitLayerShow,
			"waitLayerSetInvisible": rpc.waitLayerHide,
			"waitLayerPositionChange": () => waitLayerPositionChange[1],
			"waitLayerRename": rpc.waitLayerRename,
			"list": () => Promise.resolve(layerList as LayerFolder),
			"createFolder": (path: string) => rpc.addLayerFolder(path).then(addLayerFolder),
			"move": invalidRPC,
			"moveFolder": invalidRPC,
			"renameLayer": (path: string, name: string) => rpc.renameLayer(path, name).then(({name}) => renameLayer(path, name)),
			"remove": removeS,
			"removeFolder": removeS,
			"link": invalidRPC,
			"newLayer": (name: string) => rpc.addLayer(name).then(addLayer),
			"setVisibility": (path: string, visibility: boolean) => {
				const undoIt = () => {
					checkLayer(path);
					setLayerVisibility(path, !visibility);
					(!visibility ? rpc.showLayer : rpc.hideLayer)(path).catch(handleError);
					return () => {
						checkLayer(path);
						setLayerVisibility(path, visibility);
						(visibility ? rpc.showLayer : rpc.hideLayer)(path).catch(handleError);
						return undoIt;
					};
				      };
				undo.add(() => undoIt);
				setLayerVisibility(path, visibility);
				checkLayer(path);
				return (visibility ? rpc.showLayer : rpc.hideLayer)(path);
			},
			"setLayer": (path: string) => {
				globals.selectedLayer = getLayer(layerList, path) as SVGLayer;
				globals.selectedLayerPath = path;
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
				undo.add(() => undoIt);
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
				undo.add(() => undoIt);
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
				undo.add(() => undoIt);
				return rpc.setLightColour(setLightColour(c))
			},
		});
		oldBase = base;
		canceller = Subscription.canceller(
			{cancel},
			rpc.waitTokenChange().then(st => {
				if (st.path === globals.selectedLayerPath && getSelectedTokenPos() === st.pos) {
					tokenMouseUp(new MouseEvent(""));
				}
				undo.clear();
			}),
			rpc.waitLayerAdd().then(name => waitAdded[0]([{id: 1, name}])),
			rpc.waitLayerHide().then(checkLayer),
			rpc.waitLayerMove().then(ml => {
				const layer = getLayer(layerList, ml.to);
				if (!layer) {
					handleError("Invalid layer move");
					return;
				}
				(isSVGFolder(layer) ? waitFolderMoved : waitMoved)[0](ml);
				waitLayerPositionChange[0](ml);
				undo.clear();
			}),
			rpc.waitLayerRemove().then(path => {
				checkLayer(path);
				const layer = getLayer(layerList, path);
				if (!layer) {
					handleError("Invalid layer remove");
					return;
				}
				(isSVGFolder(layer) ? waitFolderRemoved : waitRemoved)[0](path);
				undo.clear();
			}),
			rpc.waitLayerShift().then(ls => {
				const layer = getLayer(layerList, ls.path);
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
				undo.add(() => undoIt);
			}),
			...([
				rpc.waitLayerRename,
				rpc.waitMapLightChange,
				rpc.waitTokenAdd,
				rpc.waitTokenRemove,
				rpc.waitTokenMoveLayer,
				rpc.waitTokenMovePos,
				rpc.waitTokenSetToken,
				rpc.waitTokenSetImage,
				rpc.waitTokenSetPattern,
				rpc.waitTokenFlip,
				rpc.waitTokenFlop,
				rpc.waitTokenSnap,
				rpc.waitTokenSourceChange,
				rpc.waitTokenSetData,
				rpc.waitTokenUnsetData
			] as (() => Subscription<any>)[]).map(p => p().then(() => undo.clear()))
		);
	}));
}
