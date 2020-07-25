import RPC from './lib/rpc_ws.js';
import {RPC as RPCType, KeystoreData} from './types.js';

const broadcastIsAdmin = -1, broadcastCurrentUserMap = -2, broadcastCurrentUserMapData = -3, broadcastImageItemAdd = -4, broadcastAudioItemAdd = -5, broadcastCharacterItemAdd = -6, broadcastMapItemAdd = -7, broadcastImageItemMove = -8, broadcastAudioItemMove = -9, broadcastCharacterItemMove = -10, broadcastMapItemMove = -11, broadcastImageItemRemove = -12, broadcastAudioItemRemove = -13, broadcastCharacterItemRemove = -14, broadcastMapItemRemove = -15, broadcastImageItemLink = -16, broadcastAudioItemLink = -17, broadcastCharacterItemLink = -18, broadcastMapItemLink = -19, broadcastImageFolderAdd = -20, broadcastAudioFolderAdd = -21, broadcastCharacterFolderAdd = -22, broadcastMapFolderAdd = -23, broadcastImageFolderMove = -24, broadcastAudioFolderMove = -25, broadcastCharacterFolderMove = -26, broadcastMapFolderMove = -27, broadcastImageFolderRemove = -28, broadcastAudioFolderRemove = -29, broadcastCharacterFolderRemove = -30, broadcastMapFolderRemove = -31, broadcastMapItemChange = -32, broadcastCharacterDataChange = -33, broadcastTokenDataChange = -34, broadcastCharacterDataRemove = -35, broadcastTokenDataRemove = -36, broadcastLayerAdd = -37, broadcastLayerFolderAdd = -38, broadcastLayerMove = -39, broadcastLayerRename = -40, broadcastLayerRemove = -41, broadcastMapLightChange = -42, broadcastLayerShow = -43, broadcastLayerHide = -44, broadcastLayerMaskAdd = -45, broadcastLayerMaskChange = -46, broadcastLayerMaskRemove = -47, broadcastTokenAdd = -48, broadcastTokenRemove = -49, broadcastTokenMoveLayer = -50, broadcastTokenMovePos = -51, broadcastTokenSetToken = -52, broadcastTokenSetImage = -53, broadcastTokenSetPattern = -54, broadcastTokenChange = -55, broadcastTokenFlip = -56, broadcastTokenFlop = -57, broadcastTokenSnap = -58, broadcastTokenSourceChange = -59, broadcastTokenSetData = -60, broadcastTokenUnsetData = -61, broadcastAny = -62;

export default function (url: string): Promise<Readonly<RPCType>>{
	return RPC(url, 1.1).then(rpc => {
		return Object.freeze({
			"waitLogin":                   () => rpc.await(broadcastIsAdmin).then(checkInt),
			"waitCurrentUserMap":          () => rpc.await(broadcastCurrentUserMap, true).then(checkInt),
			"waitCurrentUserMapData":      () => rpc.await(broadcastCurrentUserMapData, true),
			"waitCharacterDataChange":     () => rpc.await(broadcastCharacterDataChange, true).then(d => (d.data = userData(d.data), d)),
			"waitCharacterDataRemove":     () => rpc.await(broadcastCharacterDataRemove, true),
			"waitTokenDataChange":         () => rpc.await(broadcastTokenDataChange, true).then(d => (d.data = userData(d.data), d)),
			"waitTokenDataRemove":         () => rpc.await(broadcastTokenDataRemove, true),
			"waitMapChange":               () => rpc.await(broadcastMapItemChange, true),
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
				"createFolder": path      => rpc.request("imageAssets.createFolder", path),
				"move":        (from, to) => rpc.request("imageAssets.move", {from, to}),
				"moveFolder":  (from, to) => rpc.request("imageAssets.moveFolder", {from, to}),
				"remove":       path      => rpc.request("imageAssets.remove", path),
				"removeFolder": path      => rpc.request("imageAssets.removeFolder", path),
				"link":        (id, name) => rpc.request("imageAssets.link", {id, name}),
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
				"createFolder": path      => rpc.request("audioAssets.createFolder", path),
				"move":        (from, to) => rpc.request("audioAssets.move", {from, to}),
				"moveFolder":  (from, to) => rpc.request("audioAssets.moveFolder", {from, to}),
				"remove":       path      => rpc.request("audioAssets.remove", path),
				"removeFolder": path      => rpc.request("audioAssets.removeFolder", path),
				"link":        (id, name) => rpc.request("audioAssets.link", {id, name}),
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
				"createFolder": path      => rpc.request("characters.createFolder", path),
				"move":        (from, to) => rpc.request("characters.move", {from, to}),
				"moveFolder":  (from, to) => rpc.request("characters.moveFolder", {from, to}),
				"remove":       path      => rpc.request("characters.remove", path),
				"removeFolder": path      => rpc.request("characters.removeFolder", path),
				"link":        (id, name) => rpc.request("characters.link", {id, name}),
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
				"createFolder": path      => rpc.request("maps.createFolder", path),
				"move":        (from, to) => rpc.request("maps.move", {from, to}),
				"moveFolder":  (from, to) => rpc.request("maps.moveFolder", {from, to}),
				"remove":       path      => rpc.request("maps.remove", path),
				"removeFolder": path      => rpc.request("maps.removeFolder", path),
				"link":        (id, name) => rpc.request("maps.link", {id, name}),
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
			"characterGet":        (id, keys) => rpc.request("characters.get", {id, keys}).then(userData),
			"characterGetAll":      id        => rpc.request("characters.get", {id}).then(userData),
			"characterRemoveKeys": (id, keys) => rpc.request("characters.removeKeys", {id, keys}),

			"tokenCreate":     (path, pos) => rpc.request("maps.setAsToken", {path, pos}).then(checkInt),
			"tokenSet":        (id, data)  => rpc.request("tokens.set", {id, data}),
			"tokenGet":        (id, keys)  => rpc.request("tokens.get", {id, keys}).then(userData),
			"tokenGetAll":      id         => rpc.request("tokens.get", {id}).then(userData),
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
      checkString = (data: any) => {
	if (typeof data !== "string") {
		throw new Error(`expecting String type, got ${JSON.stringify(data)}`);
	}
	return data;
      },
      checkColour = (data: any) => {
	if (typeof data !== "object") {
		throw new Error(`expecting Colour object, got ${JSON.stringify(data)}`);
	}
	for (const key in data) {
		switch (key) {
		case 'r':
		case 'g':
		case 'b':
		case 'a':
			const c = data[key];
			if (typeof c !== "number" || c % 1 !== 0 || c < 0 || c > 255) {
				throw new Error(`invalid Colour object, key '${key}' contains invalid data: ${JSON.stringify(c)}`);
			}
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
	if (typeof data !== "object") {
		throw new Error(`expecting IDName object, got ${JSON.stringify(data)}`);
	}
	for (const key in data) {
		switch (key) {
		case "id":
			const id = data["id"];
			if (typeof id !== "number" || id % 1 !== 0 || id < 0) {
				throw new Error(`invalid IDName object, key 'ID' contains invalid data: ${JSON.stringify(id)}`);
			}
			break;
		case "name":
			if (typeof data["name"] !== "string") {
				throw new Error(`invalid IDName object, key 'name' contains invalid data: ${JSON.stringify(data[key])}`);
			}
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
	if (typeof data !== "object") {
		throw new Error(`expecting FromTo object, got ${JSON.stringify(data)}`);
	}
	if (typeof data["from"] !== "string") {
		throw new Error(`invalid FromTo object, key 'from' contains invalid data: ${JSON.stringify(data["from"])}`);
	}
	if (typeof data["to"] !== "string") {
		throw new Error(`invalid FromTo object, key 'to' contains invalid data: ${JSON.stringify(data["to"])}`);
	}
	return data;
      },
      checkFolderItems = (data: any) => {
	if (typeof data !== "object") {
		throw new Error(`expecting FolderItems object, got ${JSON.stringify(data)}`);
	}
	const {folders, items} = data;
	if (typeof folders !== "object") {
		throw new Error(`invalid FolderItems object, key 'folders' contains invalid data: ${JSON.stringify(folders)}`);
	}
	if (typeof items !== "object") {
		throw new Error(`invalid FolderItems object, key 'items' contains invalid data: ${JSON.stringify(items)}`);
	}
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
		const id = items[key];
		if (typeof id !== "number" || id % 1 !== 0 || id < 0) {
			throw new Error(`invalid FolderItems object, items key '${key}' contains invalid data: ${JSON.stringify(id)}`);
		}
	}
	return data;
      },
      userData = (data : Record<string, string | KeystoreData>) => {
	const keys = Object.keys(data)
	if (keys.length > 0 && typeof data[keys[0]] === "string") {
		keys.forEach(k => data[k] = {"data": data[k], "user": false} as KeystoreData);
	}
	return data;
};

