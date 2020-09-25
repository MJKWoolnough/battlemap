import RPC from './lib/rpc_ws.js';
import {RPC as RPCType} from './types.js';

const broadcastIsAdmin = -1, broadcastCurrentUserMap = -2, broadcastCurrentUserMapData = -3, broadcastMapDataSet = -4, broadcastMapDataRemove = -5, broadcastImageItemAdd = -6, broadcastAudioItemAdd = -7, broadcastCharacterItemAdd = -8, broadcastMapItemAdd = -9, broadcastImageItemMove = -10, broadcastAudioItemMove = -11, broadcastCharacterItemMove = -12, broadcastMapItemMove = -13, broadcastImageItemRemove = -14, broadcastAudioItemRemove = -15, broadcastCharacterItemRemove = -16, broadcastMapItemRemove = -17, broadcastImageItemLink = -18, broadcastAudioItemLink = -19, broadcastCharacterItemLink = -20, broadcastMapItemLink = -21, broadcastImageFolderAdd = -22, broadcastAudioFolderAdd = -23, broadcastCharacterFolderAdd = -24, broadcastMapFolderAdd = -25, broadcastImageFolderMove = -26, broadcastAudioFolderMove = -27, broadcastCharacterFolderMove = -28, broadcastMapFolderMove = -29, broadcastImageFolderRemove = -30, broadcastAudioFolderRemove = -31, broadcastCharacterFolderRemove = -32, broadcastMapFolderRemove = -33, broadcastMapItemChange = -34, broadcastCharacterDataChange = -35, broadcastTokenDataChange = -36, broadcastCharacterDataRemove = -37, broadcastTokenDataRemove = -38, broadcastLayerAdd = -39, broadcastLayerFolderAdd = -40, broadcastLayerMove = -41, broadcastLayerRename = -42, broadcastLayerRemove = -43, broadcastMapLightChange = -44, broadcastLayerShow = -45, broadcastLayerHide = -46, broadcastLayerMaskAdd = -47, broadcastLayerMaskChange = -48, broadcastLayerMaskRemove = -49, broadcastTokenAdd = -50, broadcastTokenRemove = -51, broadcastTokenMoveLayer = -52, broadcastTokenMovePos = -53, broadcastTokenSetToken = -54, broadcastTokenSetImage = -55, broadcastTokenSetPattern = -56, broadcastTokenChange = -57, broadcastTokenFlip = -58, broadcastTokenFlop = -59, broadcastTokenSnap = -60, broadcastTokenSourceChange = -61, broadcastTokenSetData = -62, broadcastTokenUnsetData = -63, broadcastLayerShift = -64, broadcastLightShift = -65, broadcastTokenLightChange = -66, broadcastWallAdd = -67, broadcastWallRemove = -68, broadcastAny = -69;

export default function (url: string): Promise<Readonly<RPCType>>{
	return RPC(url, 1.1).then(rpc => {
		return Object.freeze({
			"waitLogin":               () => rpc.await(broadcastIsAdmin).then(checkUint),
			"waitCurrentUserMap":      () => rpc.await(broadcastCurrentUserMap, true).then(checkUint),
			"waitCurrentUserMapData":  () => rpc.await(broadcastCurrentUserMapData, true).then(checkMapData),
			"waitMapDataSet":          () => rpc.await(broadcastMapDataSet, true).then(checkKeyData),
			"waitMapDataRemove":       () => rpc.await(broadcastMapDataRemove, true).then(checkString),
			"waitCharacterDataChange": () => rpc.await(broadcastCharacterDataChange, true).then(checkCharacterDataChange),
			"waitTokenDataChange":     () => rpc.await(broadcastTokenDataChange, true).then(checkTokenDataChange),
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
			"waitTokenRemove":         () => rpc.await(broadcastTokenRemove, true).then(checkWallPos),
			"waitTokenMoveLayer":      () => rpc.await(broadcastTokenMoveLayer, true).then(checkTokenMoveLayer),
			"waitTokenMovePos":        () => rpc.await(broadcastTokenMovePos, true).then(checkTokenMovePos),
			"waitTokenSetToken":       () => rpc.await(broadcastTokenSetToken, true),
			"waitTokenSetImage":       () => rpc.await(broadcastTokenSetImage, true).then(checkWallPos),
			"waitTokenSetPattern":     () => rpc.await(broadcastTokenSetPattern, true).then(checkWallPos),
			"waitTokenChange":         () => rpc.await(broadcastTokenChange, true).then(checkTokenChange),
			"waitTokenFlip":           () => rpc.await(broadcastTokenFlip, true).then(checkTokenFlip),
			"waitTokenFlop":           () => rpc.await(broadcastTokenFlop, true).then(checkTokenFlop),
			"waitTokenSnap":           () => rpc.await(broadcastTokenSnap, true).then(checkTokenSnap),
			"waitTokenSourceChange":   () => rpc.await(broadcastTokenSourceChange, true).then(checkTokenSource),
			"waitLayerShift":          () => rpc.await(broadcastLayerShift, true).then(checkLayerShift),
			"waitLightShift":          () => rpc.await(broadcastLightShift, true).then(checkLightShift),
			"waitTokenLightChange":    () => rpc.await(broadcastTokenLightChange, true).then(checkLightChange),
			"waitWallAdded":           () => rpc.await(broadcastWallAdd, true).then(checkWallPath),
			"waitWallRemoved":         () => rpc.await(broadcastWallRemove, true).then(checkUint),
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

			"addLayer":         name                               => rpc.request("maps.addLayer", name).then(checkString),
			"addLayerFolder":   path                               => rpc.request("maps.addLayerFolder", path).then(checkString),
			"renameLayer":     (path, name)                        => rpc.request("maps.renameLayer", {path, name}).then(checkLayerRename),
			"moveLayer":       (from, to, position)                => rpc.request("maps.moveLayer", {from, to, position}).then(returnVoid),
			"showLayer":        path                               => rpc.request("maps.showLayer", path).then(returnVoid),
			"hideLayer":        path                               => rpc.request("maps.hideLayer", path).then(returnVoid),
			"addMask":         (path, mask)                        => rpc.request("maps.addMask", {path, mask}).then(returnVoid),
			"removeMask":       path                               => rpc.request("maps.removeMask", path).then(returnVoid),
			"removeLayer":      path                               => rpc.request("maps.removeLayer", path).then(returnVoid),
			"addToken":        (path, token)                       => rpc.request("maps.addToken", Object.assign(token, {"path": path})).then(checkUint),
			"removeToken":      id                                 => rpc.request("maps.removeToken", id).then(returnVoid),
			"setToken":        (id, x, y, width, height, rotation) => rpc.request("maps.setToken", {id, x, y, width, height, rotation}).then(returnVoid),
			"flipToken":       (id, flip)                          => rpc.request("maps.flipToken", {id, flip}).then(returnVoid),
			"flopToken":       (id, flop)                          => rpc.request("maps.flopToken", {id, flop}).then(returnVoid),
			"setTokenSnap":    (id, snap)                          => rpc.request("maps.setTokenSnap", {id, snap}).then(returnVoid),
			"setTokenPattern":  id                                 => rpc.request("maps.setTokenPattern", id).then(returnVoid),
			"setTokenImage":    id                                 => rpc.request("maps.setTokenImage", id).then(returnVoid),
			"setTokenSource":  (id, src)                           => rpc.request("maps.setTokenSource", {id, src}).then(returnVoid),
			"setTokenLayer":   (id, to)                            => rpc.request("maps.setTokenLayer", {id, to}).then(returnVoid),
			"setTokenPos":     (id, newPos)                        => rpc.request("maps.setTokenPos", {id, newPos}).then(returnVoid),
			"shiftLayer":      (path, dx, dy)                      => rpc.request("maps.shiftLayer", {path, dx, dy}).then(returnVoid),
			"shiftLight":      (x, y)                              => rpc.request("maps.shiftLight", {x, y}).then(returnVoid),
			"setTokenLight":   (id, lightColour, lightIntensity)   => rpc.request("maps.setTokenLight", {id, lightColour, lightIntensity}).then(returnVoid),
			"addWall":         (path, x1, y1, x2, y2, colour)      => rpc.request("maps.addWall", {path, x1, y1, x2, y2, colour}).then(returnVoid),
			"removeWall":       id                                 => rpc.request("maps.removeWall", id).then(returnVoid),

			"characterCreate":      name                   => rpc.request("characters.create", name).then(checkIDName),
			"characterModify":     (id, setting, removing) => rpc.request("characters.set", {id, setting, removing}).then(returnVoid),
			"characterGet":         id                     => rpc.request("characters.get", id).then(checkKeystoreData),

			"tokenModify": (id, setting, removing) => rpc.request("maps.modifyTokenData", {id, setting, removing}).then(returnVoid),

			"listPlugins":   () => rpc.request("plugins.list").then(checkPlugins),
			"enablePlugin":  (plugin: string) => rpc.request("plugins.enable", plugin).then(returnVoid),
			"disablePlugin": (plugin: string) => rpc.request("plugins.disable", plugin).then(returnVoid),

			"loggedIn":          ()                         => rpc.request("auth.loggedIn").then(checkBoolean),
			"loginRequirements": ()                         => rpc.request("auth.requirements").then(checkString),
			"login":              data                      => rpc.request("auth.login", data).then(checkString),
			"changePassword":    (oldPassword, newPassword) => rpc.request("auth.changePassword", {oldPassword, newPassword}).then(checkString),
			"logout":            ()                         => rpc.request("auth.logout").then(returnVoid),

			"broadcast": data => rpc.request("broadcast", data).then(checkBroadcast),
		} as RPCType);
	})
}

type checkers = [(data: any, name: string, key?: string) => void, string][];

const returnVoid = () => {},
      throwError = (err: string) => {throw new TypeError(err)},
      checkInt = (data: any, name = "Int", key = "") => {
	if (typeof data !== "number" || data % 1 !== 0) {
		throwError(key ? `invalid ${name} object, key '${key}' contains an invalid Int: ${JSON.stringify(data)}` : `expecting Int type, got ${JSON.stringify(data)}`);
	}
      },
      checkUint = (data: any, name = "Uint", key = "", max = Number.MAX_SAFE_INTEGER) => {
	if (typeof data !== "number" || data % 1 !== 0 || data < 0 || data > max) {
		throwError(key ? `invalid ${name} object, key '${key}' contains an invalid Uint: ${JSON.stringify(data)}` : `expecting Uint type, got ${JSON.stringify(data)}`);
	}
	return data;
      },
      checkByte = (data: any, name = "Byte", key = "") => checkUint(data, name, key, 255),
      checkObject = (data: any, name: string, key = "") => {
	if (typeof data !== "object") {
		throwError(key ? `invalid ${name} object, key '${key}' contains invalid data: ${JSON.stringify(data)}` : `expecting ${name} object, got ${JSON.stringify(data)}`);
	}
      },
      checkString = (data: any, name = "String", key = "") => {
	if (typeof data !== "string") {
		throwError(key ? `invalid ${name} object, key '${key}' contains an invalid string: ${JSON.stringify(data)}` : `expecting ${name} type, got ${JSON.stringify(data)}`);
	}
	return data;
      },
      checkBoolean = (data: any, name = "Boolean", key = "") => {
	if (typeof data !== "boolean") {
		throwError(key ? `invalid ${name} object, key '${key}' contains an invalid boolean: ${JSON.stringify(data)}` : `expecting ${name} type, got ${JSON.stringify(data)}`);
	}
	return data;
      },
      checkArray = (data: any, name: string, key = "") => {
	if (!(data instanceof Array)) {
		throwError(`invalid ${name} object, key '${key}' contains an invalid Array: ${JSON.stringify(data)}`);
	}
      },
      checker = (data: any, name: string, checkers: checkers) => {
	for (const [fn, key] of checkers) {
		if (!(key.charAt(0) === "?" && data[key] === undefined)) {
			fn(key ? data[key] : data, name, key);
		}
	}
	return data;
      },
      checksColour: checkers = [[checkObject, ""], [checkByte, "r"], [checkByte, "g"], [checkByte, "b"], [checkByte, "a"], [Object.freeze, ""]],
      checkColour = (data: any, name = "Colour") => checker(Object.freeze(data), name, checksColour),
      checksID: checkers = [[checkObject, ""], [checkUint, "id"]],
      checkID = (data: any, name: string) => checker(data, name, checksID),
      checksIDName: checkers = [[checkID, ""], [checkString, "name"]],
      checkIDName = (data: any) => checker(data, "IDName", checksIDName),
      checksFromTo: checkers = [[checkObject, ""], [checkString, "from"], [checkString, "to"]],
      checkFromTo = (data: any, name = "FromTo") => checker(data, name, checksFromTo),
      checksLayerMove: checkers = [[checkID, ""], [checkString, "to"]],
      checkLayerMove = (data: any) => checker(data, "LayerMove", checksLayerMove),
      checksLayerRename: checkers = [[checkObject, ""], [checkString, "path"], [checkString, "name"]],
      checkLayerRename = (data: any) => checker(data, "LayerRename", checksLayerRename),
      checksFolderLayers: checkers = [[checkObject, ""], [checkObject, "folders"], [checkObject, "items"]],
      checkFolderItems = (data: any) => {
	checker(data, "FolderItems", checksFolderLayers);
	for (const key in data["folders"]) {
		checkFolderItems(data["folders"][key]);
	}
	for (const key in data["items"]) {
		checkUint(data["items"][key], "FolderItems", key);
	}
	return data;
      },
      checksKeyData: checkers = [[checkObject, ""], [checkString, "key"]],
      checkKeyData = (data: any) => checker(data, "KeyData", checksKeyData),
      checksKeystoreData: checkers = [[checkObject, ""], [checkBoolean, "user"]],
      checkKeystoreData = (data: any, name = "KeystoreData", key = "") => {
	checkObject(data, name);
	for (const key in data) {
		checker(data[key], name, checksKeystoreData);
		if (data[key]["data"] === undefined) {
			throwError(`invalid KeystoreData object, key '${key}' contains no data`);
		}
	}
	return data;
      },
      checksKeystoreDataChange: checkers = [[checkObject, ""], [checkKeystoreData, "setting"], [checkArray, "removing"]],
      checkKeystoreDataChange = (data: any, name: string) => {
	checker(data, name, checksKeystoreDataChange)
	for (const r of data.removing) {
		checkString(r, name, "removing");
	}
	return data;
      },
      checksCharacterDataChange: checkers = [[checkKeystoreDataChange, ""], [checkUint, "id"]],
      checkCharacterDataChange = (data: any) => checker(data, "CharacterDataChange", checksCharacterDataChange),
      checksTokenDataChange: checkers = [[checkKeystoreDataChange, ""], [checkUint, "id"]],
      checkTokenDataChange = (data: any) => checker(data, "TokenDataChange", checksTokenDataChange),
      checksMapDetails: checkers = [[checkObject, ""], [checkUint, "gridSize"], [checkUint, "gridStroke"], [checkUint, "gridSize"], [checkColour, "gridColour"]],
      checkMapDetails = (data: any, name = "MapDetails") => checker(data, name, checksMapDetails),
      checksWallPos: checkers = [[checkObject, ""], [checkString, "path"], [checkUint, "pos"]],
      checkWallPos = (data: any, name = "TokenPos") => checker(data, name, checksWallPos),
      checksTokenChange: checkers = [[checkID, ""], [checkInt, "x"], [checkInt, "y"], [checkUint, "width"], [checkUint, "height"], [checkByte, "rotation"]],
      checkTokenChange = (data: any) => checker(data, "TokenChange", checksTokenChange),
      checksTokenMovePos: checkers = [[checkID, ""], [checkUint, "newPos"]],
      checkTokenMovePos = (data: any) => checker(data, "TokenMovePos", checksTokenMovePos),
      checksTokenMoveLayer: checkers = [[checkID, ""], [checkUint, "pos"]],
      checkTokenMoveLayer = (data: any) => checker(data, "TokenMoveLayer", checksTokenMoveLayer),
      checksTokenFlip: checkers = [[checkID, ""], [checkBoolean, "flip"]],
      checkTokenFlip = (data: any) =>  checker(data, "TokenFlip", checksTokenFlip),
      checksTokenFlop: checkers = [[checkID, ""], [checkBoolean, "flop"]],
      checkTokenFlop = (data: any) =>  checker(data, "TokenFlip", checksTokenFlop),
      checksTokenSnap: checkers = [[checkID, ""], [checkBoolean, "snap"]],
      checkTokenSnap = (data: any) =>  checker(data, "TokenFlip", checksTokenSnap),
      checksTokenSource: checkers = [[checkID, ""], [checkString, "source"]],
      checkTokenSource = (data: any) =>  checker(data, "TokenFlip", checksTokenSource),
      checksToken: checkers = [[checkObject, ""], [checkInt, "x"], [checkInt, "y"], [checkUint, "width"], [checkUint, "height"], [checkByte, "rotation"], [checkBoolean, "snap"], [checkColour, "lightColour"], [checkUint, "lightIntensity"]],
      checksTokenImage: checkers = [[checkUint, "src"], [checkUint, "patternWidth"], [checkUint, "patternHeight"], [checkBoolean, "flip"], [checkBoolean, "flop"], [checkKeystoreData, "tokenData"]],
      checksTokenShape: checkers = [[checkColour, "fill"], [checkColour, "stroke"], [checkUint, "strokeWidth"], [checkUint, "fillType"], [checkArray, "fills"]],
      checksCoords: checkers = [[checkObject, ""], [checkInt, "x"], [checkInt, "y"]],
      checksFills: checkers = [[checkObject, ""], [checkByte, "pos"], [checkColour, "colour"]],
      checkToken = (data: any, name = "Token") => {
	checker(data, name, checksToken);
	switch (data.tokenType) {
	case undefined:
	case 0:
		checker(data, name, checksTokenImage);
		break;
	case 2:
		checkArray(data.points, name, "points")
		for (const p of data.points) {
			checker(p, "Token->Points", checksCoords);
		}
	case 1:
		checker(data, name, checksTokenShape);
		for (const f of data.fills) {
			checker(f, "Token->Fills", checksFills);
		}
		break;
	default:
		throw new TypeError("invalid Token object, key 'tokenType' contains invalid data");
	}
	return data;
      },
      checksTokenAdd: checkers = [[checkID, ""], [checkToken, ""]],
      checkTokenAdd = (data: any) => checker(data, "TokenAdd", checksTokenAdd),
      checksLayerFolder: checkers = [[checkString, "name"], [checkBoolean, "hidden"], [checkArray, "children"]],
      checksLayerTokens: checkers = [[checkString, "name"], [checkBoolean, "hidden"], [checkUint, "mask"], [checkArray, "tokens"], [checkArray, "walls"]],
      checksLayerGrid: checkers = [[checkBoolean, "hidden"], [checkUint, "mask"]],
      checkLayerFolder = (data: any, name = "LayerFolder") => {
	if (name !== "MapData") {
		checker(data, name, checksLayerFolder);
	}
	for (const c of data["children"]) {
		checkObject(c, "LayerFolder");
		if (c.children !== undefined) {
			checkLayerFolder(c);
		} else if (c.name === "Grid" || c.name === "Light") {
			checker(c, "LayerGrid", checksLayerGrid);
		} else {
			checker(c, "LayerTokens", checksLayerTokens);
			for (const t of c["tokens"]) {
				checkToken(t);
			}
			for (const w of c["walls"]) {
				checkWall(w, "Layer->Wall");
			}
		}
	}
      },
      checksMapData: checkers = [[checkMapDetails, ""], [checkColour, "lightColour"], [checkUint, "lightX"], [checkUint, "lightY"], [checkArray, "children"], [checkLayerFolder, ""]],
      checkMapData = (data: any) => {
	checker(data, "MapData", checksMapData);
	return data;
      },
      checksLayerShift: checkers = [[checkObject, ""], [checkString, "path"], [checkInt, "dx"], [checkInt, "dy"]],
      checkLayerShift = (data: any) => checker(data, "LayerShift", checksLayerShift),
      checkLightShift = (data: any) => checker(data, "LightShift", checksCoords),
      checksLightChange: checkers = [[checkObject, ""], [checkString, "path"], [checkUint, "pos"], [checkColour, "lightColour"], [checkUint, "lightIntensity"]],
      checkLightChange = (data: any) => checker(data, "LightChange", checksLightChange),
      checksWall: checkers = [[checkObject, ""], [checkUint, "x1"], [checkUint, "y1"], [checkUint, "x2"], [checkUint, "y2"], [checkColour, "colour"]],
      checkWall = (data: any, name = "Wall") => checker(data, name, checksWall),
      checksWallPath: checkers = [[checkWall, ""], [checkString, "path"]],
      checkWallPath = (data: any) => checker(data, "WallPath", checksWallPath),
      checkPlugins = (data: any) => {
	checkObject(data, "plugins");
	for (const p in data) {
		checkObject(data, "plugins->plugin", p);
		checkBoolean(data[p]["enabled"], "plugin->enabled", "enabled");
		checkObject(data[p]["data"], "plugin->data", "data");
	}
	return data;
      },
      checkBroadcast = (data: any) => {
	checkObject(data, "Broadcast");
	if (data["type"] === undefined) {
		throwError("invalid Broadcast object, missing 'type' key");
	}
	return data;
      };
