import RPC from './lib/rpc_ws.js';
import {RPC as RPCType, ParentPath} from './types.js';

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

				"list":         ()                                                                               => rpc.request("imageAssets.list"),
				"createFolder": (parent: ParentPath, name: string)                                               => rpc.request("imageAssets.createFolder", parent.getPath() + "/" + name),
				"move":         (oldParent: ParentPath, oldName: string, newParent: ParentPath, newName: string) => rpc.request("imageAssets.move", {from: oldParent.getPath() + "/" + oldName, to: newParent.getPath() + "/" + newName}),
				"moveFolder":   (oldParent: ParentPath, oldName: string, newParent: ParentPath, newName: string) => rpc.request("imageAssets.moveFolder", {from: oldParent.getPath() + "/" + oldName, to: newParent.getPath() + "/" + newName}),
				"remove":       (parent: ParentPath, name: string)                                               => rpc.request("imageAssets.remove", parent.getPath() + "/" + name),
				"removeFolder": (parent: ParentPath, name: string)                                               => rpc.request("imageAssets.removeFolder", parent.getPath() + "/" + name),
				"link":         (id, parent: ParentPath, name: string)                                           => rpc.request("imageAssets.link", {id, name}),
			},

			"audio": {
				"waitAdded":         () => rpc.await(-4, true),
				"waitMoved":         () => rpc.await(-8, true),
				"waitRemoved":       () => rpc.await(-12, true),
				"waitLinked":        () => rpc.await(-16, true),
				"waitFolderAdded":   () => rpc.await(-20, true),
				"waitFolderMoved":   () => rpc.await(-24, true),
				"waitFolderRemoved": () => rpc.await(-28, true),

				"list":         ()                                                                               => rpc.request("audioAssets.list"),
				"createFolder": (parent: ParentPath, name: string)                                               => rpc.request("audioAssets.createFolder", parent.getPath() + "/" + name),
				"move":         (oldParent: ParentPath, oldName: string, newParent: ParentPath, newName: string) => rpc.request("audioAssets.move", {from: oldParent.getPath() + "/" + oldName, to: newParent.getPath() + "/" + newName}),
				"moveFolder":   (oldParent: ParentPath, oldName: string, newParent: ParentPath, newName: string) => rpc.request("audioAssets.moveFolder", {from: oldParent.getPath() + "/" + oldName, to: newParent.getPath() + "/" + newName}),
				"remove":       (parent: ParentPath, name: string)                                               => rpc.request("audioAssets.remove", parent.getPath() + "/" + name),
				"removeFolder": (parent: ParentPath, name: string)                                               => rpc.request("audioAssets.removeFolder", parent.getPath() + "/" + name),
				"link":         (id, parent: ParentPath, name: string)                                           => rpc.request("audioAssets.link", {id, name}),
			},

			"characters": {
				"waitAdded":         () => rpc.await(-5, true),
				"waitMoved":         () => rpc.await(-9, true),
				"waitRemoved":       () => rpc.await(-13, true),
				"waitLinked":        () => rpc.await(-17, true),
				"waitFolderAdded":   () => rpc.await(-21, true),
				"waitFolderMoved":   () => rpc.await(-25, true),
				"waitFolderRemoved": () => rpc.await(-29, true),

				"list":         ()                                                                               => rpc.request("characters.list"),
				"createFolder": (parent: ParentPath, name: string)                                               => rpc.request("characters.createFolder", parent.getPath() + "/" + name),
				"move":         (oldParent: ParentPath, oldName: string, newParent: ParentPath, newName: string) => rpc.request("characters.move", {from: oldParent.getPath() + "/" + oldName, to: newParent.getPath() + "/" + newName}),
				"moveFolder":   (oldParent: ParentPath, oldName: string, newParent: ParentPath, newName: string) => rpc.request("characters.moveFolder", {from: oldParent.getPath() + "/" + oldName, to: newParent.getPath() + "/" + newName}),
				"remove":       (parent: ParentPath, name: string)                                               => rpc.request("characters.remove", parent.getPath() + "/" + name),
				"removeFolder": (parent: ParentPath, name: string)                                               => rpc.request("characters.removeFolder", parent.getPath() + "/" + name),
				"link":         (id, parent: ParentPath, name: string)                                           => rpc.request("characters.link", {id, name}),
			},

			"maps": {
				"waitAdded":         () => rpc.await(-6, true),
				"waitMoved":         () => rpc.await(-10, true),
				"waitRemoved":       () => rpc.await(-14, true),
				"waitLinked":        () => rpc.await(-18, true),
				"waitFolderAdded":   () => rpc.await(-22, true),
				"waitFolderMoved":   () => rpc.await(-26, true),
				"waitFolderRemoved": () => rpc.await(-30, true),

				"list":         ()                                                                               => rpc.request("maps.list"),
				"createFolder": (parent: ParentPath, name: string)                                               => rpc.request("maps.createFolder", parent.getPath() + "/" + name),
				"move":         (oldParent: ParentPath, oldName: string, newParent: ParentPath, newName: string) => rpc.request("maps.move", {from: oldParent.getPath() + "/" + oldName, to: newParent.getPath() + "/" + newName}),
				"moveFolder":   (oldParent: ParentPath, oldName: string, newParent: ParentPath, newName: string) => rpc.request("maps.moveFolder", {from: oldParent.getPath() + "/" + oldName, to: newParent.getPath() + "/" + newName}),
				"remove":       (parent: ParentPath, name: string)                                               => rpc.request("maps.remove", parent.getPath() + "/" + name),
				"removeFolder": (parent: ParentPath, name: string)                                               => rpc.request("maps.removeFolder", parent.getPath() + "/" + name),
				"link":         (id, parent: ParentPath, name: string)                                           => rpc.request("maps.link", {id, name}),
			},

			"connID": () => rpc.request("conn.connID"),

			"setCurrentMap":  id => rpc.request("maps.setCurrentMap", id),
			"getUserMap":    ()  => rpc.request("maps.getUserMap"),
			"setUserMap":     id => rpc.request("maps.setUserMap", id),

			"newMap":         map           => rpc.request("maps.new", map),
			"getMapDetails":  id            => rpc.request("maps.getMapDetails", id),
			"setMapDetails":  map           => rpc.request("maps.setMapDetails", map),

			"addLayer":        name                 => rpc.request("maps.addLayer", name),
			"renameLayer":    (path, name)          => rpc.request("maps.renameLayer", {path, name}),
			"moveLayer":      (from, to, position)  => rpc.request("maps.moveLayer", {from, to, position}),
			"showLayer":       path                 => rpc.request("maps.showLayer", path),
			"hideLayer":       path                 => rpc.request("maps.hideLayer", path),
			"addMask":        (path, mask)          => rpc.request("maps.addMask", {path, mask}),
			"removeMask":      path                 => rpc.request("maps.removeMask", path),
			"removeLayer":     path                 => rpc.request("maps.removeLayer", path),
			"addToken":       (path, token)         => rpc.request("maps.addToken", {path, token}),
			"removeToken":     path                 => rpc.request("maps.removeToken", path),
			"moveToken":      (path, x, y)          => rpc.request("maps.moveToken", {path, x, y}),
			"resizeToken":    (path, width, height) => rpc.request("maps.resizeToken", {path, width, height}),
			"rotateToken":    (path, rotation)      => rpc.request("maps.rotateToken", {path, rotation}),
			"setTokenPattern": path                 => rpc.request("maps.setTokenPattern", path),
			"setTokenImage":   path                 => rpc.request("maps.setTokenSource", path),
			"setTokenSource": (path, source)        => rpc.request("maps.setTokenSource", {path, source}),
			"setTokenLayer":  (path, layer)         => rpc.request("maps.setTokenLayer", {path, layer}),
			"setTokenTop":     path                 => rpc.request("maps.setTokenTop", path),
			"setTokenBottom":  path                 => rpc.request("maps.setTokenBottom", path),
			"setInitiative":   initiative           => rpc.request("maps.setInitiative", initiative),

			"loggedIn":          ()                         => rpc.request("auth.loggedIn"),
			"loginRequirements": ()                         => rpc.request("auth.requirements"),
			"login":              data                      => rpc.request("auth.login", data),
			"changePassword":    (oldPassword, newPassword) => rpc.request("auth.changePassword", {oldPassword, newPassword}),
			"logout":            ()                         => rpc.request("auth.logout"),

			"close": rpc.close
		} as RPCType);
	})
}
