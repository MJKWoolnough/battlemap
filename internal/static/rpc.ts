import RPC from './lib/rpc_ws.js';
import {RPC as RPCType, KeystoreData} from './types.js';

export default function (url: string): Promise<Readonly<RPCType>>{
	return RPC(url, 1.1).then(rpc => {
		return Object.freeze({
			"waitLogin":             () => rpc.await(-1),
			"waitCurrentUserMap":    () => rpc.await(-2, true),
			"waitCurrentUserMapData":() => rpc.await(-3, true),
			"waitCharacterChange":   () => rpc.await(-32, true),
			"waitMapChange":         () => rpc.await(-33, true),
			"waitLayerAdd":          () => rpc.await(-34, true),
			"waitLayerFolderAdd":    () => rpc.await(-35, true),
			"waitLayerMove":         () => rpc.await(-36, true),
			"waitLayerRename":       () => rpc.await(-37, true),
			"waitLayerRemove":       () => rpc.await(-38, true),
			"waitMapLightChange":    () => rpc.await(-39, true),
			"waitMapInitiative":     () => rpc.await(-40, true),
			"waitLayerShow":         () => rpc.await(-41, true),
			"waitLayerHide":         () => rpc.await(-42, true),
			"waitLayerMaskAdd":      () => rpc.await(-43, true),
			"waitLayerMaskChange":   () => rpc.await(-44, true),
			"waitLayerMaskRemove":   () => rpc.await(-45, true),
			"waitTokenAdd":          () => rpc.await(-46, true),
			"waitTokenRemove":       () => rpc.await(-47, true),
			"waitTokenMoveLayer":    () => rpc.await(-48, true),
			"waitTokenMovePos":      () => rpc.await(-49, true),
			"waitTokenSetToken":     () => rpc.await(-50, true),
			"waitTokenSetImage":     () => rpc.await(-51, true),
			"waitTokenSetPattern":   () => rpc.await(-52, true),
			"waitTokenChange":       () => rpc.await(-53, true),
			"waitTokenFlip":         () => rpc.await(-54, true),
			"waitTokenFlop":         () => rpc.await(-55, true),
			"waitTokenSnap":         () => rpc.await(-56, true),
			"waitTokenSourceChange": () => rpc.await(-57, true),

			"images": {
				"waitAdded":         () => rpc.await(-4, true),
				"waitMoved":         () => rpc.await(-8, true),
				"waitRemoved":       () => rpc.await(-12, true),
				"waitLinked":        () => rpc.await(-17, true),
				"waitFolderAdded":   () => rpc.await(-20, true),
				"waitFolderMoved":   () => rpc.await(-24, true),
				"waitFolderRemoved": () => rpc.await(-28, true),

				"list":        ()         => rpc.request("imageAssets.list"),
				"createFolder": path      => rpc.request("imageAssets.createFolder", path),
				"move":        (from, to) => rpc.request("imageAssets.move", {from, to}),
				"moveFolder":  (from, to) => rpc.request("imageAssets.moveFolder", {from, to}),
				"remove":       path      => rpc.request("imageAssets.remove", path),
				"removeFolder": path      => rpc.request("imageAssets.removeFolder", path),
				"link":        (id, name) => rpc.request("imageAssets.link", {id, name}),
			},

			"audio": {
				"waitAdded":         () => rpc.await(-5, true),
				"waitMoved":         () => rpc.await(-9, true),
				"waitRemoved":       () => rpc.await(-13, true),
				"waitLinked":        () => rpc.await(-17, true),
				"waitFolderAdded":   () => rpc.await(-21, true),
				"waitFolderMoved":   () => rpc.await(-25, true),
				"waitFolderRemoved": () => rpc.await(-29, true),

				"list":        ()         => rpc.request("audioAssets.list"),
				"createFolder": path      => rpc.request("audioAssets.createFolder", path),
				"move":        (from, to) => rpc.request("audioAssets.move", {from, to}),
				"moveFolder":  (from, to) => rpc.request("audioAssets.moveFolder", {from, to}),
				"remove":       path      => rpc.request("audioAssets.remove", path),
				"removeFolder": path      => rpc.request("audioAssets.removeFolder", path),
				"link":        (id, name) => rpc.request("audioAssets.link", {id, name}),
			},

			"characters": {
				"waitAdded":         () => rpc.await(-6, true),
				"waitMoved":         () => rpc.await(-10, true),
				"waitRemoved":       () => rpc.await(-14, true),
				"waitLinked":        () => rpc.await(-18, true),
				"waitFolderAdded":   () => rpc.await(-22, true),
				"waitFolderMoved":   () => rpc.await(-26, true),
				"waitFolderRemoved": () => rpc.await(-30, true),

				"list":        ()         => rpc.request("characters.list"),
				"createFolder": path      => rpc.request("characters.createFolder", path),
				"move":        (from, to) => rpc.request("characters.move", {from, to}),
				"moveFolder":  (from, to) => rpc.request("characters.moveFolder", {from, to}),
				"remove":       path      => rpc.request("characters.remove", path),
				"removeFolder": path      => rpc.request("characters.removeFolder", path),
				"link":        (id, name) => rpc.request("characters.link", {id, name}),
			},

			"maps": {
				"waitAdded":         () => rpc.await(-7, true),
				"waitMoved":         () => rpc.await(-11, true),
				"waitRemoved":       () => rpc.await(-15, true),
				"waitLinked":        () => rpc.await(-19, true),
				"waitFolderAdded":   () => rpc.await(-23, true),
				"waitFolderMoved":   () => rpc.await(-27, true),
				"waitFolderRemoved": () => rpc.await(-31, true),

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
			"setInitiative":    initiative                                => rpc.request("maps.setInitiative", initiative),

			"characterCreate":      name      => rpc.request("characters.create", name),
			"characterSet":        (id, data) => rpc.request("characters.set", {id, data}),
			"characterGet":        (id, keys) => rpc.request("characters.get", {id, keys}),
			"characterGetUser":    (id, keys) => rpc.request("characters.get", {id, keys}).then(userData),
			"characterGetAll":      id        => rpc.request("characters.get", {id}),
			"characterRemoveKeys": (id, keys) => rpc.request("characters.removeKeys", {id, keys}),

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
	if (keys.length > 0 && typeof data[keys[0]] !== "string") {
		keys.forEach(k => data[k] = (data[k] as KeystoreData).data);
	}
	return data;
};
