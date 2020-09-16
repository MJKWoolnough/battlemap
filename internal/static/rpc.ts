import RPC from './lib/rpc_ws.js';
import {RPC as RPCType} from './types.js';

const broadcastIsAdmin = -1, broadcastCurrentUserMap = -2, broadcastCurrentUserMapData = -3, broadcastImageItemAdd = -4, broadcastAudioItemAdd = -5, broadcastCharacterItemAdd = -6, broadcastMapItemAdd = -7, broadcastImageItemMove = -8, broadcastAudioItemMove = -9, broadcastCharacterItemMove = -10, broadcastMapItemMove = -11, broadcastImageItemRemove = -12, broadcastAudioItemRemove = -13, broadcastCharacterItemRemove = -14, broadcastMapItemRemove = -15, broadcastImageItemLink = -16, broadcastAudioItemLink = -17, broadcastCharacterItemLink = -18, broadcastMapItemLink = -19, broadcastImageFolderAdd = -20, broadcastAudioFolderAdd = -21, broadcastCharacterFolderAdd = -22, broadcastMapFolderAdd = -23, broadcastImageFolderMove = -24, broadcastAudioFolderMove = -25, broadcastCharacterFolderMove = -26, broadcastMapFolderMove = -27, broadcastImageFolderRemove = -28, broadcastAudioFolderRemove = -29, broadcastCharacterFolderRemove = -30, broadcastMapFolderRemove = -31, broadcastMapItemChange = -32, broadcastCharacterDataChange = -33, broadcastTokenDataChange = -34, broadcastCharacterDataRemove = -35, broadcastTokenDataRemove = -36, broadcastLayerAdd = -37, broadcastLayerFolderAdd = -38, broadcastLayerMove = -39, broadcastLayerRename = -40, broadcastLayerRemove = -41, broadcastMapLightChange = -42, broadcastLayerShow = -43, broadcastLayerHide = -44, broadcastLayerMaskAdd = -45, broadcastLayerMaskChange = -46, broadcastLayerMaskRemove = -47, broadcastTokenAdd = -48, broadcastTokenRemove = -49, broadcastTokenMoveLayer = -50, broadcastTokenMovePos = -51, broadcastTokenSetToken = -52, broadcastTokenSetImage = -53, broadcastTokenSetPattern = -54, broadcastTokenChange = -55, broadcastTokenFlip = -56, broadcastTokenFlop = -57, broadcastTokenSnap = -58, broadcastTokenSourceChange = -59, broadcastTokenSetData = -60, broadcastTokenUnsetData = -61, broadcastLayerShift = -62, broadcastLightShift = -63, broadcastTokenLightChange = -64, broadcastWallAdd = -65, broadcastWallRemove = -66, broadcastAny = -67;

export default function (url: string): Promise<Readonly<RPCType>>{
	return RPC(url, 1.1).then(rpc => {
		return Object.freeze({
			"waitLogin":               () => rpc.await(broadcastIsAdmin).then(checkUint),
			"waitCurrentUserMap":      () => rpc.await(broadcastCurrentUserMap, true).then(checkUint),
			"waitCurrentUserMapData":  () => rpc.await(broadcastCurrentUserMapData, true).then(checkMapData),
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
			"waitLayerShift":          () => rpc.await(broadcastLayerShift, true).then(checkLayerShift),
			"waitLightShift":          () => rpc.await(broadcastLightShift, true).then(checkLightShift),
			"waitTokenLightChange":    () => rpc.await(broadcastTokenLightChange, true).then(checkLightChange),
			"waitWallAdded":           () => rpc.await(broadcastWallAdd, true).then(checkWallPath),
			"waitWallRemoved":         () => rpc.await(broadcastWallRemove, true).then(checkTokenPos),
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
			"shiftLayer":      (path, dx, dy)                             => rpc.request("maps.shiftLayer", {path, dx, dy}).then(returnVoid),
			"shiftLight":      (x, y)                                     => rpc.request("maps.shiftLight", {x, y}).then(returnVoid),
			"setTokenLight":   (path, pos, lightColour, lightIntensity)   => rpc.request("maps.setTokenLight", {path, pos, lightColour, lightIntensity}).then(returnVoid),
			"addWall":         (path, x1, y1, x2, y2, colour)             => rpc.request("maps.addWall", {path, x1, y1, x2, y2, colour}).then(returnVoid),
			"removeWall":      (path, pos)                                => rpc.request("maps.removeWall", {path, pos}).then(returnVoid),

			"characterCreate":      name                   => rpc.request("characters.create", name).then(checkIDName),
			"characterModify":     (id, setting, removing) => rpc.request("characters.set", {id, setting, removing}).then(returnVoid),
			"characterGet":         id                     => rpc.request("characters.get", id).then(checkKeystoreData),

			"tokenModify":     (path, pos, setting, removing) => rpc.request("maps.modifyTokenData", {path, pos, setting, removing}).then(returnVoid),

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
      checksIDName: checkers = [[checkObject, ""], [checkUint, "id"], [checkString, "name"]],
      checkIDName = (data: any) => checker(data, "IDName", checksIDName),
      checksFromTo: checkers = [[checkObject, ""], [checkString, "from"], [checkString, "to"]],
      checkFromTo = (data: any, name = "FromTo") => checker(data, name, checksFromTo),
      checksLayerMove: checkers = [[checkFromTo, ""], [checkUint, "position"]],
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
      checksTokenDataChange: checkers = [[checkKeystoreDataChange, ""], [checkString, "path"], [checkUint, "pos"]],
      checkTokenDataChange = (data: any) => checker(data, "TokenDataChange", checksTokenDataChange),
      checksMapDetails: checkers = [[checkObject, ""], [checkUint, "gridSize"], [checkUint, "gridStroke"], [checkUint, "gridSize"], [checkColour, "gridColour"]],
      checkMapDetails = (data: any, name = "MapDetails") => checker(data, name, checksMapDetails),
      checksTokenPos: checkers = [[checkObject, ""], [checkString, "path"], [checkUint, "pos"]],
      checkTokenPos = (data: any, name = "TokenPos") => checker(data, name, checksTokenPos),
      checksTokenChange: checkers = [[checkTokenPos, ""], [checkInt, "x"], [checkInt, "y"], [checkUint, "width"], [checkUint, "height"], [checkByte, "rotation"]],
      checkTokenChange = (data: any) => checker(data, "TokenChange", checksTokenChange),
      checksTokenMovePos: checkers = [[checkTokenPos, ""], [checkUint, "newPos"]],
      checkTokenMovePos = (data: any) => checker(data, "TokenMovePos", checksTokenMovePos),
      checksTokenMoveLayer: checkers = [[checkTokenPos, ""], [checkUint, "pos"]],
      checkTokenMoveLayer = (data: any) => checker(data, "TokenMoveLayer", checksTokenMoveLayer),
      checksTokenFlip: checkers = [[checkTokenPos, ""], [checkBoolean, "flip"]],
      checkTokenFlip = (data: any) =>  checker(data, "TokenFlip", checksTokenFlip),
      checksTokenFlop: checkers = [[checkTokenPos, ""], [checkBoolean, "flop"]],
      checkTokenFlop = (data: any) =>  checker(data, "TokenFlip", checksTokenFlop),
      checksTokenSnap: checkers = [[checkTokenPos, ""], [checkBoolean, "snap"]],
      checkTokenSnap = (data: any) =>  checker(data, "TokenFlip", checksTokenSnap),
      checksTokenSource: checkers = [[checkTokenPos, ""], [checkString, "source"]],
      checkTokenSource = (data: any) =>  checker(data, "TokenFlip", checksTokenSource),
      checksTokenID: checkers = [[checkTokenPos, ""], [checkUint, "id"]],
      checkTokenID = (data: any) =>  checker(data, "TokenFlip", checksTokenID),
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
      checksTokenAdd: checkers = [[checkTokenPos, ""], [checkToken, ""]],
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
      checkBroadcast = (data: any) => {
	checkObject(data, "Broadcast");
	if (data["type"] === undefined) {
		throwError("invalid Broadcast object, missing 'type' key");
	}
	return data;
      };
