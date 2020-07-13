import RPC from './lib/rpc_ws.js';
import {RPC as RPCType, KeystoreData} from './types.js';

const broadcastIsAdmin = -1, broadcastCurrentUserMap = -2, broadcastCurrentUserMapData = -3, broadcastImageItemAdd = -4, broadcastAudioItemAdd = -5, broadcastCharacterItemAdd = -6, broadcastMapItemAdd = -7, broadcastImageItemMove = -8, broadcastAudioItemMove = -9, broadcastCharacterItemMove = -10, broadcastMapItemMove = -11, broadcastImageItemRemove = -12, broadcastAudioItemRemove = -13, broadcastCharacterItemRemove = -14, broadcastMapItemRemove = -15, broadcastImageItemLink = -16, broadcastAudioItemLink = -17, broadcastCharacterItemLink = -18, broadcastMapItemLink = -19, broadcastImageFolderAdd = -20, broadcastAudioFolderAdd = -21, broadcastCharacterFolderAdd = -22, broadcastMapFolderAdd = -23, broadcastImageFolderMove = -24, broadcastAudioFolderMove = -25, broadcastCharacterFolderMove = -26, broadcastMapFolderMove = -27, broadcastImageFolderRemove = -28, broadcastAudioFolderRemove = -29, broadcastCharacterFolderRemove = -30, broadcastMapFolderRemove = -31, broadcastMapItemChange = -32, broadcastCharacterDataChange = -33, broadcastTokenDataChange = -34, broadcastCharacterDataRemove = -35, broadcastTokenDataRemove = -36, broadcastLayerAdd = -37, broadcastLayerFolderAdd = -38, broadcastLayerMove = -39, broadcastLayerRename = -40, broadcastLayerRemove = -41, broadcastMapLightChange = -42, broadcastMapInitiative = -43, broadcastLayerShow = -44, broadcastLayerHide = -45, broadcastLayerMaskAdd = -46, broadcastLayerMaskChange = -47, broadcastLayerMaskRemove = -48, broadcastTokenAdd = -49, broadcastTokenRemove = -50, broadcastTokenMoveLayer = -51, broadcastTokenMovePos = -52, broadcastTokenSetToken = -53, broadcastTokenSetImage = -54, broadcastTokenSetPattern = -55, broadcastTokenChange = -56, broadcastTokenFlip = -57, broadcastTokenFlop = -58, broadcastTokenSnap = -59, broadcastTokenSourceChange = -60, broadcastTokenSetData = -61, broadcastTokenUnsetData = -62;

export default function (url: string): Promise<Readonly<RPCType>>{
	return RPC(url, 1.1).then(rpc => {
		return Object.freeze({
			"waitLogin":                   () => rpc.await(broadcastIsAdmin),
			"waitCurrentUserMap":          () => rpc.await(broadcastCurrentUserMap, true),
			"waitCurrentUserMapData":      () => rpc.await(broadcastCurrentUserMapData, true),
			"waitCharacterDataChange":     () => rpc.await(broadcastCharacterDataChange, true).then(d => (d.data = userData(d.data), d)),
			"waitCharacterDataRemove":     () => rpc.await(broadcastCharacterDataRemove, true),
			"waitTokenDataChange":         () => rpc.await(broadcastTokenDataChange, true).then(d => (d.data = userData(d.data), d)),
			"waitTokenDataRemove":         () => rpc.await(broadcastTokenDataRemove, true),
			"waitMapChange":               () => rpc.await(broadcastMapItemChange, true),
			"waitLayerAdd":                () => rpc.await(broadcastLayerAdd, true),
			"waitLayerFolderAdd":          () => rpc.await(broadcastLayerFolderAdd, true),
			"waitLayerMove":               () => rpc.await(broadcastLayerMove, true),
			"waitLayerRename":             () => rpc.await(broadcastLayerRename, true),
			"waitLayerRemove":             () => rpc.await(broadcastLayerRemove, true),
			"waitMapLightChange":          () => rpc.await(broadcastMapLightChange, true),
			"waitLayerShow":               () => rpc.await(broadcastLayerShow, true),
			"waitLayerHide":               () => rpc.await(broadcastLayerHide, true),
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

			"images": {
				"waitAdded":         () => rpc.await(broadcastImageItemAdd, true),
				"waitMoved":         () => rpc.await(broadcastImageItemMove, true),
				"waitRemoved":       () => rpc.await(broadcastImageItemRemove, true),
				"waitLinked":        () => rpc.await(broadcastImageItemLink, true),
				"waitFolderAdded":   () => rpc.await(broadcastImageFolderAdd, true),
				"waitFolderMoved":   () => rpc.await(broadcastImageFolderMove, true),
				"waitFolderRemoved": () => rpc.await(broadcastImageFolderRemove, true),

				"list":        ()         => rpc.request("imageAssets.list"),
				"createFolder": path      => rpc.request("imageAssets.createFolder", path),
				"move":        (from, to) => rpc.request("imageAssets.move", {from, to}),
				"moveFolder":  (from, to) => rpc.request("imageAssets.moveFolder", {from, to}),
				"remove":       path      => rpc.request("imageAssets.remove", path),
				"removeFolder": path      => rpc.request("imageAssets.removeFolder", path),
				"link":        (id, name) => rpc.request("imageAssets.link", {id, name}),
			},

			"audio": {
				"waitAdded":         () => rpc.await(broadcastAudioItemAdd, true),
				"waitMoved":         () => rpc.await(broadcastAudioItemMove, true),
				"waitRemoved":       () => rpc.await(broadcastAudioItemRemove, true),
				"waitLinked":        () => rpc.await(broadcastAudioItemLink, true),
				"waitFolderAdded":   () => rpc.await(broadcastAudioFolderAdd, true),
				"waitFolderMoved":   () => rpc.await(broadcastAudioFolderMove, true),
				"waitFolderRemoved": () => rpc.await(broadcastAudioFolderRemove, true),

				"list":        ()         => rpc.request("audioAssets.list"),
				"createFolder": path      => rpc.request("audioAssets.createFolder", path),
				"move":        (from, to) => rpc.request("audioAssets.move", {from, to}),
				"moveFolder":  (from, to) => rpc.request("audioAssets.moveFolder", {from, to}),
				"remove":       path      => rpc.request("audioAssets.remove", path),
				"removeFolder": path      => rpc.request("audioAssets.removeFolder", path),
				"link":        (id, name) => rpc.request("audioAssets.link", {id, name}),
			},

			"characters": {
				"waitAdded":         () => rpc.await(broadcastCharacterItemAdd, true),
				"waitMoved":         () => rpc.await(broadcastCharacterItemMove, true),
				"waitRemoved":       () => rpc.await(broadcastCharacterItemRemove, true),
				"waitLinked":        () => rpc.await(broadcastCharacterItemLink, true),
				"waitFolderAdded":   () => rpc.await(broadcastCharacterFolderAdd, true),
				"waitFolderMoved":   () => rpc.await(broadcastCharacterFolderMove, true),
				"waitFolderRemoved": () => rpc.await(broadcastCharacterFolderRemove, true),

				"list":        ()         => rpc.request("characters.list"),
				"createFolder": path      => rpc.request("characters.createFolder", path),
				"move":        (from, to) => rpc.request("characters.move", {from, to}),
				"moveFolder":  (from, to) => rpc.request("characters.moveFolder", {from, to}),
				"remove":       path      => rpc.request("characters.remove", path),
				"removeFolder": path      => rpc.request("characters.removeFolder", path),
				"link":        (id, name) => rpc.request("characters.link", {id, name}),
			},

			"maps": {
				"waitAdded":         () => rpc.await(broadcastMapItemAdd, true),
				"waitMoved":         () => rpc.await(broadcastMapItemMove, true),
				"waitRemoved":       () => rpc.await(broadcastMapItemRemove, true),
				"waitLinked":        () => rpc.await(broadcastMapItemLink, true),
				"waitFolderAdded":   () => rpc.await(broadcastMapFolderAdd, true),
				"waitFolderMoved":   () => rpc.await(broadcastMapFolderMove, true),
				"waitFolderRemoved": () => rpc.await(broadcastMapFolderRemove, true),

				"list":        ()         => rpc.request("maps.list"),
				"createFolder": path      => rpc.request("maps.createFolder", path),
				"move":        (from, to) => rpc.request("maps.move", {from, to}),
				"moveFolder":  (from, to) => rpc.request("maps.moveFolder", {from, to}),
				"remove":       path      => rpc.request("maps.remove", path),
				"removeFolder": path      => rpc.request("maps.removeFolder", path),
				"link":        (id, name) => rpc.request("maps.link", {id, name}),
			},

			"connID": () => rpc.request("conn.connID"),

			"setCurrentMap":  id => rpc.request("maps.setCurrentMap", id),
			"getUserMap":    ()  => rpc.request("maps.getUserMap"),
			"setUserMap":     id => rpc.request("maps.setUserMap", id),
			"getMapData":     id => rpc.request("maps.getMapData", id),

			"newMap":         map    => rpc.request("maps.new", map),
			"setMapDetails":  map    => rpc.request("maps.setMapDetails", map),
			"setLightColour": colour => rpc.request("maps.setLightColour", colour),

			"addLayer":         name                                      => rpc.request("maps.addLayer", name),
			"addLayerFolder":   path                                      => rpc.request("maps.addLayerFolder", path),
			"renameLayer":     (path, name)                               => rpc.request("maps.renameLayer", {path, name}),
			"moveLayer":       (from, to, position)                       => rpc.request("maps.moveLayer", {from, to, position}),
			"showLayer":        path                                      => rpc.request("maps.showLayer", path),
			"hideLayer":        path                                      => rpc.request("maps.hideLayer", path),
			"addMask":         (path, mask)                               => rpc.request("maps.addMask", {path, mask}),
			"removeMask":       path                                      => rpc.request("maps.removeMask", path),
			"removeLayer":      path                                      => rpc.request("maps.removeLayer", path),
			"addToken":        (path, token)                              => rpc.request("maps.addToken", Object.assign(token, {"path": path})),
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

			"characterCreate":      name      => rpc.request("characters.create", name),
			"characterSet":        (id, data) => rpc.request("characters.set", {id, data}),
			"characterGet":        (id, keys) => rpc.request("characters.get", {id, keys}).then(userData),
			"characterGetAll":      id        => rpc.request("characters.get", {id}).then(userData),
			"characterRemoveKeys": (id, keys) => rpc.request("characters.removeKeys", {id, keys}),

			"tokenCreate":     (path, pos) => rpc.request("maps.setAsToken", {path, pos}),
			"tokenSet":        (id, data)  => rpc.request("tokens.set", {id, data}),
			"tokenGet":        (id, keys)  => rpc.request("tokens.get", {id, keys}).then(userData),
			"tokenGetAll":      id         => rpc.request("tokens.get", {id}).then(userData),
			"tokenRemoveKeys": (id, keys)  => rpc.request("tokens.removeKeys", {id, keys}),
			"tokenDelete":     (path, pos) => rpc.request("maps.unsetAsToken", {path, pos}),
			"tokenClone":       id         => rpc.request("tokens.clone", id),

			"loggedIn":          ()                         => rpc.request("auth.loggedIn"),
			"loginRequirements": ()                         => rpc.request("auth.requirements"),
			"login":              data                      => rpc.request("auth.login", data),
			"changePassword":    (oldPassword, newPassword) => rpc.request("auth.changePassword", {oldPassword, newPassword}),
			"logout":            ()                         => rpc.request("auth.logout"),

			"close": rpc.close
		} as RPCType);
	})
}

const userData = (data : Record<string, string | KeystoreData>) => {
	const keys = Object.keys(data)
	if (keys.length > 0 && typeof data[keys[0]] === "string") {
		keys.forEach(k => data[k] = {"data": data[k], "user": false} as KeystoreData);
	}
	return data;
};

