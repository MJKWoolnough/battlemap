import {Colour, FromTo, IDName, Int, Uint, MapDetails, LayerFolder, LayerMove, LayerRename, TokenSet, Token, WallPath, LayerRPC} from './types.js';
import {Subscription} from './lib/inter.js';
import {autoFocus} from './lib/dom.js';
import {createHTML, br, button, input, h1} from './lib/html.js';
import {createSVG, g, rect} from './lib/svg.js';
import {SortNode} from './lib/ordered.js';
import place, {item, menu, List} from './lib/context.js';
import {windows, shell} from './windows.js';
import {SVGLayer, SVGFolder, SVGToken, SVGShape, SVGDrawing, addLayer, addLayerFolder, getLayer, getParentLayer, isSVGFolder, isSVGLayer, removeLayer, renameLayer, setLayerVisibility, moveLayer, setMapDetails, setLightColour, globals, mapView, isTokenImage, isTokenDrawing, updateLight, normaliseWall, splitAfterLastSlash, screen2Grid, SQRT3, deselectToken} from './map.js';
import {edit as tokenEdit, characterData} from './characters.js';
import {autosnap, measureTokenMove} from './settings.js';
import undo from './undo.js';
import {toolTokenMouseDown, toolTokenContext, toolTokenWheel, toolTokenMouseOver} from './tools.js';
import {startMeasurement, measureDistance, stopMeasurement} from './tools_measure.js';
import {mapLoadReceive, mapLoadedSend, tokenSelected, queue, labels} from './misc.js';
import {makeColourPicker, noColour} from './colours.js';
import {panZoom} from './tools_default.js';
import {tokenContext, tokenDataFilter} from './plugins.js';
import {rpc, handleError} from './rpc.js';
import lang from './language.js';

const subFn = <T>(): [(data: T) => void, Subscription<T>] => {
	let fn: (data: T) => void;
	const sub = new Subscription<T>(resolver => fn = resolver);
	return [fn!, sub];
      },
      unusedWait = new Subscription<any>(() => {}),
      invalidRPC = () => Promise.reject("invalid"),
      waitAdded = subFn<IDName[]>(),
      waitRemoved = subFn<string>(),
      waitFolderAdded = subFn<string>(),
      waitFolderRemoved = subFn<string>(),
      waitLayerShow = subFn<string>(),
      waitLayerHide = subFn<string>(),
      waitLayerPositionChange = subFn<LayerMove>(),
      waitLayerRename = subFn<LayerRename>(),
      removeS = (path: string) => {
	checkSelectedLayer(path);
	removeLayer(path);
	return rpc.removeLayer(path);
      },
      tokenMousePos = {mouseX: 0, mouseY: 0, x: 0, y: 0, width: 0, height: 0, rotation: 0},
      checkSelectedLayer = (path: string) => {
	const {layer} = globals.selected;
	if (layer && (layer.path === path || layer.path.startsWith(path + "/"))) {
		globals.selected.layer = null;
		if (globals.selected.token) {
			deselectToken();
		}
	}
      };

let copiedToken: Token | null = null;

export const getToken = () => {
	const {token} = globals.selected;
	if (token instanceof SVGToken && !token.isPattern) {
		const {src, width, height, patternWidth, patternHeight, rotation, flip, flop, snap, lightColour, lightIntensity} = token,
		      tokenData = JSON.parse(JSON.stringify(token.tokenData));
		for (const f of tokenDataFilter()) {
			delete(tokenData[f]);
		}
		return {src, width, height, patternWidth, patternHeight, rotation, flip, flop, snap, lightColour, lightIntensity, tokenData};
	}
	return undefined;
},
doMapChange = (details: MapDetails, sendRPC = true) => {
	let oldDetails = {"width": globals.mapData.width, "height": globals.mapData.height, "gridType": globals.mapData.gridType, "gridSize": globals.mapData.gridSize, "gridStroke": globals.mapData.gridStroke, "gridColour": globals.mapData.gridColour};
	const doIt = (sendRPC = true) => {
		setMapDetails(details);
		if (sendRPC) {
			queue(rpc.setMapDetails.bind(rpc, details));
		}
		[details, oldDetails] = [oldDetails, details];
		return doIt;
	      };
	undo.add(doIt(sendRPC), lang["UNDO_MAP_CHANGE"]);
      },
doSetLightColour = (c: Colour, sendRPC = true) => {
	let oldColour = globals.mapData.lightColour;
	const doIt = (sendRPC = true) => {
		setLightColour(c);
		if (sendRPC) {
			queue(rpc.setLightColour.bind(rpc, c));
		}
		[c, oldColour] = [oldColour, c];
		return doIt;
	      };
	undo.add(doIt(sendRPC), lang["UNDO_LIGHT_COLOUR"]);
},
doShowHideLayer = (path: string, visibility: boolean, sendRPC = true) => {
	const doIt = (sendRPC = true) => {
		setLayerVisibility(path, visibility);
		if (sendRPC) {
			if (visibility) {
				queue(() => {
					waitLayerShow[0](path);
					return rpc.showLayer(path);
				});
			} else {
				queue(() => {
					waitLayerHide[0](path);
					return rpc.hideLayer(path);
				});
			}
		}
		visibility = !visibility;
		return doIt;
	      };
	undo.add(doIt(sendRPC), lang[visibility ? "UNDO_LAYER_SHOW" : "UNDO_LAYER_HIDE"]);
	return path;
},
doLayerAdd = (name: string, sendRPC = true) => {
	const path = "/" + name,
	      doIt = (sendRPC = true) => {
		addLayer(name);
		if (sendRPC) {
			queue(() => {
				waitAdded[0]([{id: 1, name}]);
				return rpc.addLayer(name);
			});
		}
		return undoIt;
	      },
	      undoIt = () => {
		checkSelectedLayer(path);
		removeLayer(path);
		queue(() => {
			waitRemoved[0](path);
			return rpc.removeLayer(path);
		});
		return doIt;
	      };
	undo.add(doIt(sendRPC), lang["UNDO_LAYER_ADD"]);
	return name;
},
doLayerFolderAdd = (path: string, sendRPC = true) => {
	const doIt = (sendRPC = true) => {
		addLayerFolder(path);
		if (sendRPC) {
			queue(() => {
				waitFolderAdded[0](path);
				return rpc.addLayerFolder(path);
			});
		}
		return undoIt;
	      },
	      undoIt = () => {
		checkSelectedLayer(path);
		removeLayer(path);
		queue(() => {
			waitFolderRemoved[0](path);
			return rpc.removeLayer(path);
		});
		return doIt;
	      };
	undo.add(doIt(sendRPC), lang["UNDO_LAYER_FOLDER_ADD"]);
	return path;
},
doLayerMove = (from: string, to: string, position: Uint, sendRPC = true) => {
	const [parent, layer] = getParentLayer(from);
	if (!parent || !layer) {
		handleError("Invalid layer move");
		return;
	}
	let oldPos = parent.children.indexOf(layer);
	const doIt = (sendRPC = true) => {
		deselectToken();
		moveLayer(from, to, position);
		if (sendRPC) {
			const data = {from, to, position};
			queue(() => {
				waitLayerPositionChange[0](data);
				return rpc.moveLayer(data.from, data.to, data.position);
			});
		}
		[to, from] = [from, to];
		[oldPos, position] = [position, oldPos];
		return doIt;
	      };
	undo.add(doIt(sendRPC), lang["UNDO_LAYER_MOVE"]);
},
doLayerRename = (path: string, name: string, sendRPC = true) => {
	let [parentPath, oldName] = splitAfterLastSlash(path),
	    newPath = parentPath + "/" + oldName;
	const doIt = (sendRPC = true) => {
		renameLayer(path, name);
		if (sendRPC) {
			const data = {path, name}
			queue(() => {
				waitLayerRename[0](data);
				return rpc.renameLayer(data.path, data.name);
			});
		}
		[path, newPath] = [newPath, path];
		[oldName, name] = [name, oldName];
		return doIt;
	      };
	undo.add(doIt(sendRPC), lang["UNDO_LAYER_RENAME"]);
},
doTokenAdd = (path: string, tk: Token, sendRPC = true) => {
	const layer = getLayer(path);
	if (!layer || !isSVGLayer(layer)) {
		handleError("Invalid layer for token add");
		return () => {};
	}
	const token = isTokenImage(tk) ? SVGToken.from(tk) : isTokenDrawing(tk) ? SVGDrawing.from(tk) : SVGShape.from(tk),
	      addToken = (id: Uint) => {
		token.id = id;
		layer.tokens.push(token);
		globals.tokens[id] = {layer, token};
	      },
	      doIt = (sendRPC = true) => {
		if (sendRPC) {
			queue(() => rpc.addToken(path, token).then(addToken));
		}
		return undoIt;
	      },
	      undoIt = () => {
		if (token === globals.selected.token) {
			deselectToken();
		}
		delete globals.tokens[token.id];
		layer.tokens.pop();
		queue(() => rpc.removeToken(token.id));
		return doIt;
	      };
	undo.add(doIt(sendRPC), lang["UNDO_TOKEN_ADD"]);
	return addToken;
},
doTokenMoveLayerPos = (id: Uint, to: string, newPos: Uint, sendRPC = true) => {
	let layer = globals.tokens[id].layer as SVGLayer,
	    newParent = getLayer(to) as SVGLayer;
	const token = globals.tokens[id].token;
	if (!layer || !token || !newParent || !isSVGLayer(newParent)) {
		handleError("Invalid Token Move Layer/Pos");
		return;
	}
	if (newPos > newParent.tokens.length) {
		newPos = newParent.tokens.length;
	}
	let currentPos = layer.tokens.findIndex(t => t === token);
	const doIt = (sendRPC = true) => {
		newParent.tokens.splice(newPos, 0, layer.tokens.splice(currentPos, 1)[0]);
		globals.tokens[id].layer = newParent;
		if (token.lightColour.a > 0 && token.lightIntensity > 0) {
			updateLight();
		}
		if (globals.selected.token === token) {
			deselectToken();
		}
		if (sendRPC) {
			queue(rpc.setTokenLayerPos.bind(rpc, id, newParent.path, newPos));
		}
		[currentPos, newPos] = [newPos, currentPos];
		[layer, newParent] = [newParent, layer];
		return doIt;
	      };
	undo.add(doIt(sendRPC), lang["UNDO_TOKEN_MOVE"]);
},
doTokenSet = (ts: TokenSet, sendRPC = true) => {
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
			(original as Record<string, any>)[k] = (token as Record<string, any>)[k]
		}
	}
	const doIt = (sendRPC = true) => {
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
			queue(rpc.setToken.bind(rpc, ts));
		}
		if (globals.selected.token === token) {
			createSVG(globals.outline, {"--outline-width": token.width + "px", "--outline-height": token.height + "px", "transform": token.transformString(false)})
			tokenMousePos.x = token.x;
			tokenMousePos.y = token.y;
			tokenMousePos.width = token.width;
			tokenMousePos.height = token.height;
			tokenMousePos.rotation = token.rotation;
		}
		[original, ts] = [ts, original];
		return doIt;
	      };
	undo.add(doIt(sendRPC), lang["UNDO_TOKEN_SET"]);
},
doTokenRemove = (tk: Uint, sendRPC = true) => {
	const {layer, token} = globals.tokens[tk];
	if (!token) {
		handleError("invalid token for removal");
		return;
	}
	const pos = layer.tokens.findIndex(t => t === token),
	      doIt = (sendRPC = true) => {
		if (token === globals.selected.token) {
			deselectToken();
		}
		layer.tokens.splice(pos, 1);
		delete globals.tokens[tk];
		if (token instanceof SVGToken) {
			token.cleanup();
			if (token.lightColour.a > 0 && token.lightIntensity > 0) {
				updateLight();
			}
		}
		if (sendRPC) {
			queue(() => rpc.removeToken(token.id));
		}
		return undoIt;
	      },
	      undoIt = () => {
		layer.tokens.splice(pos, 0, token);
		queue(() => rpc.addToken(layer.path, token).then(id => {
			token.id = id;
			globals.tokens[id] = {layer, token};
		}));
		return doIt;
	      };
	undo.add(doIt(sendRPC), lang["UNDO_TOKEN_REMOVE"]);
},
doLayerShift = (path: string, dx: Uint, dy: Uint, sendRPC = true) => {
	const layer = getLayer(path);
	if (!layer || !isSVGLayer(layer)) {
		handleError("invalid layer for shifting");
		return;
	}
	const doIt = (sendRPC = true) => {
		for (const t of layer.tokens) {
			t.x += dx;
			t.y += dy;
			t.updateNode();
		}
		for (const w of layer.walls) {
			w.x1 += dx;
			w.y1 += dy;
			w.x2 += dx;
			w.y2 += dy;
		}
		updateLight();
		if (sendRPC) {
			queue(rpc.shiftLayer.bind(rpc, path, dx, dy));
		}
		dx = -dx;
		dy = -dy;
		return doIt;
	      };
	undo.add(doIt(sendRPC), lang["UNDO_LAYER_SHIFT"]);
},
doLightShift = (x: Uint, y: Uint, sendRPC = true) => {
	let {lightX: oldX, lightY: oldY} = globals.mapData;
	const doIt = (sendRPC = true) => {
		globals.mapData.lightX = x;
		globals.mapData.lightY = y;
		updateLight();
		if (sendRPC) {
			queue(rpc.shiftLight.bind(rpc, x, y));
		}
		[x, oldX] = [oldX, x];
		[y, oldY] = [oldY, y];
		return doIt;
	      };
	undo.add(doIt(sendRPC), lang["UNDO_LIGHT_SHIFT"]);
},
doWallAdd = (w: WallPath, sendRPC = true) => {
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
			queue(() => rpc.addWall(path, x1, y1, x2, y2, colour).then(id => {
				wall.id = id;
				globals.walls[id] = {layer, wall};
			}));
		} else if (w.id > 0) {
			globals.walls[w.id] = {layer, wall};
		}
		return undoIt;
	      },
	      undoIt = () => {
		layer.walls.splice(layer.walls.findIndex(w => w === wall), 1);
		updateLight();
		const id = wall.id;
		queue(() => rpc.removeWall(id));
		delete globals.walls[id];
		wall.id = 0;
		return doIt;
	      };
	undo.add(doIt(sendRPC), lang["UNDO_WALL_ADD"]);
},
doWallRemove = (wID: Uint, sendRPC = true) => {
	const {layer, wall} = globals.walls[wID];
	if (!layer || !wall) {
		handleError("invalid wall to remove");
		return;
	}
	const doIt = (sendRPC = true) => {
		layer.walls.splice(layer.walls.findIndex(w => w === wall), 1);
		updateLight();
		if (sendRPC) {
			const id = wall.id;
			queue(() => rpc.removeWall(id));
		}
		delete globals.walls[wall.id];
		wall.id = 0;
		return undoIt;
	      },
	      undoIt = () => {
		layer.walls.push(wall);
		updateLight();
		queue(() => rpc.addWall(layer.path, wall.x1, wall.y1, wall.x2, wall.y2, wall.colour).then(id => {
			wall.id = id;
			globals.walls[id] = {layer, wall};
		}));
		return doIt;
	      };
	undo.add(doIt(sendRPC), lang["UNDO_WALL_REMOVE"]);
},
doTokenLightChange = (id: Uint, lightColour: Colour, lightIntensity: Uint, sendRPC = true) => {
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
			queue(rpc.setTokenLight.bind(rpc, id, lightColour, lightIntensity));
		}
		[lightColour, oldLightColour] = [oldLightColour, lightColour];
		[lightIntensity, oldLightIntensity] = [oldLightIntensity, lightIntensity];
		return doIt;
	      };
	undo.add(doIt(sendRPC), lang["UNDO_TOKEN_LIGHT_CHANGE"]);
},
doMapDataSet = (key: string, data: any, sendRPC = true) => {
	const oldData = globals.mapData.data[key],
	      doIt = (sendRPC = true) => {
		globals.mapData.data[key] = data;
		if (sendRPC) {
			queue(() => rpc.setMapKeyData(key, data));
		}
		return undoIt;
	      },
	      undoIt = () => {
		if (oldData) {
			queue(() => rpc.setMapKeyData(key, globals.mapData.data[key] = oldData));
		} else {
			delete globals.mapData.data[key];
			queue(() => rpc.removeMapKeyData(key));
		}
		return doIt;
	      };
	undo.add(doIt(sendRPC), lang["UNDO_MAP_DATA_SET"]);
},
doMapDataRemove = (key: string, sendRPC = true) => {
	const oldData = globals.mapData.data[key];
	if (!oldData) {
		return;
	}
	const doIt = (sendRPC = true) => {
		delete globals.mapData.data[key];
		if (sendRPC) {
			queue(() => rpc.removeMapKeyData(key));
		}
		return undoIt;
	      },
	      undoIt = () => {
		globals.mapData.data[key] = oldData
		queue(() => rpc.setMapKeyData(key, oldData));
		return doIt;
	      };
	undo.add(doIt(sendRPC), lang["UNDO_MAP_DATA_REMOVE"]);
},
snapTokenToGrid = (x: Int, y: Int, width: Uint, height: Uint) => {
	const size = globals.mapData.gridSize;
	switch (globals.mapData.gridType) {
	case 1: {
		const dy = 1.5 * size / SQRT3,
		      row = Math.round(y / dy),
		      colOffset = row % 2 === 0 ? 0: size >> 1;
		return [Math.round((x - colOffset) / size) * size + colOffset + ((Math.round(width / size) * size - width) >> 1), Math.round(row * dy + (((2 * size / SQRT3) + dy * (Math.round(height / dy) - 1) - height) >> 1))];
	}
	case 2: {
		const dx = 1.5 * size / SQRT3,
		      col = Math.round(x / dx),
		      rowOffset = col % 2 === 0 ? 0: size >> 1;
		return [Math.round(col * dx + (((2 * size / SQRT3) + dx * (Math.round(width / dx) - 1) - width) >> 1)), Math.round((y - rowOffset) / size) * size + rowOffset + ((Math.round(height / size) * size - height) >> 1)];
	}}
	return [Math.round(x / size) * size + ((Math.round(width / size) * size - width) >> 1), Math.round(y / size) * size + ((Math.round(height / size) * size - height) >> 1)];
},
layersRPC: LayerRPC = {
	"waitAdded": () => waitAdded[1],
	"waitMoved": () => unusedWait,
	"waitRemoved": () => waitRemoved[1],
	"waitLinked": () => unusedWait,
	"waitFolderAdded": () => waitFolderAdded[1],
	"waitFolderMoved": () => unusedWait,
	"waitFolderRemoved": () => waitFolderRemoved[1],
	"waitLayerSetVisible": () => waitLayerShow[1],
	"waitLayerSetInvisible": () => waitLayerHide[1],
	"waitLayerPositionChange": () => waitLayerPositionChange[1],
	"waitLayerRename": () => waitLayerRename[1],
	"list": invalidRPC,
	"createFolder": (path: string) => rpc.addLayerFolder(path).then(p => doLayerFolderAdd(p, false)),
	"move": invalidRPC,
	"moveFolder": invalidRPC,
	"remove": path => {
		undo.clear();
		return removeS(path);
	},
	"removeFolder": path => {
		undo.clear();
		return removeS(path);
	},
	"link": invalidRPC
};

export default function(base: HTMLElement) {
	let tokenDragMode = -1;
	const makeLayerContext = (folder: SVGFolder, fn: (sl: SVGLayer) => void, disabled = ""): List => (folder.children as SortNode<SVGFolder | SVGLayer>).map(e => e.id < 0 ? [] : isSVGFolder(e) ? menu(e.name, makeLayerContext(e, fn, disabled)) : item(e.name, () => fn(e), {"disabled": e.name === disabled})),
	      tokenDrag = (e: MouseEvent) => {
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
			rotation = Math.round(-128 * Math.atan2(panZoom.zoom * (x + width / 2) + panZoom.x - (panZoom.zoom - 1) * mapData.width / 2 - e.clientX, panZoom.zoom * (y + height / 2) + panZoom.y - (panZoom.zoom - 1) * mapData.height / 2 - e.clientY) / Math.PI);
			while (rotation < 0) {
				rotation += 256;
			}
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
			      min = selectedToken!.snap ? sq : 10;
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
		selectedToken.x = x;
		selectedToken.y = y;
		selectedToken.width = width;
		selectedToken.rotation = rotation;
		selectedToken.height = height;
		selectedToken.updateNode();
		createSVG(globals.outline, {"--outline-width": width + "px", "--outline-height": height + "px", "transform": selectedToken!.transformString(false)});
	      },
	      tokenMouseUp = (e: MouseEvent) => {
		if (!globals.selected.token || e.button !== 0 || !globals.selected.layer) {
			return;
		}
		document.body.removeEventListener("mousemove", tokenDrag);
		document.body.removeEventListener("mouseup", tokenMouseUp);
		globals.root.style.removeProperty("--outline-cursor");
		tokenDragMode = -1;
		const {layer, token} = globals.selected,
		      {x, y, width, height, rotation} = tokenMousePos,
		      newX = Math.round(token.x),
		      newY = Math.round(token.y),
		      newRotation = Math.round(token.rotation),
		      newWidth = Math.round(token.width),
		      newHeight = Math.round(token.height),
		      ts: TokenSet = {"id": token.id};
		let changed = false;
		if (newX !== x) {
			token.x = tokenMousePos.x;
			ts.x = newX;
			changed = true;
		}
		if (newY !== y) {
			token.y = tokenMousePos.y;
			ts.y = newY;
			changed = true;
		}
		if (newWidth !== width) {
			token.width = tokenMousePos.width;
			ts.width = newWidth;
			changed = true;
		}
		if (newHeight !== height) {
			token.height = tokenMousePos.height;
			ts.height = newHeight;
			changed = true;
		}
		if (newRotation !== rotation) {
			token.rotation = tokenMousePos.rotation;
			ts.rotation = newRotation;
			changed = true;
		}
		if (changed) {
			doTokenSet(ts);
		}
		stopMeasurement();
	      },
	      outline = createSVG(globals.outline, {"id": "outline", "tabindex": "-1", "style": "display: none", "onkeyup": (e: KeyboardEvent) => {
		const {token} = globals.selected;
		if (!token) {
			return;
		}
		if (tokenDragMode > -1) {
			if (e.key === "Escape") {
				document.body.removeEventListener("mousemove", tokenDrag);
				document.body.removeEventListener("mouseup", tokenMouseUp);
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
					createSVG(globals.outline, {"--outline-width": width + "px", "--outline-height": height + "px", "transform": token.transformString(false)});
				}
				stopMeasurement();
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
					rotation = Math.round(rotation - deg);
					while (rotation < 0) {
						rotation += 256;
					}
					e.preventDefault();
				} else {
					x -= h;
				}
				break;
			case "ArrowRight":
				if (e.shiftKey) {
					const {mapData: {gridType}} = globals,
					      deg = 256 / (gridType === 1 || gridType === 2 ? 12 : 8);
					rotation = Math.round(rotation + deg);
					while (rotation > 255) {
						rotation -= 256;
					}
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
				token.rotation--;
				while (token.rotation < 0) {
					token.rotation += 256;
				}
				e.preventDefault();
			} else {
				token.x--;
			}
			break;
		case "ArrowRight":
			if (e.shiftKey) {
				token.rotation++;
				while (token.rotation > 255) {
					token.rotation -= 256;
				}
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
		place(document.body, [e.clientX, e.clientY], [
			tokenContext(),
			isTokenImage(currToken) ? [
				item(lang["CONTEXT_EDIT_TOKEN"], () => currToken instanceof SVGToken && tokenEdit(currToken.id, "Edit Token", currToken.tokenData, false)),
				item(lang["CONTEXT_FLIP"], () => {
					if (!(currToken instanceof SVGToken)) {
						return;
					}
					doTokenSet({"id": currToken.id, "flip": !currToken.flip});
					outline.focus();
				}),
				item(lang["CONTEXT_FLOP"], () => {
					if (!(currToken instanceof SVGToken)) {
						return;
					}
					doTokenSet({"id": currToken.id, "flop": !currToken.flop});
					outline.focus();
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
				}),
			] : [],
			item(currToken.snap ? lang["CONTEXT_UNSNAP"] : lang["CONTEXT_SNAP"], () => {
				const snap = currToken.snap,
				      sq = globals.mapData.gridSize,
				      {x, y, width, height, rotation} = currToken;
				if (!snap) {
					const [newX, newY] = snapTokenToGrid(Math.round(x / sq) * sq, Math.round(y / sq) * sq, width, height),
					      newRotation = Math.round(rotation / 32) * 32 % 256;
					if (x !== newX || y !== newY || rotation !== newRotation) {
						doTokenSet({"id": currToken.id, "x": newX, "y": newY, "rotation": newRotation, "snap": !snap});
					}
				} else {
					doTokenSet({"id": currToken.id, "snap": !snap});
				}
			}),
			item(lang["CONTEXT_SET_LIGHTING"], () => {
				let c = currToken.lightColour;
				const t = Date.now(),
				      w = shell.appendChild(windows({"window-title": lang["CONTEXT_SET_LIGHTING"]})),
				      i = input({"id": `tokenIntensity_${t}_`, "type": "number", "value": currToken.lightIntensity, "min": 0, "step": 1});
				w.appendChild(createHTML(null, [
					h1(lang["CONTEXT_SET_LIGHTING"]),
					labels(`${lang["LIGHTING_COLOUR"]}: `, makeColourPicker(w, lang["LIGHTING_PICK_COLOUR"], () => c, d => c = d, `tokenLighting_${t}`)),
					br(),
					labels(`${lang["LIGHTING_INTENSITY"]}: `, i),
					br(),
					button({"onclick": () => {
						if (globals.selected.token === currToken) {
							doTokenLightChange(currToken.id, c, parseInt(i.value));
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
					doTokenMoveLayerPos(currToken.id, currLayer.path, currLayer.tokens.length - 1);
				}),
				item(lang["CONTEXT_MOVE_UP"], () => {
					if (!globals.tokens[currToken.id]) {
						return;
					}
					const currLayer = globals.tokens[currToken.id].layer,
					      newPos = currLayer.tokens.findIndex(t => t === currToken) + 1;
					doTokenMoveLayerPos(currToken.id, currLayer.path, newPos);
				})
			] : [],
			tokenPos > 0 ? [
				item(lang["CONTEXT_MOVE_DOWN"], () => {
					if (!globals.tokens[currToken.id]) {
						return;
					}
					const currLayer = globals.tokens[currToken.id].layer,
					      newPos = currLayer.tokens.findIndex(t => t === currToken) - 1;
					doTokenMoveLayerPos(currToken.id, currLayer.path, newPos);
				}),
				item(lang["CONTEXT_MOVE_BOTTOM"], () => {
					if (!globals.tokens[currToken.id]) {
						return;
					}
					const currLayer = globals.tokens[currToken.id].layer;
					doTokenMoveLayerPos(currToken.id, currLayer.path, 0);
				})
			] : [],
			menu(lang["CONTEXT_MOVE_LAYER"], makeLayerContext(globals.layerList, (sl: SVGLayer) => {
				if (!globals.tokens[currToken.id]) {
					return;
				}
				const currLayer = globals.tokens[currToken.id].layer;
				doTokenMoveLayerPos(currToken.id, sl.path, sl.tokens.length);
			}, currLayer.name)),
			item(lang["CONTEXT_DELETE"], () => doTokenRemove(currToken.id))
		]);
	}, "onwheel": toolTokenWheel}, Array.from({length: 10}, (_, n) => rect({"onmouseover": toolTokenMouseOver, "onmousedown": function(this: SVGRectElement, e: MouseEvent) {
		toolTokenMouseDown.call(this, e);
		if (e.defaultPrevented || e.button !== 0 || e.ctrlKey || !globals.selected.token) {
			return;
		}
		e.stopImmediatePropagation();
		if (n === 0 && e.shiftKey) {
			const {layer, token} = globals.selected;
			if (!layer) {
				return;
			}
			let newToken: SVGToken | SVGShape | SVGDrawing | null = null;
			for (const tk of layer.tokens as (SVGToken | SVGShape)[]) {
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
			return;
		}
		document.body.addEventListener("mousemove", tokenDrag);
		document.body.addEventListener("mouseup", tokenMouseUp);
		tokenDragMode = n;
		globals.root.style.setProperty("--outline-cursor", ["move", "cell", "nwse-resize", "ns-resize", "nesw-resize", "ew-resize"][tokenDragMode < 2 ? tokenDragMode : (3.5 - Math.abs(5.5 - tokenDragMode) + ((globals.selected.token.rotation + 143) >> 5)) % 4 + 2]);
		[tokenMousePos.mouseX, tokenMousePos.mouseY] = screen2Grid(e.clientX, e.clientY);
		if (n === 0 && measureTokenMove.value) {
			const {selected: {token}} = globals;
			startMeasurement(token.x + (token.width >> 1), token.y + (token.height >> 1));
		}
	      }}))),
	      mapOnDragOver = (e: DragEvent) => {
		if (e.dataTransfer && (e.dataTransfer.types.includes("character") || e.dataTransfer.types.includes("imageasset"))) {
			e.preventDefault();
			e.dataTransfer.dropEffect = "link";
		}
	      },
	      mapOnDrop = (e: DragEvent) => {
		if (globals.selected.layer === null) {
			return;
		}
		const token = {"id": 0, "src": 0, "x": 0, "y": 0, "width": 0, "height": 0, "patternWidth": 0, "patternHeight": 0, "stroke": noColour, "strokeWidth": 0, "rotation": 0, "flip": false, "flop": false, "tokenData": {}, "tokenType": 0, "snap": autosnap.value, "lightColour": noColour, "lightIntensity": 0};
		if (e.dataTransfer!.types.includes("character")) {
			const tD = JSON.parse(e.dataTransfer!.getData("character")),
			      char = characterData.get(tD.id)!;
			if (char["store-image-data"]) {
				Object.assign(token, JSON.parse(JSON.stringify(char["store-image-data"].data)));
			} else {
				token.src = parseInt(char["store-image-icon"].data);
				token.width = tD.width;
				token.height = tD.height;
			}
		} else {
			const tokenData = JSON.parse(e.dataTransfer!.getData("imageAsset"));
			token.src = tokenData.id;
			token.width = tokenData.width;
			token.height = tokenData.height;
		}
		[token.x, token.y] = screen2Grid(e.clientX, e.clientY);
		if (token.snap) {
			if (token.tokenData === 0) {
				const sq = globals.mapData.gridSize;
				token.width = Math.max(Math.round(token.width / sq) * sq, sq);
				token.height = Math.max(Math.round(token.height / sq) * sq, sq);
			}
			[token.x, token.y] = snapTokenToGrid(token.x, token.y, token.width, token.height);
		}
		doTokenAdd(globals.selected.layer.path, token);
	      },
	      mapOnMouseDown = (e: MouseEvent) => {
		[pasteCoords[0], pasteCoords[1]] = screen2Grid(e.clientX, e.clientY);
		if (e.defaultPrevented) {
			return;
		}
		const {layer} = globals.selected;
		if (!layer || e.button !== 0 || e.ctrlKey) {
			return;
		}
		let newToken: SVGToken | SVGShape | SVGDrawing | null = null;
		for (const t of layer.tokens as (SVGToken | SVGShape)[]) {
			if (t.at(e.clientX, e.clientY)) {
				newToken = t;
			}
		}
		if (!newToken) {
			if (!e.ctrlKey) {
				deselectToken();
			}
			return;
		}
		selectToken(newToken);
	      },
	      selectToken = (newToken: SVGToken | SVGShape | SVGDrawing) => {
		globals.selected.token = newToken;
		autoFocus(createSVG(outline, {"transform": newToken.transformString(false), "style": undefined, "class!": `cursor_${((newToken.rotation + 143) >> 5) % 4}`}));
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
				const t = getToken() as Token;
				if (t) {
					copiedToken = t;
					if (e.key === 'x' && globals.selected.token) {
						doTokenRemove(globals.selected.token.id);
					}
				}
				break;
			case 'v':
				if (!copiedToken || !globals.selected.layer) {
					return;
				}
				const [x, y] = copiedToken.snap ? snapTokenToGrid(pasteCoords[0], pasteCoords[1], copiedToken.width, copiedToken.height) : pasteCoords;
				doTokenAdd(globals.selected.layer.path, Object.assign({"id": 0, x, y}, copiedToken));
			}
		}
	      },
	      pasteCoords = [0, 0];
	mapLoadReceive(mapID => rpc.getMapData(mapID).then(mapData => {
		Object.assign(globals.selected, {"layer": null, "token": null});
		const oldBase = base;
		oldBase.replaceWith(base = mapView(oldBase, mapData));
		createSVG(globals.root, {"ondragover": mapOnDragOver, "ondrop": mapOnDrop, "onmousedown": mapOnMouseDown, "onkeydown": mapOnKeyDown}, createHTML(outline, {"style": "display: none"}));
		pasteCoords[0] = 0;
		pasteCoords[1] = 0;
		mapLoadedSend(true);
	}));
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
}
