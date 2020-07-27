import RPC from './lib/rpc_ws.js';
import {RPC as RPCType, KeystoreData} from './types.js';

const broadcastIsAdmin = -1, broadcastCurrentUserMap = -2, broadcastCurrentUserMapData = -3, broadcastImageItemAdd = -4, broadcastAudioItemAdd = -5, broadcastCharacterItemAdd = -6, broadcastMapItemAdd = -7, broadcastImageItemMove = -8, broadcastAudioItemMove = -9, broadcastCharacterItemMove = -10, broadcastMapItemMove = -11, broadcastImageItemRemove = -12, broadcastAudioItemRemove = -13, broadcastCharacterItemRemove = -14, broadcastMapItemRemove = -15, broadcastImageItemLink = -16, broadcastAudioItemLink = -17, broadcastCharacterItemLink = -18, broadcastMapItemLink = -19, broadcastImageFolderAdd = -20, broadcastAudioFolderAdd = -21, broadcastCharacterFolderAdd = -22, broadcastMapFolderAdd = -23, broadcastImageFolderMove = -24, broadcastAudioFolderMove = -25, broadcastCharacterFolderMove = -26, broadcastMapFolderMove = -27, broadcastImageFolderRemove = -28, broadcastAudioFolderRemove = -29, broadcastCharacterFolderRemove = -30, broadcastMapFolderRemove = -31, broadcastMapItemChange = -32, broadcastCharacterDataChange = -33, broadcastTokenDataChange = -34, broadcastCharacterDataRemove = -35, broadcastTokenDataRemove = -36, broadcastLayerAdd = -37, broadcastLayerFolderAdd = -38, broadcastLayerMove = -39, broadcastLayerRename = -40, broadcastLayerRemove = -41, broadcastMapLightChange = -42, broadcastLayerShow = -43, broadcastLayerHide = -44, broadcastLayerMaskAdd = -45, broadcastLayerMaskChange = -46, broadcastLayerMaskRemove = -47, broadcastTokenAdd = -48, broadcastTokenRemove = -49, broadcastTokenMoveLayer = -50, broadcastTokenMovePos = -51, broadcastTokenSetToken = -52, broadcastTokenSetImage = -53, broadcastTokenSetPattern = -54, broadcastTokenChange = -55, broadcastTokenFlip = -56, broadcastTokenFlop = -57, broadcastTokenSnap = -58, broadcastTokenSourceChange = -59, broadcastTokenSetData = -60, broadcastTokenUnsetData = -61, broadcastAny = -62;

export default function (url: string): Promise<Readonly<RPCType>>{
	return RPC(url, 1.1).then(rpc => {
		return Object.freeze({
			"waitLogin":                   () => rpc.await(broadcastIsAdmin).then(checkInt),
			"waitCurrentUserMap":          () => rpc.await(broadcastCurrentUserMap, true).then(checkInt),
			"waitCurrentUserMapData":      () => rpc.await(broadcastCurrentUserMapData, true),
			"waitCharacterDataChange":     () => rpc.await(broadcastCharacterDataChange, true).then(checkKeystoreDataChange),
			"waitCharacterDataRemove":     () => rpc.await(broadcastCharacterDataRemove, true).then(checkKeystoreDataRemove),
			"waitTokenDataChange":         () => rpc.await(broadcastTokenDataChange, true).then(checkKeystoreDataChange),
			"waitTokenDataRemove":         () => rpc.await(broadcastTokenDataRemove, true).then(checkKeystoreDataRemove),
			"waitMapChange":               () => rpc.await(broadcastMapItemChange, true).then(checkMapDetails),
			"waitLayerAdd":                () => rpc.await(broadcastLayerAdd, true).then(checkString),
			"waitLayerFolderAdd":          () => rpc.await(broadcastLayerFolderAdd, true).then(checkString),
			"waitLayerMove":               () => rpc.await(broadcastLayerMove, true),
			"waitLayerRename":             () => rpc.await(broadcastLayerRename, true),
			"waitLayerRemove":             () => rpc.await(broadcastLayerRemove, true).then(checkString),
			"waitMapLightChange":          () => rpc.await(broadcastMapLightChange, true).then(checkColour),
			"waitLayerShow":               () => rpc.await(broadcastLayerShow, true).then(checkString),
			"waitLayerHide":               () => rpc.await(broadcastLayerHide, true).then(checkString),
			"waitLayerMaskAdd":            () => rpc.await(broadcastLayerMaskAdd, true),
			"waitLayerMaskChange":         () => rpc.await(broadcastLayerMaskChange, true),
			"waitLayerMaskRemove":         () => rpc.await(broadcastLayerMaskRemove, true),
			"waitTokenAdd":                () => rpc.await(broadcastTokenAdd, true),
			"waitTokenRemove":             () => rpc.await(broadcastTokenRemove, true),
			"waitTokenMoveLayer":          () => rpc.await(broadcastTokenMoveLayer, true),
			"waitTokenMovePos":            () => rpc.await(broadcastTokenMovePos, true),
			"waitTokenSetToken":           () => rpc.await(broadcastTokenSetToken, true),
			"waitTokenSetImage":           () => rpc.await(broadcastTokenSetImage, true),
			"waitTokenSetPattern":         () => rpc.await(broadcastTokenSetPattern, true),
			"waitTokenChange":             () => rpc.await(broadcastTokenChange, true),
			"waitTokenFlip":               () => rpc.await(broadcastTokenFlip, true),
			"waitTokenFlop":               () => rpc.await(broadcastTokenFlop, true),
			"waitTokenSnap":               () => rpc.await(broadcastTokenSnap, true),
			"waitTokenSourceChange":       () => rpc.await(broadcastTokenSourceChange, true),
			"waitTokenSetData":            () => rpc.await(broadcastTokenSetData, true),
			"waitTokenUnsetData":          () => rpc.await(broadcastTokenUnsetData, true),
			"waitBroadcast":               () => rpc.await(broadcastAny, true),

			"images": {
				"waitAdded":         () => rpc.await(broadcastImageItemAdd, true).then(checkIDName),
				"waitMoved":         () => rpc.await(broadcastImageItemMove, true).then(checkFromTo),
				"waitRemoved":       () => rpc.await(broadcastImageItemRemove, true).then(checkString),
				"waitLinked":        () => rpc.await(broadcastImageItemLink, true).then(checkIDName),
				"waitFolderAdded":   () => rpc.await(broadcastImageFolderAdd, true).then(checkString),
				"waitFolderMoved":   () => rpc.await(broadcastImageFolderMove, true).then(checkFromTo),
				"waitFolderRemoved": () => rpc.await(broadcastImageFolderRemove, true).then(checkString),

				"list":        ()         => rpc.request("imageAssets.list").then(checkFolderItems),
				"createFolder": path      => rpc.request("imageAssets.createFolder", path).then(checkString),
				"move":        (from, to) => rpc.request("imageAssets.move", {from, to}).then(checkString),
				"moveFolder":  (from, to) => rpc.request("imageAssets.moveFolder", {from, to}).then(checkString),
				"remove":       path      => rpc.request("imageAssets.remove", path),
				"removeFolder": path      => rpc.request("imageAssets.removeFolder", path),
				"link":        (id, name) => rpc.request("imageAssets.link", {id, name}).then(checkString),
			},

			"audio": {
				"waitAdded":         () => rpc.await(broadcastAudioItemAdd, true).then(checkIDName),
				"waitMoved":         () => rpc.await(broadcastAudioItemMove, true).then(checkFromTo),
				"waitRemoved":       () => rpc.await(broadcastAudioItemRemove, true).then(checkString),
				"waitLinked":        () => rpc.await(broadcastAudioItemLink, true).then(checkIDName),
				"waitFolderAdded":   () => rpc.await(broadcastAudioFolderAdd, true).then(checkString),
				"waitFolderMoved":   () => rpc.await(broadcastAudioFolderMove, true).then(checkFromTo),
				"waitFolderRemoved": () => rpc.await(broadcastAudioFolderRemove, true).then(checkString),

				"list":        ()         => rpc.request("audioAssets.list").then(checkFolderItems),
				"createFolder": path      => rpc.request("audioAssets.createFolder", path).then(checkString),
				"move":        (from, to) => rpc.request("audioAssets.move", {from, to}).then(checkString),
				"moveFolder":  (from, to) => rpc.request("audioAssets.moveFolder", {from, to}).then(checkString),
				"remove":       path      => rpc.request("audioAssets.remove", path),
				"removeFolder": path      => rpc.request("audioAssets.removeFolder", path),
				"link":        (id, name) => rpc.request("audioAssets.link", {id, name}).then(checkString),
			},

			"characters": {
				"waitAdded":         () => rpc.await(broadcastCharacterItemAdd, true).then(checkIDName),
				"waitMoved":         () => rpc.await(broadcastCharacterItemMove, true).then(checkFromTo),
				"waitRemoved":       () => rpc.await(broadcastCharacterItemRemove, true).then(checkString),
				"waitLinked":        () => rpc.await(broadcastCharacterItemLink, true).then(checkIDName),
				"waitFolderAdded":   () => rpc.await(broadcastCharacterFolderAdd, true).then(checkString),
				"waitFolderMoved":   () => rpc.await(broadcastCharacterFolderMove, true).then(checkFromTo),
				"waitFolderRemoved": () => rpc.await(broadcastCharacterFolderRemove, true).then(checkString),

				"list":        ()         => rpc.request("characters.list").then(checkFolderItems),
				"createFolder": path      => rpc.request("characters.createFolder", path).then(checkString),
				"move":        (from, to) => rpc.request("characters.move", {from, to}).then(checkString),
				"moveFolder":  (from, to) => rpc.request("characters.moveFolder", {from, to}).then(checkString),
				"remove":       path      => rpc.request("characters.remove", path),
				"removeFolder": path      => rpc.request("characters.removeFolder", path),
				"link":        (id, name) => rpc.request("characters.link", {id, name}).then(checkString),
			},

			"maps": {
				"waitAdded":         () => rpc.await(broadcastMapItemAdd, true).then(checkIDName),
				"waitMoved":         () => rpc.await(broadcastMapItemMove, true).then(checkFromTo),
				"waitRemoved":       () => rpc.await(broadcastMapItemRemove, true).then(checkString),
				"waitLinked":        () => rpc.await(broadcastMapItemLink, true).then(checkIDName),
				"waitFolderAdded":   () => rpc.await(broadcastMapFolderAdd, true).then(checkString),
				"waitFolderMoved":   () => rpc.await(broadcastMapFolderMove, true).then(checkFromTo),
				"waitFolderRemoved": () => rpc.await(broadcastMapFolderRemove, true).then(checkString),

				"list":        ()         => rpc.request("maps.list").then(checkFolderItems),
				"createFolder": path      => rpc.request("maps.createFolder", path).then(checkString),
				"move":        (from, to) => rpc.request("maps.move", {from, to}).then(checkString),
				"moveFolder":  (from, to) => rpc.request("maps.moveFolder", {from, to}).then(checkString),
				"remove":       path      => rpc.request("maps.remove", path),
				"removeFolder": path      => rpc.request("maps.removeFolder", path),
				"link":        (id, name) => rpc.request("maps.link", {id, name}).then(checkString),
			},

			"connID": () => rpc.request("conn.connID"),

			"setCurrentMap":  id => rpc.request("maps.setCurrentMap", id),
			"getUserMap":    ()  => rpc.request("maps.getUserMap").then(checkInt),
			"setUserMap":     id => rpc.request("maps.setUserMap", id),
			"getMapData":     id => rpc.request("maps.getMapData", id),

			"newMap":         map    => rpc.request("maps.new", map).then(checkIDName),
			"setMapDetails":  map    => rpc.request("maps.setMapDetails", map),
			"setLightColour": colour => rpc.request("maps.setLightColour", colour).then(checkColour),

			"addLayer":         name                                      => rpc.request("maps.addLayer", name).then(checkString),
			"addLayerFolder":   path                                      => rpc.request("maps.addLayerFolder", path).then(checkString),
			"renameLayer":     (path, name)                               => rpc.request("maps.renameLayer", {path, name}),
			"moveLayer":       (from, to, position)                       => rpc.request("maps.moveLayer", {from, to, position}),
			"showLayer":        path                                      => rpc.request("maps.showLayer", path),
			"hideLayer":        path                                      => rpc.request("maps.hideLayer", path),
			"addMask":         (path, mask)                               => rpc.request("maps.addMask", {path, mask}),
			"removeMask":       path                                      => rpc.request("maps.removeMask", path),
			"removeLayer":      path                                      => rpc.request("maps.removeLayer", path),
			"addToken":        (path, token)                              => rpc.request("maps.addToken", Object.assign(token, {"path": path})).then(checkInt),
			"removeToken":     (path, pos)                                => rpc.request("maps.removeToken", {path, pos}),
			"setToken":        (path, pos, x, y, width, height, rotation) => rpc.request("maps.setToken", {path, pos, x, y, width, height, rotation}),
			"flipToken":       (path, pos, flip)                          => rpc.request("maps.flipToken", {path, pos, flip}),
			"flopToken":       (path, pos, flop)                          => rpc.request("maps.flopToken", {path, pos, flop}),
			"setTokenSnap":    (path, pos, snap)                          => rpc.request("maps.setTokenSnap", {path, pos, snap}),
			"setTokenPattern": (path, pos)                                => rpc.request("maps.setTokenPattern", {path, pos}),
			"setTokenImage":   (path, pos)                                => rpc.request("maps.setTokenImage", {path, pos}),
			"setTokenSource":  (path, pos, src)                           => rpc.request("maps.setTokenSource", {path, pos, src}),
			"setTokenLayer":   (from, pos, to)                            => rpc.request("maps.setTokenLayer", {from, pos, to}),
			"setTokenPos":     (path, pos, newPos)                        => rpc.request("maps.setTokenPos", {path, pos, newPos}),

			"characterCreate":      name      => rpc.request("characters.create", name).then(checkIDName),
			"characterSet":        (id, data) => rpc.request("characters.set", {id, data}),
			"characterGet":      id        => rpc.request("characters.get", id).then(checkKeystoreData),
			"characterRemoveKeys": (id, keys) => rpc.request("characters.removeKeys", {id, keys}),

			"tokenCreate":     (path, pos) => rpc.request("maps.setAsToken", {path, pos}).then(checkInt),
			"tokenSet":        (id, data)  => rpc.request("tokens.set", {id, data}),
			"tokenGet":         id         => rpc.request("tokens.get", id).then(checkKeystoreData),
			"tokenRemoveKeys": (id, keys)  => rpc.request("tokens.removeKeys", {id, keys}),
			"tokenDelete":     (path, pos) => rpc.request("maps.unsetAsToken", {path, pos}),
			"tokenClone":       id         => rpc.request("tokens.clone", id).then(checkInt),

			"loggedIn":          ()                         => rpc.request("auth.loggedIn"),
			"loginRequirements": ()                         => rpc.request("auth.requirements").then(checkString),
			"login":              data                      => rpc.request("auth.login", data).then(checkString),
			"changePassword":    (oldPassword, newPassword) => rpc.request("auth.changePassword", {oldPassword, newPassword}).then(checkString),
			"logout":            ()                         => rpc.request("auth.logout"),

			"broadcast":          data                      => rpc.request("broadcast", data),

			"close": rpc.close
		} as RPCType);
	})
}

const checkInt = (data: any) => {
	if (typeof data !== "number" || data % 1 !== 0) {
		throw new Error(`expecting Int type, got ${JSON.stringify(data)}`);
	}
	return data;
      },
      checkUint = (data: any, name: string, key: string, max = Number.MAX_SAFE_INTEGER) => {
	if (typeof data != "number" || data % 1 !== 0 || data < 0 || data > max) {
		throw new Error(`invalid ${name} object, key '${key}' contains invalid data: ${JSON.stringify(data)}`);
	}
      },
      checkObject = (data: any, name: string, key?: string) => {
	if (typeof data !== "object") {
		throw new Error(key === undefined ? `expecting ${name} object, got ${JSON.stringify(data)}` : `invalid ${name} object, key '${key}' contains invalid data: ${JSON.stringify(data)}`);
	}
      },
      checkString = (data: any, name = "String", key?: string) => {
	if (typeof data !== "string") {
		throw new Error(key === undefined ? `expecting ${name} type, got ${JSON.stringify(data)}` : `invalid ${name} object, key '${key}' contains invalid data: ${JSON.stringify(data)}`);
	}
	return data;
      },
      checkColour = (data: any) => {
	checkObject(data, "Colour");
	for (const key in data) {
		switch (key) {
		case 'r':
		case 'g':
		case 'b':
		case 'a':
			checkUint(data[key], "Colour", key, 255);
			break;
		default:
			delete data[key];
		}
	}
	data.r = data.r ?? 0;
	data.g = data.g ?? 0;
	data.b = data.b ?? 0;
	data.a = data.a ?? 0;
	return data;
      },
      checkIDName = (data: any) => {
	checkObject(data, "IDName");
	for (const key in data) {
		switch (key) {
		case "id":
			checkUint(data[key], "IDName", key);
			break;
		case "name":
			checkString(data["name"], "IDName", "name");
			break;
		default:
			delete data[key];
		}
	}
	data.id = data.id ?? 0;
	data.name = data.name ?? "";
	return data;
      },
      checkFromTo = (data: any) => {
	checkObject(data, "FromTo");
	checkString(data["from"], "FromTo", "from");
	checkString(data["to"], "FromTo", "to");
	return data;
      },
      checkFolderItems = (data: any) => {
	checkObject(data, "FolderItems");
	const {folders, items} = data;
	checkObject(folders, "FolderItems", "folders");
	checkObject(items, "FolderItems", "items");
	for (const key in folders) {
		if (typeof key !== "string") {
			throw new Error(`invalid FolderItems object, key 'folder' contains an invalid key: ${JSON.stringify(key)}`);
		}
		checkFolderItems(folders[key]);
	}
	for (const key in items) {
		if (typeof key !== "string") {
			throw new Error(`invalid FolderItems object, key 'items' contains an invalid key: ${JSON.stringify(key)}`);
		}
		checkUint(data[key], "FolderItems", key);
	}
	return data;
      },
      checkKeystoreData = (data: any) => {
	checkObject(data, "KeystoreData");
	for (const key in data) {
		if (typeof key !== "string") {
			throw new Error(`invalid KeystoreData object, invalid key: ${JSON.stringify(key)}`);
		}
		const kd = data[key];
		checkObject(kd, "KeystoreData", key);
		if (typeof kd["user"] !== "boolean") {
			throw new Error(`invalid KeystoreData object, key '${key}' contains an invalid user type: ${JSON.stringify(kd["user"])}`);
		}
		if (kd["data"] === undefined) {
			throw new Error(`invalid KeystoreData object, key '${key}' contains no data`);
		}
	}
	return data;
      },
      checkKeystoreDataChange = (data: any) => {
	checkObject(data, "KeystoreDataChange");
	if (typeof data !== "object") {
		throw new Error(`expecting KeystoreDataChange object, got ${JSON.stringify(data)}`);
	}
	checkUint(data["id"], "FolderItems", "id");
	checkKeystoreData(data["data"]);
	return data;
      },
      checkKeystoreDataRemove = (data: any) => {
	checkObject(data, "KeystoreDataRemove");
	checkUint(data["id"], "KeystoreDataRemove", "id");
	const keys = data["keys"];
	if (!(keys instanceof Array)) {
		throw new Error(`invalid KeystoreDataRemove object, key 'keys' does not contain Array type, got ${JSON.stringify(keys)}`);
	}
	for (const key of keys) {
		if (typeof key !== "string") {
			throw new Error(`invalid KeystoreDataRemove object, invalid key: ${JSON.stringify(key)}`);
		}
	}
	return data;
      },
      checkMapDetails = (data: any) => {
	checkObject(data, "MapDetails");
	for (const key in data) {
		switch (key) {
		case "gridSize":
		case "gridStroke":
		case "width":
		case "height":
			checkUint(data[key], "MapDetails", key);
			break;
		case "gridColour":
			checkColour(data[key]);
			break;
		default:
			delete data[key];
		}
	}
	return data;
      };
