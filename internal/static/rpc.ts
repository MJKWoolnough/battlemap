import RPC from './lib/rpc_ws.js';
import {RPC as RPCType} from './types.js';

const broadcastIsAdmin = -1, broadcastCurrentUserMap = -2, broadcastCurrentUserMapData = -3, broadcastImageItemAdd = -4, broadcastAudioItemAdd = -5, broadcastCharacterItemAdd = -6, broadcastMapItemAdd = -7, broadcastImageItemMove = -8, broadcastAudioItemMove = -9, broadcastCharacterItemMove = -10, broadcastMapItemMove = -11, broadcastImageItemRemove = -12, broadcastAudioItemRemove = -13, broadcastCharacterItemRemove = -14, broadcastMapItemRemove = -15, broadcastImageItemLink = -16, broadcastAudioItemLink = -17, broadcastCharacterItemLink = -18, broadcastMapItemLink = -19, broadcastImageFolderAdd = -20, broadcastAudioFolderAdd = -21, broadcastCharacterFolderAdd = -22, broadcastMapFolderAdd = -23, broadcastImageFolderMove = -24, broadcastAudioFolderMove = -25, broadcastCharacterFolderMove = -26, broadcastMapFolderMove = -27, broadcastImageFolderRemove = -28, broadcastAudioFolderRemove = -29, broadcastCharacterFolderRemove = -30, broadcastMapFolderRemove = -31, broadcastMapItemChange = -32, broadcastCharacterDataChange = -33, broadcastTokenDataChange = -34, broadcastCharacterDataRemove = -35, broadcastTokenDataRemove = -36, broadcastLayerAdd = -37, broadcastLayerFolderAdd = -38, broadcastLayerMove = -39, broadcastLayerRename = -40, broadcastLayerRemove = -41, broadcastMapLightChange = -42, broadcastLayerShow = -43, broadcastLayerHide = -44, broadcastLayerMaskAdd = -45, broadcastLayerMaskChange = -46, broadcastLayerMaskRemove = -47, broadcastTokenAdd = -48, broadcastTokenRemove = -49, broadcastTokenMoveLayer = -50, broadcastTokenMovePos = -51, broadcastTokenSetToken = -52, broadcastTokenSetImage = -53, broadcastTokenSetPattern = -54, broadcastTokenChange = -55, broadcastTokenFlip = -56, broadcastTokenFlop = -57, broadcastTokenSnap = -58, broadcastTokenSourceChange = -59, broadcastTokenSetData = -60, broadcastTokenUnsetData = -61, broadcastAny = -62;

export default function (url: string): Promise<Readonly<RPCType>>{
	return RPC(url, 1.1).then(rpc => {
		return Object.freeze({
			"waitLogin":               () => rpc.await(broadcastIsAdmin).then(checkUint),
			"waitCurrentUserMap":      () => rpc.await(broadcastCurrentUserMap, true).then(checkUint),
			"waitCurrentUserMapData":  () => rpc.await(broadcastCurrentUserMapData, true).then(checkMapData),
			"waitCharacterDataChange": () => rpc.await(broadcastCharacterDataChange, true).then(checkKeystoreDataChange),
			"waitCharacterDataRemove": () => rpc.await(broadcastCharacterDataRemove, true).then(checkKeystoreDataRemove),
			"waitTokenDataChange":     () => rpc.await(broadcastTokenDataChange, true).then(checkKeystoreDataChange),
			"waitTokenDataRemove":     () => rpc.await(broadcastTokenDataRemove, true).then(checkKeystoreDataRemove),
			"waitMapChange":           () => rpc.await(broadcastMapItemChange, true).then(checkMapDetails),
			"waitLayerAdd":            () => rpc.await(broadcastLayerAdd, true).then(checkString),
			"waitLayerFolderAdd":      () => rpc.await(broadcastLayerFolderAdd, true).then(checkString),
			"waitLayerMove":           () => rpc.await(broadcastLayerMove, true).then(checkLayerMove),
			"waitLayerRename":         () => rpc.await(broadcastLayerRename, true).then(checkLayerRename),
			"waitLayerRemove":         () => rpc.await(broadcastLayerRemove, true).then(checkString),
			"waitMapLightChange":      () => rpc.await(broadcastMapLightChange, true).then(checkColour),
			"waitLayerShow":           () => rpc.await(broadcastLayerShow, true).then(checkString),
			"waitLayerHide":           () => rpc.await(broadcastLayerHide, true).then(checkString),
			"waitLayerMaskAdd":        () => rpc.await(broadcastLayerMaskAdd, true),
			"waitLayerMaskChange":     () => rpc.await(broadcastLayerMaskChange, true),
			"waitLayerMaskRemove":     () => rpc.await(broadcastLayerMaskRemove, true),
			"waitTokenAdd":            () => rpc.await(broadcastTokenAdd, true).then(checkTokenAdd),
			"waitTokenRemove":         () => rpc.await(broadcastTokenRemove, true).then(checkTokenPos),
			"waitTokenMoveLayer":      () => rpc.await(broadcastTokenMoveLayer, true).then(checkTokenMoveLayer),
			"waitTokenMovePos":        () => rpc.await(broadcastTokenMovePos, true).then(checkTokenMovePos),
			"waitTokenSetToken":       () => rpc.await(broadcastTokenSetToken, true),
			"waitTokenSetImage":       () => rpc.await(broadcastTokenSetImage, true).then(checkTokenPos),
			"waitTokenSetPattern":     () => rpc.await(broadcastTokenSetPattern, true).then(checkTokenPos),
			"waitTokenChange":         () => rpc.await(broadcastTokenChange, true).then(checkTokenChange),
			"waitTokenFlip":           () => rpc.await(broadcastTokenFlip, true).then(checkTokenFlip),
			"waitTokenFlop":           () => rpc.await(broadcastTokenFlop, true).then(checkTokenFlop),
			"waitTokenSnap":           () => rpc.await(broadcastTokenSnap, true).then(checkTokenSnap),
			"waitTokenSourceChange":   () => rpc.await(broadcastTokenSourceChange, true).then(checkTokenSource),
			"waitTokenSetData":        () => rpc.await(broadcastTokenSetData, true).then(checkTokenID),
			"waitTokenUnsetData":      () => rpc.await(broadcastTokenUnsetData, true).then(checkTokenPos),
			"waitBroadcast":           () => rpc.await(broadcastAny, true).then(checkBroadcast),

			"images": {
				"waitAdded":         () => rpc.await(broadcastImageItemAdd, true).then(checkIDName),
				"waitMoved":         () => rpc.await(broadcastImageItemMove, true).then(checkFromTo),
				"waitRemoved":       () => rpc.await(broadcastImageItemRemove, true).then(checkString),
				"waitLinked":        () => rpc.await(broadcastImageItemLink, true).then(checkIDName),
				"waitFolderAdded":   () => rpc.await(broadcastImageFolderAdd, true).then(checkString),
				"waitFolderMoved":   () => rpc.await(broadcastImageFolderMove, true).then(checkFromTo),
				"waitFolderRemoved": () => rpc.await(broadcastImageFolderRemove, true).then(checkString),

				"list":         ()         => rpc.request("imageAssets.list").then(checkFolderItems),
				"createFolder":  path      => rpc.request("imageAssets.createFolder", path).then(checkString),
				"move":         (from, to) => rpc.request("imageAssets.move", {from, to}).then(checkString),
				"moveFolder":   (from, to) => rpc.request("imageAssets.moveFolder", {from, to}).then(checkString),
				"remove":        path      => rpc.request("imageAssets.remove", path).then(returnVoid),
				"removeFolder":  path      => rpc.request("imageAssets.removeFolder", path).then(returnVoid),
				"link":         (id, name) => rpc.request("imageAssets.link", {id, name}).then(checkString),
			},

			"audio": {
				"waitAdded":         () => rpc.await(broadcastAudioItemAdd, true).then(checkIDName),
				"waitMoved":         () => rpc.await(broadcastAudioItemMove, true).then(checkFromTo),
				"waitRemoved":       () => rpc.await(broadcastAudioItemRemove, true).then(checkString),
				"waitLinked":        () => rpc.await(broadcastAudioItemLink, true).then(checkIDName),
				"waitFolderAdded":   () => rpc.await(broadcastAudioFolderAdd, true).then(checkString),
				"waitFolderMoved":   () => rpc.await(broadcastAudioFolderMove, true).then(checkFromTo),
				"waitFolderRemoved": () => rpc.await(broadcastAudioFolderRemove, true).then(checkString),

				"list":         ()         => rpc.request("audioAssets.list").then(checkFolderItems),
				"createFolder":  path      => rpc.request("audioAssets.createFolder", path).then(checkString),
				"move":         (from, to) => rpc.request("audioAssets.move", {from, to}).then(checkString),
				"moveFolder":   (from, to) => rpc.request("audioAssets.moveFolder", {from, to}).then(checkString),
				"remove":        path      => rpc.request("audioAssets.remove", path).then(returnVoid),
				"removeFolder":  path      => rpc.request("audioAssets.removeFolder", path).then(returnVoid),
				"link":         (id, name) => rpc.request("audioAssets.link", {id, name}).then(checkString),
			},

			"characters": {
				"waitAdded":         () => rpc.await(broadcastCharacterItemAdd, true).then(checkIDName),
				"waitMoved":         () => rpc.await(broadcastCharacterItemMove, true).then(checkFromTo),
				"waitRemoved":       () => rpc.await(broadcastCharacterItemRemove, true).then(checkString),
				"waitLinked":        () => rpc.await(broadcastCharacterItemLink, true).then(checkIDName),
				"waitFolderAdded":   () => rpc.await(broadcastCharacterFolderAdd, true).then(checkString),
				"waitFolderMoved":   () => rpc.await(broadcastCharacterFolderMove, true).then(checkFromTo),
				"waitFolderRemoved": () => rpc.await(broadcastCharacterFolderRemove, true).then(checkString),

				"list":         ()         => rpc.request("characters.list").then(checkFolderItems),
				"createFolder":  path      => rpc.request("characters.createFolder", path).then(checkString),
				"move":         (from, to) => rpc.request("characters.move", {from, to}).then(checkString),
				"moveFolder":   (from, to) => rpc.request("characters.moveFolder", {from, to}).then(checkString),
				"remove":        path      => rpc.request("characters.remove", path).then(returnVoid),
				"removeFolder":  path      => rpc.request("characters.removeFolder", path).then(returnVoid),
				"link":         (id, name) => rpc.request("characters.link", {id, name}).then(checkString),
			},

			"maps": {
				"waitAdded":         () => rpc.await(broadcastMapItemAdd, true).then(checkIDName),
				"waitMoved":         () => rpc.await(broadcastMapItemMove, true).then(checkFromTo),
				"waitRemoved":       () => rpc.await(broadcastMapItemRemove, true).then(checkString),
				"waitLinked":        () => rpc.await(broadcastMapItemLink, true).then(checkIDName),
				"waitFolderAdded":   () => rpc.await(broadcastMapFolderAdd, true).then(checkString),
				"waitFolderMoved":   () => rpc.await(broadcastMapFolderMove, true).then(checkFromTo),
				"waitFolderRemoved": () => rpc.await(broadcastMapFolderRemove, true).then(checkString),

				"list":         ()         => rpc.request("maps.list").then(checkFolderItems),
				"createFolder":  path      => rpc.request("maps.createFolder", path).then(checkString),
				"move":         (from, to) => rpc.request("maps.move", {from, to}).then(checkString),
				"moveFolder":   (from, to) => rpc.request("maps.moveFolder", {from, to}).then(checkString),
				"remove":        path      => rpc.request("maps.remove", path).then(returnVoid),
				"removeFolder":  path      => rpc.request("maps.removeFolder", path).then(returnVoid),
				"link":         (id, name) => rpc.request("maps.link", {id, name}).then(checkString),
			},

			"connID": () => rpc.request("conn.connID"),

			"setCurrentMap":  id => rpc.request("maps.setCurrentMap", id).then(returnVoid),
			"getUserMap":    ()  => rpc.request("maps.getUserMap").then(checkUint),
			"setUserMap":     id => rpc.request("maps.setUserMap", id).then(returnVoid),
			"getMapData":     id => rpc.request("maps.getMapData", id).then(checkMapData),

			"newMap":         map    => rpc.request("maps.new", map).then(checkIDName),
			"setMapDetails":  map    => rpc.request("maps.setMapDetails", map).then(returnVoid),
			"setLightColour": colour => rpc.request("maps.setLightColour", colour).then(returnVoid),

			"addLayer":         name                                      => rpc.request("maps.addLayer", name).then(checkString),
			"addLayerFolder":   path                                      => rpc.request("maps.addLayerFolder", path).then(checkString),
			"renameLayer":     (path, name)                               => rpc.request("maps.renameLayer", {path, name}).then(checkLayerRename),
			"moveLayer":       (from, to, position)                       => rpc.request("maps.moveLayer", {from, to, position}).then(returnVoid),
			"showLayer":        path                                      => rpc.request("maps.showLayer", path).then(returnVoid),
			"hideLayer":        path                                      => rpc.request("maps.hideLayer", path).then(returnVoid),
			"addMask":         (path, mask)                               => rpc.request("maps.addMask", {path, mask}).then(returnVoid),
			"removeMask":       path                                      => rpc.request("maps.removeMask", path).then(returnVoid),
			"removeLayer":      path                                      => rpc.request("maps.removeLayer", path).then(returnVoid),
			"addToken":        (path, token)                              => rpc.request("maps.addToken", Object.assign(token, {"path": path})).then(checkUint),
			"removeToken":     (path, pos)                                => rpc.request("maps.removeToken", {path, pos}).then(returnVoid),
			"setToken":        (path, pos, x, y, width, height, rotation) => rpc.request("maps.setToken", {path, pos, x, y, width, height, rotation}).then(returnVoid),
			"flipToken":       (path, pos, flip)                          => rpc.request("maps.flipToken", {path, pos, flip}).then(returnVoid),
			"flopToken":       (path, pos, flop)                          => rpc.request("maps.flopToken", {path, pos, flop}).then(returnVoid),
			"setTokenSnap":    (path, pos, snap)                          => rpc.request("maps.setTokenSnap", {path, pos, snap}).then(returnVoid),
			"setTokenPattern": (path, pos)                                => rpc.request("maps.setTokenPattern", {path, pos}).then(returnVoid),
			"setTokenImage":   (path, pos)                                => rpc.request("maps.setTokenImage", {path, pos}).then(returnVoid),
			"setTokenSource":  (path, pos, src)                           => rpc.request("maps.setTokenSource", {path, pos, src}).then(returnVoid),
			"setTokenLayer":   (from, pos, to)                            => rpc.request("maps.setTokenLayer", {from, pos, to}).then(returnVoid),
			"setTokenPos":     (path, pos, newPos)                        => rpc.request("maps.setTokenPos", {path, pos, newPos}).then(returnVoid),

			"characterCreate":      name      => rpc.request("characters.create", name).then(checkIDName),
			"characterSet":        (id, data) => rpc.request("characters.set", {id, data}).then(returnVoid),
			"characterGet":         id        => rpc.request("characters.get", id).then(checkKeystoreData),
			"characterRemoveKeys": (id, keys) => rpc.request("characters.removeKeys", {id, keys}).then(returnVoid),

			"tokenCreate":     (path, pos) => rpc.request("maps.setAsToken", {path, pos}).then(checkUint),
			"tokenSet":        (id, data)  => rpc.request("tokens.set", {id, data}).then(returnVoid),
			"tokenGet":         id         => rpc.request("tokens.get", id).then(checkKeystoreData),
			"tokenRemoveKeys": (id, keys)  => rpc.request("tokens.removeKeys", {id, keys}).then(returnVoid),
			"tokenDelete":     (path, pos) => rpc.request("maps.unsetAsToken", {path, pos}).then(returnVoid),
			"tokenClone":       id         => rpc.request("tokens.clone", id).then(checkUint),

			"loggedIn":          ()                         => rpc.request("auth.loggedIn").then(checkBoolean),
			"loginRequirements": ()                         => rpc.request("auth.requirements").then(checkString),
			"login":              data                      => rpc.request("auth.login", data).then(checkString),
			"changePassword":    (oldPassword, newPassword) => rpc.request("auth.changePassword", {oldPassword, newPassword}).then(checkString),
			"logout":            ()                         => rpc.request("auth.logout").then(returnVoid),

			"broadcast": data => rpc.request("broadcast", data).then(checkBroadcast),

			"close": rpc.close
		} as RPCType);
	})
}

const returnVoid = () => {},
      dataOrKey = (data: any, key?: string) => key === undefined ? data : data[key],
      checkInt = (data: any, name = "Int", key?: string) => {
	const d = dataOrKey(data, key);
	if (typeof d !== "number" || d % 1 !== 0) {
		throw new Error(key === undefined ? `expecting Int type, got ${JSON.stringify(d)}` : `invalid ${name} object, key '${key}' contains an invalid Int: ${JSON.stringify(d)}`);
	}
	return d;
      },
      checkUint = (data: any, name = "Uint", key?: string, max = Number.MAX_SAFE_INTEGER) => {
	const d = dataOrKey(data, key);
	if (typeof d !== "number" || d % 1 !== 0) {
		throw new Error(key === undefined ? `expecting Uint type, got ${JSON.stringify(d)}` : `invalid ${name} object, key '${key}' contains an invalid Uint: ${JSON.stringify(d)}`);
	}
	return d;
      },
      checkObject = (data: any, name: string, key?: string) => {
	const d = dataOrKey(data, key);
	if (typeof d !== "object") {
		throw new Error(key === undefined ? `expecting ${name} object, got ${JSON.stringify(d)}` : `invalid ${name} object, key '${key}' contains invalid data: ${JSON.stringify(d)}`);
	}
      },
      checkString = (data: any, name = "String", key?: string) => {
	const d = dataOrKey(data, key);
	if (typeof d !== "string") {
		throw new Error(key === undefined ? `expecting ${name} type, got ${JSON.stringify(d)}` : `invalid ${name} object, key '${key}' contains an invalid string: ${JSON.stringify(d)}`);
	}
	return data;
      },
      checkBoolean = (data: any, name = "Boolean", key?: string) => {
	const d = dataOrKey(data, key);
	if (typeof d !== "boolean") {
		throw new Error(key === undefined ? `expecting ${name} type, got ${JSON.stringify(d)}` : `invalid ${name} object, key '${key}' contains an invalid boolean: ${JSON.stringify(d)}`);
	}
	return d;
      },
      checkArray = (data: any, name: string, key: string) => {
	const d = data[key];
	if (!(d instanceof Array)) {
		throw new Error(`invalid ${name} object, key '${key}' contains an invalid Array: ${JSON.stringify(d)}`);
	}
      },
      checkColour = (data: any) => {
	checkObject(data, "Colour");
	checkUint(data, "Colour", "r", 255);
	checkUint(data, "Colour", "g", 255);
	checkUint(data, "Colour", "b", 255);
	checkUint(data, "Colour", "a", 255);
	return data;
      },
      checkIDName = (data: any) => {
	checkObject(data, "IDName");
	checkUint(data, "IDName", "id");
	checkString(data, "IDName", "name");
	return data;
      },
      checkFromTo = (data: any, name = "FromTo") => {
	checkObject(data, name);
	checkString(data, name, "from");
	checkString(data, name, "to");
	return data;
      },
      checkLayerMove = (data: any) => {
	checkFromTo(data, "LayerMove");
	checkUint(data, "LayerMove", "position");
	return data;
      },
      checkLayerRename = (data: any) => {
	checkObject(data, "LayerRename");
	checkString(data, "LayerRename", "path");
	checkString(data, "LayerRename", "name");
	return data;
      },
      checkFolderItems = (data: any) => {
	checkObject(data, "FolderItems");
	checkObject(data, "FolderItems", "folders");
	checkObject(data, "FolderItems", "items");
	for (const key in data["folders"]) {
		checkFolderItems(data["folders"][key]);
	}
	for (const key in data["items"]) {
		checkUint(data["items"], "FolderItems", key);
	}
	return data;
      },
      checkKeystoreData = (data: any) => {
	checkObject(data, "KeystoreData");
	for (const key in data) {
		checkObject(data, "KeystoreData", key);
		checkBoolean(data[key], "KeystoreData", "user");
		if (data[key]["data"] === undefined) {
			throw new Error(`invalid KeystoreData object, key '${key}' contains no data`);
		}
	}
	return data;
      },
      checkKeystoreDataChange = (data: any) => {
	checkObject(data, "KeystoreDataChange");
	checkUint(data, "KeystoreDataChange", "id");
	checkKeystoreData(data["data"]);
	return data;
      },
      checkKeystoreDataRemove = (data: any) => {
	checkObject(data, "KeystoreDataRemove");
	checkUint(data, "KeystoreDataRemove", "id");
	checkArray(data, "KeystoreDataRemove", "keys");
	for (const key of data["keys"]) {
		if (typeof key !== "string") {
			throw new Error(`invalid KeystoreDataRemove object, 'keys' contains an invalid key: ${JSON.stringify(key)}`);
		}
	}
	return data;
      },
      checkMapDetails = (data: any, name = "MapDetails") => {
	checkObject(data, name);
	checkUint(data, name, "gridSize");
	checkUint(data, name, "gridStroke");
	checkUint(data, name, "gridWidth");
	checkUint(data, name, "gridHeight");
	checkColour(data["gridColour"]);
	return data;
      },
      checkTokenPos = (data: any, name = "TokenPos") => {
	checkObject(data, name);
	checkString(data, name, "path");
	checkUint(data, name, "pos");
	return data;
      },
      checkTokenChange = (data: any) => {
	checkTokenPos(data, "TokenChange");
	checkInt(data, "TokenChange", "x");
	checkInt(data, "TokenChange", "y");
	checkUint(data, "TokenChange", "width");
	checkUint(data, "TokenChange", "height");
	checkUint(data, "TokenChange", "rotation", 255);
	return data;
      },
      checkTokenMovePos = (data: any) => {
	checkTokenPos(data, "TokenMovePos");
	checkUint(data, "TokenMovePos", "newPos");
	return data;
      },
      checkTokenMoveLayer = (data: any) => {
	checkTokenPos(data, "TokenMoveLayer");
	checkUint(data, "TokenMoveLayer", "pos");
	return data;
      },
      checkTokenFlip = (data: any) => {
	checkTokenPos(data, "TokenFlip");
	checkBoolean(data, "TokenFlip", "flip");
	return data;
      },
      checkTokenFlop = (data: any) => {
	checkTokenPos(data, "TokenFlop");
	checkBoolean(data, "TokenFlop", "flop");
	return data;
      },
      checkTokenSnap = (data: any) => {
	checkTokenPos(data, "TokenSnap");
	checkBoolean(data, "TokenSnap", "snap");
	return data;
      },
      checkTokenSource = (data: any) => {
	checkTokenPos(data, "TokenSource");
	checkString(data, "TokenSource", "src");
	return data;
      },
      checkTokenID = (data: any) => {
	checkTokenPos(data, "TokenID");
	checkUint(data, "TokenID", "id");
	return data;
      },
      checkToken = (data: any, name = "Token") => {
	checkObject(data, name);
	checkUint(data, name, "src");
	checkColour(data["stroke"]);
	checkUint(data, name, "strokeWidth");
	checkInt(data, name, "x");
	checkInt(data, name, "y");
	checkUint(data, name, "width");
	checkUint(data, name, "height");
	checkUint(data, name, "patternWidth");
	checkUint(data, name, "patternHeight");
	checkUint(data, name, "rotation");
	checkBoolean(data, name, "flip");
	checkBoolean(data, name, "flop");
	checkUint(data, name, "tokenData");
	checkUint(data, name, "tokenType");
	checkBoolean(data, name, "snap");
	return data;
      },
      checkTokenAdd = (data: any) => {
	checkTokenPos(data, "TokenAdd");
	checkToken(data, "TokenAdd");
	return data;
      },
      checkLayerFolder = (data: any, name = "LayerFolder") => {
	checkUint(data, name, "id");
	checkString(data, name, "name");
	checkBoolean(data, name, "hidden");
	checkArray(data, name, "children");
	for (const c of data["children"]) {
		checkObject(c, "LayerFolder");
		if (c.mask === undefined) {
			checkLayerFolder(c);
		} else {
			checkUint(c, "LayerTokens", "id");
			checkString(c, "LayerTokens", "name");
			checkBoolean(c, "LayerTokens", "hidden");
			checkUint(c, "LayerTokens", "mask");
			checkArray(c, "LayerTokens", "tokens");
			for (const t of c["tokens"]) {
				checkToken(t);
			}
		}
	}
      },
      checkMapData = (data: any) => {
	checkMapDetails(data, "MapData");
	checkColour(data["lightColour"]);
	checkLayerFolder(data, "MapData");
	return data;
      },
      checkBroadcast = (data: any) => {
	checkObject(data, "Broadcast");
	if (data["type"] === undefined) {
		throw new Error("invalid Broadcast object, missing 'type' key");
	}
	return data;
      };
