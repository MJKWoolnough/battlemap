import RPC from './lib/rpc_ws.js';
import {RPC as RPCType} from './types.js';

export default function (url: string): Promise<Readonly<RPCType>>{
	return RPC(url, 1.1).then(rpc => {
		return Object.freeze({
			"waitLogin":          () => rpc.await(-1, false),
			"waitCurrentUserMap": () => rpc.await(-2, false),

			"waitMapAdd":          () => rpc.await(-3, true),
			"waitMapChange":       () => rpc.await(-4, true),
			"waitMapRename":       () => rpc.await(-5, true),
			"waitMapOrderChange":  () => rpc.await(-6, true),

			"waitImageAssetAdded":    () => rpc.await(-7, true),
			"waitImageAssetMoved":    () => rpc.await(-8, true),
			"waitImageAssetRemoved":  () => rpc.await(-9, true),
			"waitImageAssetLinked":   () => rpc.await(-9, true),
			"waitImageFolderAdded":   () => rpc.await(-10, true),
			"waitImageFolderMoved":   () => rpc.await(-11, true),
			"waitImageFolderRemoved": () => rpc.await(-12, true),

			"waitAudioAssetAdded":    () => rpc.await(-13, true),
			"waitAudioAssetMoved":    () => rpc.await(-14, true),
			"waitAudioAssetRemoved":  () => rpc.await(-15, true),
			"waitAudioAssetLinked":   () => rpc.await(-16, true),
			"waitAudioFolderAdded":   () => rpc.await(-17, true),
			"waitAudioFolderMoved":   () => rpc.await(-18, true),
			"waitAudioFolderRemoved": () => rpc.await(-19, true),

			"waitCharacterAdd":    () => rpc.await(-21, true),
			"waitCharacterChange": () => rpc.await(-22, true),
			"waitCharacterRemove": () => rpc.await(-23, true),
			"waitTokenChange":     () => rpc.await(-24, true),
			"waitMaskChange":      () => rpc.await(-25, true),

			"connID": () => rpc.request("conn.connID"),

			"getImageAssets":    ()         => rpc.request("imageAssets.list"),
			"createImageFolder":  path      => rpc.request("imageAssets.createFolder", path),
			"moveImageAsset":    (from, to) => rpc.request("imageAssets.moveAsset", {from, to}),
			"moveImageFolder":   (from, to) => rpc.request("imageAssets.moveFolder", {from, to}),
			"removeImageAsset":   path      => rpc.request("imageAssets.removeAsset", path),
			"removeImageFolder":  path      => rpc.request("imageAssets.removeFolder", path),
			"linkImageAsset":    (id, name) => rpc.request("imageAssets.link", {id, name}),

			"getAudioAssets":    ()         => rpc.request("imageAudio.list"),
			"createAudioFolder":  path      => rpc.request("imageAudio.createFolder", path),
			"moveAudioAsset":    (from, to) => rpc.request("imageAudio.moveAsset", {from, to}),
			"moveAudioFolder":   (from, to) => rpc.request("imageAudio.moveFolder", {from, to}),
			"removeAudioAsset":   path      => rpc.request("imageAudio.removeAsset", path),
			"removeAudioFolder":  path      => rpc.request("imageAudio.removeFolder", path),
			"linkAudioAsset":    (id, name) => rpc.request("imageAudio.link", {id, name}),


			"getCurrentMap": ()  => rpc.request("maps.getCurrentMap"),
			"setCurrentMap":  id => rpc.request("maps.setCurrentMap", id),
			"getUserMap":    ()  => rpc.request("maps.getCurrentUserMap"),
			"setUserMap":     id => rpc.request("maps.setCurrentUserMap", id),

			"newMap":               map                                             => rpc.request("maps.new"),
			"renameMap":           (id, name)                                       => rpc.request("maps.rename", {id, name}),
			"changeMapDimensions": (id, width, height)                              => rpc.request("maps.changeDimensions", {id, width, height}),
			"changeGrid":          (id, squaresWidth, squaresColour, squaresStroke) => rpc.request("maps.changeGrid", {id, squaresWidth, squaresColour, squaresStroke}),
			"moveMap":             (id, position)                                   => rpc.request("maps.move", {id, position}),

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
