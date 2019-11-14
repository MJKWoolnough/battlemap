import RPC from './lib/rpc_ws.js';
import {RPC as RPCType, Tag, Asset} from './types.js';

export default function (url: string): Promise<Readonly<RPCType>>{
	return RPC(url).then(rpc => {
		return Object.freeze({
			"waitLogin":          () => rpc.await(-1, false),
			"waitCurrentUserMap": () => rpc.await(-2, false),

			"waitMapAdd":          () => rpc.await(-3, true),
			"waitMapChange":       () => rpc.await(-4, true),
			"waitMapRename":       () => rpc.await(-5, true),
			"waitMapOrderChange":  () => rpc.await(-6, true),
			"waitAssetAdd":        () => rpc.await(-7, true),
			"waitAssetChange":     () => rpc.await(-8, true),
			"waitAssetRemove":     () => rpc.await(-9, true),
			"waitTagAdd":          () => rpc.await(-10, true),
			"waitTagRemove":       () => rpc.await(-11, true),
			"waitTagChange":       () => rpc.await(-12, true),
			"waitCharacterAdd":    () => rpc.await(-13, true),
			"waitCharacterChange": () => rpc.await(-14, true),
			"waitCharacterRemove": () => rpc.await(-15, true),
			"waitTokenChange":     () => rpc.await(-16, true),
			"waitMaskChange":      () => rpc.await(-17, true),

			"connID": () => rpc.request("conn.connID"),

			"deleteAsset":          id        => rpc.request("assets.deleteAsset", id),
			"renameAsset":         (id, name) => rpc.request("assets.renameAsset", {id, name}),
			"addTagsToAsset":      (id, tags) => rpc.request("assets.addTagsToAsset", {id, tags}),
			"removeTagsFromAsset": (id, tags) => rpc.request("assets.removeTagsFromAsset", {id, tags}),
			"getAssets":           ()         => rpc.request("assets.getAssets"),

			"addTag":       name      => rpc.request("assets.addTag", name),
			"deleteTag":    id        => rpc.request("assets.deleteTag", id),
			"renameTag":   (id, name) => rpc.request("assets.renameTag", {id, name}),
			"getTags":     ()         => rpc.request("assets.getTags"),

			"getCurrentMap": ()  => rpc.request("maps.getCurrentMap"),
			"setCurrentMap":  id => rpc.request("maps.setCurrentMap", id),
			"getUserMap":    ()  => rpc.request("maps.getCurrentUserMap"),
			"setUserMap":     id => rpc.request("maps.setCurrentUserMap", id),

			"newMap":               map                                             => rpc.request("maps.new"),
			"renameMap":           (id, name)                                       => rpc.request("maps.rename", {id, name}),
			"changeMapDimensions": (id, width, height)                              => rpc.request("maps.changeDimensions", {id, width, height}),
			"changeGrid":          (id, squaresWidth, squaresColour, squaresStroke) => rpc.request("maps.changeGrid", {id, squaresWidth, squaresColour, squaresStroke}),
			"moveMap":             (id, position)                                   => rpc.request("maps.move", {id, position}),

			"addLayer":    name       => rpc.request.bind(null, "maps.addLayer", name),
			"renameLayer": (id, name) => rpc.request("maps.renameLayer", {id, name}),

			"close": rpc.close
		} as RPCType);
	})
}
