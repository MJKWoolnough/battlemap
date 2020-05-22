import RPC from './lib/rpc_ws.js';
import {RPC as RPCType} from './types.js';

export default function (url: string): Promise<Readonly<RPCType>>{
	return RPC(url, 1.1).then(rpc => {
		return Object.freeze({
			"waitLogin":             () => rpc.await(-1),
			"waitCurrentUserMap":    () => rpc.await(-2, true),
			"waitCharacterChange":   () => rpc.await(-31, true),
			"waitMapChange":         () => rpc.await(-32, true),
			"waitLayerAdd":          () => rpc.await(-33, true),
			"waitLayerRename":       () => rpc.await(-34, true),
			"waitLayerRemove":       () => rpc.await(-35, true),
			"waitLayerOrderChange":  () => rpc.await(-36, true),
			"waitMapLightChange":    () => rpc.await(-37, true),
			"waitMapInitiative":     () => rpc.await(-38, true),
			"waitLayerShow":         () => rpc.await(-39, true),
			"waitLayerHide":         () => rpc.await(-40, true),
			"waitLayerMaskAdd":      () => rpc.await(-41, true),
			"waitLayerMaskChange":   () => rpc.await(-42, true),
			"waitLayerMaskRemove":   () => rpc.await(-43, true),
			"waitLayerTokenOrder":   () => rpc.await(-44, true),
			"waitTokenAdd":          () => rpc.await(-45, true),
			"waitTokenRemove":       () => rpc.await(-46, true),
			"waitTokenMove":         () => rpc.await(-47, true),
			"waitTokenSetToken":     () => rpc.await(-50, true),
			"waitTokenSetImage":     () => rpc.await(-51, true),
			"waitTokenSetPattern":   () => rpc.await(-52, true),
			"waitTokenChange":       () => rpc.await(-53, true),
			"waitTokenFlip":         () => rpc.await(-54, true),
			"waitTokenFlop":         () => rpc.await(-55, true),

			"images": {
				"waitAdded":         () => rpc.await(-3, true),
				"waitMoved":         () => rpc.await(-7, true),
				"waitRemoved":       () => rpc.await(-11, true),
				"waitLinked":        () => rpc.await(-15, true),
				"waitFolderAdded":   () => rpc.await(-19, true),
				"waitFolderMoved":   () => rpc.await(-23, true),
				"waitFolderRemoved": () => rpc.await(-27, true),

				"list":        ()         => rpc.request("imageAssets.list"),
				"createFolder": path      => rpc.request("imageAssets.createFolder", path),
				"move":        (from, to) => rpc.request("imageAssets.move", {from, to}),
				"moveFolder":  (from, to) => rpc.request("imageAssets.moveFolder", {from, to}),
				"remove":       path      => rpc.request("imageAssets.remove", path),
				"removeFolder": path      => rpc.request("imageAssets.removeFolder", path),
				"link":        (id, name) => rpc.request("imageAssets.link", {id, name}),
			},

			"audio": {
				"waitAdded":         () => rpc.await(-4, true),
				"waitMoved":         () => rpc.await(-8, true),
				"waitRemoved":       () => rpc.await(-12, true),
				"waitLinked":        () => rpc.await(-16, true),
				"waitFolderAdded":   () => rpc.await(-20, true),
				"waitFolderMoved":   () => rpc.await(-24, true),
				"waitFolderRemoved": () => rpc.await(-28, true),

				"list":        ()         => rpc.request("audioAssets.list"),
				"createFolder": path      => rpc.request("audioAssets.createFolder", path),
				"move":        (from, to) => rpc.request("audioAssets.move", {from, to}),
				"moveFolder":  (from, to) => rpc.request("audioAssets.moveFolder", {from, to}),
				"remove":       path      => rpc.request("audioAssets.remove", path),
				"removeFolder": path      => rpc.request("audioAssets.removeFolder", path),
				"link":        (id, name) => rpc.request("audioAssets.link", {id, name}),
			},

			"characters": {
				"waitAdded":         () => rpc.await(-5, true),
				"waitMoved":         () => rpc.await(-9, true),
				"waitRemoved":       () => rpc.await(-13, true),
				"waitLinked":        () => rpc.await(-17, true),
				"waitFolderAdded":   () => rpc.await(-21, true),
				"waitFolderMoved":   () => rpc.await(-25, true),
				"waitFolderRemoved": () => rpc.await(-29, true),

				"list":        ()         => rpc.request("characters.list"),
				"createFolder": path      => rpc.request("characters.createFolder", path),
				"move":        (from, to) => rpc.request("characters.move", {from, to}),
				"moveFolder":  (from, to) => rpc.request("characters.moveFolder", {from, to}),
				"remove":       path      => rpc.request("characters.remove", path),
				"removeFolder": path      => rpc.request("characters.removeFolder", path),
				"link":        (id, name) => rpc.request("characters.link", {id, name}),
			},

			"maps": {
				"waitAdded":         () => rpc.await(-6, true),
				"waitMoved":         () => rpc.await(-10, true),
				"waitRemoved":       () => rpc.await(-14, true),
				"waitLinked":        () => rpc.await(-18, true),
				"waitFolderAdded":   () => rpc.await(-22, true),
				"waitFolderMoved":   () => rpc.await(-26, true),
				"waitFolderRemoved": () => rpc.await(-30, true),

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
			"setTokenSource":  (path, pos, source)                        => rpc.request("maps.setTokenSource", {path, pos, source}),
			"setTokenLayer":   (from, fromPos, to, toPos)                 => rpc.request("maps.setTokenLayer", {from, fromPos, to, toPos}),
			"setTokenPos":     (path, pos, newPos)                        => rpc.request("maps.setTokenPos", {path, pos, newPos}),
			"setInitiative":    initiative                                => rpc.request("maps.setInitiative", initiative),

			"loggedIn":          ()                         => rpc.request("auth.loggedIn"),
			"loginRequirements": ()                         => rpc.request("auth.requirements"),
			"login":              data                      => rpc.request("auth.login", data),
			"changePassword":    (oldPassword, newPassword) => rpc.request("auth.changePassword", {oldPassword, newPassword}),
			"logout":            ()                         => rpc.request("auth.logout"),

			"close": rpc.close
		} as RPCType);
	})
}
