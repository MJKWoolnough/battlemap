import type {Colour} from './colours.js';
import type {SVGLayer} from './map.js';
import type {SVGDrawing, SVGShape} from './map_tokens.js';
import type {IDName, Int, LayerMove, LayerRename, MapDetails, Mask, MaskSet, Token, TokenSet, Uint, Wall, WallPath} from './types.js';
import {amendNode} from './lib/dom.js';
import {Subscription} from './lib/inter.js';
import {queue} from './lib/misc.js';
import lang from './language.js';
import {addLayer, addLayerFolder, getLayer, getParentLayer, isSVGLayer, isTokenDrawing, isTokenImage, mapData, moveLayer, normaliseWall, removeLayer, renameLayer, setLayerVisibility, setLightColour, setMapDetails, splitAfterLastSlash, updateLight} from './map.js';
import {SQRT3, SVGToken, deselectToken, masks, outline, outlineRotationClass, selected, tokens} from './map_tokens.js';
import {drawingClass, shapeClass, tokenClass, tokenDataFilter} from './plugins.js';
import {handleError, rpc} from './rpc.js';
import {cloneObject, walls} from './shared.js';
import undo from './undo.js';

const unusedWait = new Subscription<any>(() => {}),
      unusedWaitFn = () => unusedWait,
      invalidRPC = () => Promise.reject("invalid"),
      removeS = (path: string) => {
	checkSelectedLayer(path);
	removeLayer(path);
	return rpc.removeLayer(path);
      },
      generateTokenChanges = (ts: TokenSet, token: SVGToken | SVGShape | SVGDrawing) => {
	const original: TokenSet = {"id": ts.id, "tokenData": {}, "removeTokenData": []};
	for (const k in ts) {
		switch (k) {
		case "id":
			break;
		case "tokenData":
			const tokenData = ts[k];
			for (const k in tokenData) {
				if (token["tokenData"][k]) {
					original["tokenData"]![k] = token["tokenData"][k];
				} else {
					original["removeTokenData"]!.push(k);
				}
			}
			break;
		case "removeTokenData":
			const removeTokenData = ts[k]!;
			for (const k of removeTokenData) {
				original["tokenData"]![k] = token["tokenData"][k];
			}
			break;
		default:
			(original as Record<string, any>)[k] = (token as Record<string, any>)[k]
		}
	}
	return original;
      },
      processTokenChanges = (ts: TokenSet, token: SVGToken | SVGShape | SVGDrawing) => {
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
			const tokenData = ts[k];
			for (const k in tokenData) {
				token["tokenData"][k] = tokenData[k];
			}
			break;
		case "removeTokenData":
			const removeTokenData = ts[k]!;
			for (const k of removeTokenData) {
				delete token["tokenData"][k];
			}
			break;
		default:
			(token as Record<string, any>)[k] = ts[k as keyof TokenSet]
		}
	}
	token.updateNode();
	if (selected.token === token) {
		amendNode(outline, {"style": {"--outline-width": token.width + "px", "--outline-height": token.height + "px"}, "class": outlineRotationClass(token.rotation), "transform": token.transformString(false)});
		tokenMousePos.x = token.x;
		tokenMousePos.y = token.y;
		tokenMousePos.width = token.width;
		tokenMousePos.height = token.height;
		tokenMousePos.rotation = token.rotation;
	}
      };

export const getToken = () => {
	const {token} = selected;
	if (token instanceof SVGToken && !token.isPattern) {
		const {src, width, height, patternWidth, patternHeight, rotation, flip, flop, snap, lightColours, lightStages, lightTimings} = token,
		      tokenData = cloneObject(token.tokenData);
		for (const f of tokenDataFilter()) {
			delete(tokenData[f]);
		}
		return {src, width, height, patternWidth, patternHeight, rotation, flip, flop, snap, "lightColours": cloneObject(lightColours), "lightStages": cloneObject(lightStages), "lightTimings": cloneObject(lightTimings), tokenData};
	}
	return undefined;
},
checkSelectedLayer = (path: string) => {
	const {layer} = selected;
	if (layer && (layer.path === path || layer.path.startsWith(path + "/"))) {
		selected.layer = null;
		if (selected.token) {
			deselectToken();
		}
	}
},
setLayer = (l: SVGLayer) => waitLayerSelect[1](l.path),
tokenMousePos = {mouseX: 0, mouseY: 0, x: 0, y: 0, width: 0, height: 0, rotation: 0},
waitAdded = Subscription.bind<IDName[]>(1),
waitRemoved = Subscription.bind<string>(1),
waitFolderAdded = Subscription.bind<string>(1),
waitFolderRemoved = Subscription.bind<string>(1),
waitLayerShow = Subscription.bind<string>(1),
waitLayerHide = Subscription.bind<string>(1),
waitLayerLock = Subscription.bind<string>(1),
waitLayerUnlock = Subscription.bind<string>(1),
waitLayerPositionChange = Subscription.bind<LayerMove>(1),
waitLayerRename = Subscription.bind<LayerRename>(1),
waitLayerSelect = Subscription.bind<string>(1),
doMapChange = (details: MapDetails, sendRPC = true) => {
	let oldDetails = {"width": mapData.width, "height": mapData.height, "gridType": mapData.gridType, "gridSize": mapData.gridSize, "gridStroke": mapData.gridStroke, "gridColour": mapData.gridColour};
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
	let oldColour = mapData.lightColour;
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
			queue(visibility ? () => {
				waitLayerShow[1](path);
				return rpc.showLayer(path);
			} : () => {
				waitLayerHide[1](path);
				return rpc.hideLayer(path);
			});
		}
		visibility = !visibility;
		return doIt;
	      };
	undo.add(doIt(sendRPC), lang[visibility ? "UNDO_LAYER_SHOW" : "UNDO_LAYER_HIDE"]);
	return path;
},
doLockUnlockLayer = (path: string, locked: boolean, sendRPC = true) => {
	const layer = getLayer(path),
	      doIt = (sendRPC = true) => {
		if (sendRPC) {
			queue(locked ? () => {
				waitLayerLock[1](path);
				return rpc.showLayer(path);
			} : () => {
				waitLayerUnlock[1](path);
				return rpc.hideLayer(path);
			});
		}
		if (layer) {
			layer.locked = locked;
		}
		locked = !locked;
		return doIt;
	      };
	undo.add(doIt(sendRPC), lang[locked ? "UNDO_LAYER_LOCK" : "UNDO_LAYER_UNLOCK"]);
	return path;
},
doLayerAdd = (name: string, sendRPC = true) => {
	const path = "/" + name,
	      doIt = (sendRPC = true) => {
		addLayer(name);
		if (sendRPC) {
			queue(() => {
				waitAdded[1]([{id: 1, name}]);
				return rpc.addLayer(name);
			});
		}
		return undoIt;
	      },
	      undoIt = () => {
		checkSelectedLayer(path);
		removeLayer(path);
		queue(() => {
			waitRemoved[1](path);
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
				waitFolderAdded[1](path);
				return rpc.addLayerFolder(path);
			});
		}
		return undoIt;
	      },
	      undoIt = () => {
		checkSelectedLayer(path);
		removeLayer(path);
		queue(() => {
			waitFolderRemoved[1](path);
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
	let [fromParent, name] = splitAfterLastSlash(from),
	    oldPos = parent.children.indexOf(layer);
	const doIt = (sendRPC = true) => {
		deselectToken();
		moveLayer(from, to, position);
		if (sendRPC) {
			const data = {from, to, position};
			queue(() => {
				waitLayerPositionChange[1](data);
				return rpc.moveLayer(data.from, data.to, data.position);
			});
		}
		[to, fromParent] = [fromParent, to];
		from = fromParent + "/" + name;
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
				waitLayerRename[1](data);
				return rpc.renameLayer(data.path, data.name);
			});
		}
		[path, newPath] = [newPath, path];
		[oldName, name] = [name, oldName];
		return doIt;
	      };
	undo.add(doIt(sendRPC), lang["UNDO_LAYER_RENAME"]);
},
doTokenAdd = (path: string, tk: Token, sendRPC = true, pos: undefined | Uint = undefined) => {
	const layer = getLayer(path);
	if (!layer || !isSVGLayer(layer)) {
		handleError("Invalid layer for token add");
		return () => {};
	}
	const token = isTokenImage(tk) ? new tokenClass(tk) : isTokenDrawing(tk) ? new drawingClass(tk) : new shapeClass(tk),
	      hasLight = token.hasLight(),
	      addToken = (id: Uint) => {
		token.id = id;
		if (pos === undefined) {
			layer.tokens.push(token);
		} else {
			layer.tokens.splice(pos, 0, token);
		}
		tokens.set(id, {layer, token});
		if (hasLight) {
			updateLight();
		}
	      },
	      doIt = (sendRPC = true) => {
		if (sendRPC) {
			queue(() => rpc.addToken(path, token, pos).then(addToken));
		}
		return undoIt;
	      },
	      undoIt = () => {
		if (token === selected.token) {
			deselectToken();
		}
		tokens.delete(token.id);
		layer.tokens.pop();
		queue(() => rpc.removeToken(token.id));
		if (hasLight) {
			updateLight();
		}
		return doIt;
	      };
	undo.add(doIt(sendRPC), lang["UNDO_TOKEN_ADD"]);
	return addToken;
},
doTokenMoveLayerPos = (id: Uint, to: string, newPos: Uint, sendRPC = true) => {
	let layer = tokens.get(id)!.layer as SVGLayer,
	    newParent = getLayer(to) as SVGLayer;
	const token = tokens.get(id)!.token;
	if (!layer || !token || !newParent || !isSVGLayer(newParent)) {
		handleError("Invalid Token Move Layer/Pos");
		return;
	}
	if (newPos > newParent.tokens.length) {
		newPos = newParent.tokens.length;
	}
	let currentPos = layer.tokens.findIndex(t => t === token);
	const hasLight = token.hasLight(),
	      doIt = (sendRPC = true) => {
		newParent.tokens.splice(newPos, 0, layer.tokens.splice(currentPos, 1)[0]);
		tokens.get(id)!.layer = newParent;
		if (hasLight) {
			updateLight();
		}
		if (selected.token === token) {
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
	const {token} = tokens.get(ts.id)!;
	if (!token) {
		handleError("Invalid token for token set");
		return;
	}
	let original = generateTokenChanges(ts, token);
	const lightUpdate = ts["lightColours"] || ts["lightStages"] || ts["lightTimings"] || ts["x"] !== undefined || ts["y"] !== undefined || ts["width"] || ts["height"],
	      doIt = (sendRPC = true) => {
		processTokenChanges(ts, token);
		if (sendRPC) {
			queue(rpc.setToken.bind(rpc, ts));
		}
		if (lightUpdate) {
			updateLight();
		}
		[original, ts] = [ts, original];
		return doIt;
	      };
	undo.add(doIt(sendRPC), lang["UNDO_TOKEN_SET"]);
},
doTokenSetMulti = (ts: TokenSet[], sendRPC = true) => {
	const tks: (SVGToken | SVGShape | SVGDrawing)[] = [];
	let originals: TokenSet[] = [];
	for (const t of ts) {
		const {token} = tokens.get(t.id)!;
		if (!token) {
			handleError("Invalid token for token set (multi)");
			return;
		}
		tks.push(token);
		originals.push(generateTokenChanges(t, token));
	}
	const lightUpdate = ts.some(t => t["lightStages"]?.length || t?.["lightTimings"]?.length || t["x"] !== undefined || t["y"] !== undefined || t["width"] || t["height"]),
	      doIt = (sendRPC = true) => {
		for (let i = 0; i < originals.length; i++) {
			processTokenChanges(ts[i], tks[i]);
		}
		if (sendRPC) {
			queue(rpc.setTokenMulti.bind(rpc, ts));
		}
		if (lightUpdate) {
			updateLight();
		}
		[originals, ts] = [ts, originals];
		return doIt;
	      };
	undo.add(doIt(sendRPC), lang["UNDO_TOKEN_SET_MULTI"]);
},
doTokenRemove = (tk: Uint, sendRPC = true) => {
	const {layer, token} = tokens.get(tk)!;
	if (!token) {
		handleError("invalid token for removal");
		return;
	}
	const pos = layer.tokens.findIndex(t => t === token),
	      hasLight = token.hasLight(),
	      doIt = (sendRPC = true) => {
		if (token === selected.token) {
			deselectToken();
		}
		layer.tokens.splice(pos, 1);
		tokens.delete(tk);
		token.cleanup();
		if (hasLight) {
			updateLight();
		}
		if (sendRPC) {
			queue(() => rpc.removeToken(token.id));
		}
		return undoIt;
	      },
	      undoIt = () => {
		layer.tokens.splice(pos, 0, token);
		queue(() => rpc.addToken(layer.path, token, pos).then(id => {
			token.id = id;
			tokens.set(id, {layer, token});
		}));
		token.uncleanup();
		if (hasLight) {
			updateLight();
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
doWallAdd = (w: WallPath, sendRPC = true) => {
	const layer = getLayer(w.path);
	if (!layer || !isSVGLayer(layer)) {
		handleError("invalid layer for wall add");
		return;
	}
	const {path, wall: {id, x1, y1, x2, y2, colour, scattering}} = w,
	      wall = normaliseWall({id, x1, y1, x2, y2, colour, scattering}),
	      doIt = (sendRPC = true) => {
		layer.walls.push(wall);
		if (sendRPC) {
			queue(() => rpc.addWall(path, {id, x1, y1, x2, y2, colour, scattering}).then(id => {
				wall.id = id;
				walls.set(id, {layer, wall});
				updateLight();
			}));
		} else if (id > 0) {
			walls.set(id, {layer, wall});
			updateLight();
		}
		return undoIt;
	      },
	      undoIt = () => {
		layer.walls.splice(layer.walls.findIndex(w => w === wall), 1);
		updateLight();
		const id = wall.id;
		queue(() => rpc.removeWall(id));
		walls.delete(id);
		wall.id = 0;
		return doIt;
	      };
	if (x1 !== x2 || y1 !== y2) {
		undo.add(doIt(sendRPC), lang["UNDO_WALL_ADD"]);
	}
},
doWallRemove = (wID: Uint, sendRPC = true) => {
	const {layer, wall} = walls.get(wID)!;
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
		walls.delete(wall.id);
		wall.id = 0;
		return undoIt;
	      },
	      undoIt = () => {
		layer.walls.push(wall);
		queue(() => rpc.addWall(layer.path, wall).then(id => {
			walls.set(wall.id = id, {layer, wall});
			updateLight();
		}));
		return doIt;
	      };
	undo.add(doIt(sendRPC), lang["UNDO_WALL_REMOVE"]);
},
doWallModify = (wall: Wall, sendRPC = true) => {
	const wl = walls.get(wall.id);
	if (!wl) {
		handleError("invalid wall to modify");
		return;
	}
	let oldWall = cloneObject(wl.wall);
	const doIt = (sendRPC = true) => {
		Object.assign(wl.wall, wall);
		if (sendRPC) {
			queue(rpc.modifyWall.bind(rpc, wall));
		}
		updateLight();
		[oldWall, wall] = [wall, oldWall];
		return doIt;
	      };
	undo.add(doIt(sendRPC), lang["UNDO_WALL_MODIFY"]);
},
doWallMove = (wall: Uint, path: string, sendRPC = true) => {
	const wl = walls.get(wall);
	if (!wl) {
		handleError("invalid wall to modify");
		return;
	}
	let oldLayer = wl.layer,
	    oldPath = oldLayer.path,
	    newLayer = getLayer(path) as SVGLayer;
	if (!newLayer || !isSVGLayer(newLayer)) {
		handleError("invalid layer for wall move");
		return;
	}
	const doIt = (sendRPC = true) => {
		wl.layer = newLayer;
		newLayer.walls.push(oldLayer.walls.splice(oldLayer.walls.findIndex(({id}) => id === wall), 1)[0]);
		if (sendRPC) {
			queue(rpc.moveWall.bind(rpc, wall, path));
		}
		[oldLayer, oldPath, newLayer, path] = [newLayer, path, oldLayer, oldPath];
		return doIt;
	      };
	undo.add(doIt(sendRPC), lang["UNDO_WALL_MOVE"]);
},
doMapDataSet = (key: string, data: any, sendRPC = true) => {
	const oldData = mapData.data[key],
	      doIt = (sendRPC = true) => {
		mapData.data[key] = data;
		if (sendRPC) {
			queue(() => rpc.setMapKeyData(key, data));
		}
		return undoIt;
	      },
	      undoIt = () => {
		if (oldData) {
			queue(() => rpc.setMapKeyData(key, mapData.data[key] = oldData));
		} else {
			delete mapData.data[key];
			queue(() => rpc.removeMapKeyData(key));
		}
		return doIt;
	      };
	undo.add(doIt(sendRPC), lang["UNDO_MAP_DATA_SET"]);
},
doMapDataRemove = (key: string, sendRPC = true) => {
	const oldData = mapData.data[key];
	if (!oldData) {
		return;
	}
	const doIt = (sendRPC = true) => {
		delete mapData.data[key];
		if (sendRPC) {
			queue(() => rpc.removeMapKeyData(key));
		}
		return undoIt;
	      },
	      undoIt = () => {
		mapData.data[key] = oldData;
		queue(() => rpc.setMapKeyData(key, oldData));
		return doIt;
	      };
	undo.add(doIt(sendRPC), lang["UNDO_MAP_DATA_REMOVE"]);
},
doMaskAdd = (m: Mask, sendRPC = true) => {
	let index = -1;
	const doIt = (sendRPC = true) => {
		index = masks.add(m);
		if (sendRPC) {
			queue(() => rpc.addToMask(m));
		}
		return undoIt;
	      },
	      undoIt = () => {
		      masks.remove(index);
		      queue(() => rpc.removeFromMask(index));
		      return doIt;
	      };
	undo.add(doIt(sendRPC), lang["UNDO_MASK_ADD"]);
},
doMaskRemove = (index: Uint, sendRPC = true) => {
	const oldOpaque = masks.baseOpaque,
	      oldMasks = cloneObject(masks.masks),
	      doIt = (sendRPC = true) => {
		masks.remove(index);
		if (sendRPC) {
			queue(() => rpc.removeFromMask(index));
		}
		return undoIt;
	      },
	      undoIt = () => {
		masks.set(oldOpaque, oldMasks);
		queue(() => rpc.setMask(oldOpaque, oldMasks));
		return doIt;
	      };
	undo.add(doIt(sendRPC), lang["UNDO_MASK_REMOVE"]);
},
doMaskSet = (m: MaskSet, sendRPC = true) => {
	let oldData: MaskSet = {
		"baseOpaque": masks.baseOpaque,
		"masks": masks.masks
	    };
	const doIt = (sendRPC = true) => {
		masks.set(m.baseOpaque, m.masks);
		if (sendRPC) {
			queue(rpc.setMask.bind(rpc, m.baseOpaque, m.masks));
		}
		[oldData, m] = [m, oldData];
		return doIt;
	      };
	undo.add(doIt(sendRPC), lang["UNDO_MASK_SET"]);
},
snapTokenToGrid = (x: Int, y: Int, width: Uint, height: Uint) => {
	const size = mapData.gridSize;
	switch (mapData.gridType) {
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
layersRPC = Object.freeze({
	"waitAdded": () => waitAdded[0],
	"waitMoved": unusedWaitFn,
	"waitRemoved": () => waitRemoved[0],
	"waitCopied": unusedWaitFn,
	"waitFolderAdded": () => waitFolderAdded[0],
	"waitFolderMoved": unusedWaitFn,
	"waitFolderRemoved": () => waitFolderRemoved[0],
	"waitLayerSetVisible": () => waitLayerShow[0],
	"waitLayerSetInvisible": () => waitLayerHide[0],
	"waitLayerSetLock": () => waitLayerLock[0],
	"waitLayerSetUnlock": () => waitLayerUnlock[0],
	"waitLayerPositionChange": () => waitLayerPositionChange[0],
	"waitLayerRename": () => waitLayerRename[0],
	"waitLayerSelect": () => waitLayerSelect[0],
	"list": invalidRPC,
	"createFolder": (path: string) => rpc.addLayerFolder(path).then(p => doLayerFolderAdd(p, false)),
	"move": invalidRPC,
	"moveFolder": invalidRPC,
	"remove": (path: string) => {
		undo.clear();
		return removeS(path);
	},
	"removeFolder": (path: string) => {
		undo.clear();
		return removeS(path);
	},
	"copy": invalidRPC
});
