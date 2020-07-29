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

type checkers = [(data: any, name: string, key?: string) => void, string | undefined][];

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
      checkByte = (data: any, name = "Byte", key?: string) => checkUint(data, name, key, 255),
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
      checkArray = (data: any, name: string, key = "") => {
	const d = data[key];
	if (!(d instanceof Array)) {
		throw new Error(`invalid ${name} object, key '${key}' contains an invalid Array: ${JSON.stringify(d)}`);
	}
      },
      checker = (data: any, name: string, checkers: checkers) => {
	for (const [fn, key] of checkers) {
		fn(data, name, key);
	}
	return data;
      },
      checksColour: checkers = [[checkObject, undefined], [checkByte, "r"], [checkByte, "g"], [checkByte, "b"], [checkByte, "a"]],
      checkColour = (data: any, name = "Colour", key?: string) => checker(dataOrKey(data, key), key === undefined ? "Colour" : name, checksColour),
      checksIDName: checkers = [[checkObject, undefined], [checkUint, "id"], [checkString, "name"]],
      checkIDName = (data: any) => checker(data, "IDName", checksIDName),
      checksFromTo: checkers = [[checkObject, undefined], [checkString, "from"], [checkString, "to"]],
      checkFromTo = (data: any, name = "FromTo") => checker(data, name, checksFromTo),
      checksLayerMove: checkers = [[checkFromTo, undefined], [checkUint, "position"]],
      checkLayerMove = (data: any) => checker(data, "LayerMove", checksLayerMove),
      checksLayerRename: checkers = [[checkObject, undefined], [checkString, "path"], [checkString, "name"]],
      checkLayerRename = (data: any) => checker(data, "LayerRename", checksLayerRename),
      checksFolderLayers: checkers = [[checkObject, undefined], [checkObject, "folders"], [checkObject, "items"]],
      checkFolderItems = (data: any) => {
	checker(data, "FolderItems", checksFolderLayers);
	for (const key in data["folders"]) {
		checkFolderItems(data["folders"][key]);
	}
	for (const key in data["items"]) {
		checkUint(data["items"], "FolderItems", key);
	}
	return data;
      },
      checkKeystoreData = (data: any, name = "KeystoreData", key?: string) => {
	const d = dataOrKey(data, key);
	checkObject(d, name);
	for (const key in d) {
		checkObject(d, name, key);
		checkBoolean(d[key], name, "user");
		if (d[key]["data"] === undefined) {
			throw new Error(`invalid KeystoreData object, key '${key}' contains no data`);
		}
	}
	return d;
      },
      checksKeystoreDataChange: checkers = [[checkObject, undefined], [checkInt, "id"], [checkKeystoreData, "data"]],
      checkKeystoreDataChange = (data: any) => checker(data, "KeystoreDataChange", checksKeystoreDataChange),
      checksKeystoreDataRemove: checkers = [[checkObject, undefined], [checkUint, "id"], [checkArray, "keys"]],
      checkKeystoreDataRemove = (data: any) => {
	checker(data, "KeystoreDataRemove", checksKeystoreDataRemove);
	for (const key of data["keys"]) {
		if (typeof key !== "string") {
			throw new Error(`invalid KeystoreDataRemove object, 'keys' contains an invalid key: ${JSON.stringify(key)}`);
		}
	}
	return data;
      },
      checksMapDetails: checkers = [[checkObject, undefined], [checkUint, "gridSize"], [checkUint, "gridStroke"], [checkUint, "gridWidth"], [checkUint, "gridHeight"], [checkColour, "gridColour"]],
      checkMapDetails = (data: any, name = "MapDetails") => checker(data, name, checksMapDetails),
      checksTokenPos: checkers = [[checkObject, undefined], [checkString, "path"], [checkUint, "pos"]],
      checkTokenPos = (data: any, name = "TokenPos") => checker(data, name, checksTokenPos),
      checksTokenChange: checkers = [[checkTokenPos, undefined], [checkInt, "x"], [checkInt, "y"], [checkUint, "width"], [checkUint, "height"], [checkByte, "rotation"]],
      checkTokenChange = (data: any) => checker(data, "TokenChange", checksTokenChange),
      checksTokenMovePos: checkers = [[checkTokenPos, undefined], [checkUint, "newPos"]],
      checkTokenMovePos = (data: any) => checker(data, "TokenMovePos", checksTokenMovePos),
      checksTokenMoveLayer: checkers = [[checkTokenPos, undefined], [checkUint, "pos"]],
      checkTokenMoveLayer = (data: any) => checker(data, "TokenMoveLayer", checksTokenMoveLayer),
      checksTokenFlip: checkers = [[checkTokenPos, undefined], [checkBoolean, "flip"]],
      checkTokenFlip = (data: any) =>  checker(data, "TokenFlip", checksTokenFlip),
      checksTokenFlop: checkers = [[checkTokenPos, undefined], [checkBoolean, "flop"]],
      checkTokenFlop = (data: any) =>  checker(data, "TokenFlip", checksTokenFlop),
      checksTokenSnap: checkers = [[checkTokenPos, undefined], [checkBoolean, "snap"]],
      checkTokenSnap = (data: any) =>  checker(data, "TokenFlip", checksTokenSnap),
      checksTokenSource: checkers = [[checkTokenPos, undefined], [checkString, "source"]],
      checkTokenSource = (data: any) =>  checker(data, "TokenFlip", checksTokenSource),
      checksTokenID: checkers = [[checkTokenPos, undefined], [checkUint, "id"]],
      checkTokenID = (data: any) =>  checker(data, "TokenFlip", checksTokenID),
      checksToken: checkers = [[checkObject, undefined], [checkUint, "src"], [checkColour, "stroke"], [checkUint, "strokeWidth"], [checkInt, "x"], [checkInt, "y"], [checkUint, "width"], [checkUint, "height"], [checkUint, "patternWidth"], [checkUint, "patternHeight"], [checkByte, "rotation"], [checkBoolean, "flip"], [checkBoolean, "flop"], [checkUint, "tokenData"], [checkUint, "tokenType"], [checkBoolean, "snap"]],
      checkToken = (data: any, name = "Token") => checker(data, name, checksToken),
      checksTokenAdd: checkers = [[checkTokenPos, undefined], [checkToken, undefined]],
      checkTokenAdd = (data: any) => checker(data, "TokenAdd", checksTokenAdd),
      checksLayerFolder: checkers = [[checkUint, "id"], [checkString, "name"], [checkBoolean, "hidden"], [checkArray, "children"]],
      checksLayerTokens: checkers = [[checkUint, "id"], [checkString, "name"], [checkBoolean, "hidden"], [checkUint, "mask"], [checkArray, "tokens"]],
      checkLayerFolder = (data: any, name = "LayerFolder") => {
	checker(data, name, checksLayerFolder);
	for (const c of data["children"]) {
		checkObject(c, "LayerFolder");
		if (c.mask === undefined) {
			checkLayerFolder(c);
		} else {
			checker(c, "LayerTokens", checksLayerTokens);
			for (const t of c["tokens"]) {
				checkToken(t);
			}
		}
	}
      },
      checksMapData: checkers = [[checkMapDetails, undefined], [checkColour, "lightColour"], [checkLayerFolder, undefined]],
      checkMapData = (data: any) => checker(data, "MapData", checksMapData),
      checkBroadcast = (data: any) => {
	checkObject(data, "Broadcast");
	if (data["type"] === undefined) {
		throw new Error("invalid Broadcast object, missing 'type' key");
	}
	return data;
      };
