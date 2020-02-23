import RPC from './lib/rpc_ws.js';
import {RPC as RPCType} from './types.js';

export default function (url: string): Promise<Readonly<RPCType>>{
	return RPC(url, 1.1).then(rpc => {
		return Object.freeze({
			"waitLogin":             () => rpc.await(-1, true),
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
			"waitTokenResize":       () => rpc.await(-48, true),
			"waitTokenRotate":       () => rpc.await(-49, true),
			"waitTokenSetToken":     () => rpc.await(-50, true),
			"waitTokenSetImage":     () => rpc.await(-51, true),
			"waitTokenSetPattern":   () => rpc.await(-52, true),

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

			"newMap":         map           => rpc.request("maps.new", map),
			"getMapDetails":  id            => rpc.request("maps.getMapDetails", id),
			"setMapDetails":  map           => rpc.request("maps.setMapDetails", map),

			"addLayer":        name               => rpc.request("maps.addLayer", name),
			"renameLayer":    (id, name)          => rpc.request("maps.renameLayer", {id, name}),
			"moveLayer":      (id, position)      => rpc.request("maps.moveLayer", {id, position}),
			"showLayer":       id                 => rpc.request("maps.showLayer", id),
			"hideLayer":       id                 => rpc.request("maps.hideLayer", id),
			"addMask":        (id, mask)          => rpc.request("maps.addMask", {id, mask}),
			"removeMask":      id                 => rpc.request("maps.removeMask", id),
			"removeLayer":     id                 => rpc.request("maps.removeLayer", id),
			"addToken":       (token, layerID)    => rpc.request("maps.addToken", {token, layerID}),
			"removeToken":     id                 => rpc.request("maps.removeToken", id),
			"moveToken":      (id, x, y)          => rpc.request("maps.moveToken", {id, x, y}),
			"resizeToken":    (id, width, height) => rpc.request("maps.resizeToken", {id, width, height}),
			"rotateToken":    (id, rotation)      => rpc.request("maps.rotateToken", {id, rotation}),
			"setTokenPattern": id                 => rpc.request("maps.setTokenPattern", id),
			"setTokenImage":   id                 => rpc.request("maps.setTokenSource", id),
			"setTokenSource": (id, source)        => rpc.request("maps.setTokenSource", {id, source}),
			"setTokenLayer":  (id, layer)         => rpc.request("maps.setTokenLayer", {id, layer}),
			"setTokenTop":     id                 => rpc.request("maps.setTokenTop", id),
			"setTokenBottom":  id                 => rpc.request("maps.setTokenBottom", id),
			"setInitiative":   initiative         => rpc.request("maps.setInitiative", initiative),

			"loggedIn":          ()                         => rpc.request("auth.loggedIn"),
			"loginRequirements": ()                         => rpc.request("auth.requirements"),
			"login":              data                      => rpc.request("auth.login", data),
			"changePassword":    (oldPassword, newPassword) => rpc.request("auth.changePassword", {oldPassword, newPassword}),
			"logout":            ()                         => rpc.request("auth.logout"),

			"close": rpc.close
		} as RPCType);
	})
}
