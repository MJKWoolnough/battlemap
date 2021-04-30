import type {Colour, IDName, Int, Uint, MapDetails, LayerMove, LayerRename, TokenSet, Token, WallPath, LayerRPC} from './types.js';
import type {SVGLayer} from './map.js';
import {Subscription} from './lib/inter.js';
import {createSVG} from './lib/svg.js';
import {SVGToken, SVGShape, SVGDrawing, addLayer, addLayerFolder, getLayer, getParentLayer, isSVGLayer, removeLayer, renameLayer, setLayerVisibility, moveLayer, setMapDetails, setLightColour, isTokenImage, isTokenDrawing, updateLight, normaliseWall, splitAfterLastSlash} from './map.js';
import undo from './undo.js';
import {deselectToken, globals, SQRT3, queue} from './shared.js';
import {tokenDataFilter} from './plugins.js';
import {rpc, handleError} from './rpc.js';
import lang from './language.js';

const subFn = <T>(): [(data: T) => void, Subscription<T>] => {
	let fn: (data: T) => void;
	const sub = new Subscription<T>(resolver => fn = resolver);
	return [fn!, sub];
      },
      unusedWait = new Subscription<any>(() => {}),
      unusedWaitFn = () => unusedWait,
      invalidRPC = () => Promise.reject("invalid"),
      removeS = (path: string) => {
	checkSelectedLayer(path);
	removeLayer(path);
	return rpc.removeLayer(path);
      };

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
checkSelectedLayer = (path: string) => {
	const {layer} = globals.selected;
	if (layer && (layer.path === path || layer.path.startsWith(path + "/"))) {
		globals.selected.layer = null;
		if (globals.selected.token) {
			deselectToken();
		}
	}
},
setLayer = (l: SVGLayer) => waitLayerSelect[0](l.path),
tokenMousePos = {mouseX: 0, mouseY: 0, x: 0, y: 0, width: 0, height: 0, rotation: 0},
waitAdded = subFn<IDName[]>(),
waitRemoved = subFn<string>(),
waitFolderAdded = subFn<string>(),
waitFolderRemoved = subFn<string>(),
waitLayerShow = subFn<string>(),
waitLayerHide = subFn<string>(),
waitLayerPositionChange = subFn<LayerMove>(),
waitLayerRename = subFn<LayerRename>(),
waitLayerSelect = subFn<string>(),
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
		const [fromParent, fromName] = splitAfterLastSlash(from);
		from = to + "/" + fromName;
		to = fromParent;
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
		globals.tokens.set(id, {layer, token});
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
		globals.tokens.delete(token.id);
		layer.tokens.pop();
		queue(() => rpc.removeToken(token.id));
		return doIt;
	      };
	undo.add(doIt(sendRPC), lang["UNDO_TOKEN_ADD"]);
	return addToken;
},
doTokenMoveLayerPos = (id: Uint, to: string, newPos: Uint, sendRPC = true) => {
	let layer = globals.tokens.get(id)!.layer as SVGLayer,
	    newParent = getLayer(to) as SVGLayer;
	const token = globals.tokens.get(id)!.token;
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
		globals.tokens.get(id)!.layer = newParent;
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
	const {token} = globals.tokens.get(ts.id)!;
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
			createSVG(globals.outline, {"style": {"--outline-width": token.width + "px", "--outline-height": token.height + "px"}, "transform": token.transformString(false)})
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
	const {layer, token} = globals.tokens.get(tk)!;
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
		globals.tokens.delete(tk);
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
			globals.tokens.set(id, {layer, token});
		}));
		if (token instanceof SVGToken) {
			token.uncleanup();
			if (token.lightColour.a > 0 && token.lightIntensity > 0) {
				updateLight();
			}
		}
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
				globals.walls.set(id, {layer, wall});
			}));
		} else if (w.id > 0) {
			globals.walls.set(w.id, {layer, wall});
		}
		return undoIt;
	      },
	      undoIt = () => {
		layer.walls.splice(layer.walls.findIndex(w => w === wall), 1);
		updateLight();
		const id = wall.id;
		queue(() => rpc.removeWall(id));
		globals.walls.delete(id);
		wall.id = 0;
		return doIt;
	      };
	undo.add(doIt(sendRPC), lang["UNDO_WALL_ADD"]);
},
doWallRemove = (wID: Uint, sendRPC = true) => {
	const {layer, wall} = globals.walls.get(wID)!;
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
		globals.walls.delete(wall.id);
		wall.id = 0;
		return undoIt;
	      },
	      undoIt = () => {
		layer.walls.push(wall);
		updateLight();
		queue(() => rpc.addWall(layer.path, wall.x1, wall.y1, wall.x2, wall.y2, wall.colour).then(id => {
			wall.id = id;
			globals.walls.set(id, {layer, wall});
		}));
		return doIt;
	      };
	undo.add(doIt(sendRPC), lang["UNDO_WALL_REMOVE"]);
},
doTokenLightChange = (id: Uint, lightColour: Colour, lightIntensity: Uint, sendRPC = true) => {
	const {token} = globals.tokens.get(id)!;
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
layersRPC: LayerRPC = Object.freeze({
	"waitAdded": () => waitAdded[1],
	"waitMoved": unusedWaitFn,
	"waitRemoved": () => waitRemoved[1],
	"waitCopied": unusedWaitFn,
	"waitFolderAdded": () => waitFolderAdded[1],
	"waitFolderMoved": () => unusedWait,
	"waitFolderRemoved": () => waitFolderRemoved[1],
	"waitLayerSetVisible": () => waitLayerShow[1],
	"waitLayerSetInvisible": () => waitLayerHide[1],
	"waitLayerPositionChange": () => waitLayerPositionChange[1],
	"waitLayerRename": () => waitLayerRename[1],
	"waitLayerSelect": () => waitLayerSelect[1],
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
	"copy": invalidRPC
});
