import type {Broadcast, FolderItems, GridDetails, IDName, IDPath, Keystore, KeystoreData, LayerRename, MapData, MapStart, Mask, MusicPack, NewMap, Plugin, Token, TokenSet, Wall} from './types.js';
import type {Binding} from './lib/bind.js';
import type {TypeGuard} from './lib/typeguard.js';
import {WS} from './lib/conn.js';
import {Subscription} from './lib/inter.js';
import pageLoad from './lib/load.js';
import {RPC} from './lib/rpc.js';
import {And, Arr, Obj, Rec, Tuple, Undefined} from './lib/typeguard.js';
import {Colour, isColour} from './colours.js';
import lang from './language.js';
import {isBool, isBroadcast, isBroadcastWindow, isCharacterDataChange, isFolderItems, isFromTo, isIDName, isIDPath, isKeyData, isKeystore, isLayerMove, isLayerRename, isLayerShift, isMapData, isMapDetails, isMapStart, isMask, isMaskSet, isMusicPack, isMusicPackPlay, isMusicPackTrackAdd, isMusicPackTrackRemove, isMusicPackTrackRepeat, isMusicPackTrackVolume, isMusicPackVolume, isPlugin, isPluginDataChange, isStr, isTokenAdd, isTokenMoveLayerPos, isTokenSet, isUint, isWall, isWallPath} from './types.js';
import {shell} from './windows.js';

const broadcastIsAdmin = -1, broadcastCurrentUserMap = -2, broadcastCurrentUserMapData = -3, broadcastMapDataSet = -4, broadcastMapDataRemove = -5, broadcastMapStartChange = -6, broadcastImageItemAdd = -7, broadcastAudioItemAdd = -8, broadcastCharacterItemAdd = -9, broadcastMapItemAdd = -10, broadcastImageItemMove = -11, broadcastAudioItemMove = -12, broadcastCharacterItemMove = -13, broadcastMapItemMove = -14, broadcastImageItemRemove = -15, broadcastAudioItemRemove = -16, broadcastCharacterItemRemove = -17, broadcastMapItemRemove = -18, broadcastImageItemCopy = -19, broadcastAudioItemCopy = -20, broadcastCharacterItemCopy = -21, broadcastMapItemCopy = -22, broadcastImageFolderAdd = -23, broadcastAudioFolderAdd = -24, broadcastCharacterFolderAdd = -25, broadcastMapFolderAdd = -26, broadcastImageFolderMove = -27, broadcastAudioFolderMove = -28, broadcastCharacterFolderMove = -29, broadcastMapFolderMove = -30, broadcastImageFolderRemove = -31, broadcastAudioFolderRemove = -32, broadcastCharacterFolderRemove = -33, broadcastMapFolderRemove = -34, broadcastMapItemChange = -35, broadcastCharacterDataChange = -36, broadcastLayerAdd = -37, broadcastLayerFolderAdd = -38, broadcastLayerMove = -39, broadcastLayerRename = -40, broadcastLayerRemove = -41, broadcastGridDistanceChange = -42, broadcastGridDiagonalChange = -43, broadcastMapLightChange = -44, broadcastLayerShow = -45, broadcastLayerHide = -46, broadcastLayerLock = -47, broadcastLayerUnlock = -48, broadcastMaskAdd = -49, broadcastMaskRemove = -50, broadcastMaskSet = -51, broadcastTokenAdd = -52, broadcastTokenRemove = -53, broadcastTokenMoveLayerPos = -54, broadcastTokenSet = -55, broadcastTokenSetMulti = -56, broadcastLayerShift = -57, broadcastWallAdd = -58, broadcastWallRemove = -59, broadcastWallModify = -60, broadcastWallMoveLayer = -61, broadcastMusicPackAdd = -62, broadcastMusicPackRename = -63, broadcastMusicPackRemove = -64, broadcastMusicPackCopy = -65, broadcastMusicPackVolume = -66, broadcastMusicPackPlay = -67, broadcastMusicPackStop = -68, broadcastMusicPackStopAll = -69, broadcastMusicPackTrackAdd = -70, broadcastMusicPackTrackRemove = -71, broadcastMusicPackTrackVolume = -72, broadcastMusicPackTrackRepeat = -73, broadcastPluginChange = -74, broadcastPluginSettingChange = -75, broadcastWindow = -76, broadcastSignalMeasure = -77, broadcastSignalPosition = -78, broadcastSignalMovePosition = -79, broadcastAny = -80;

export let isAdmin: boolean,
isUser: boolean,
timeShift = 0;

const mapDataCheckers: ((data: Record<string, any>) => void)[] = [],
      tokenDataCheckers: ((data: Record<string, KeystoreData>) => void)[] = [],
      characterDataCheckers: ((data: Record<string, KeystoreData>) => void)[] = [],
      arpc = new RPC();

export const addMapDataChecker = (fn: (data: Record<string, any>) => void) => mapDataCheckers.push(fn),
addCharacterDataChecker = (fn: (data: Record<string, KeystoreData>) => void) => characterDataCheckers.push(fn),
addTokenDataChecker = (fn: (data: Record<string, KeystoreData>) => void) => tokenDataCheckers.push(fn),
handleError = (e: Error | string | Binding) => {
	console.log(e);
	shell.alert(lang["ERROR"], (e instanceof Error ? e.message : Object.getPrototypeOf(e) === Object.prototype ? JSON.stringify(e): e.toString()) || lang["ERROR_UNKNOWN"]);
},
[rpc, internal, combined] = (() => {
	type ArgTuple<N extends Number, U extends string[] = []> = U["length"] extends N ? U : ArgTuple<N, [string, ...U]>;

	type WaitersOf<T> = {[K in keyof T as K extends `wait${string}` ? K : never]: T[K]}

	type FolderWaiters = WaitersOf<typeof rpc["images"]>;

	type InternalWaiters = WaitersOf<typeof rpc> & {
		images: {[K in keyof FolderWaiters]: FolderWaiters[K]};
		audio: {[K in keyof FolderWaiters]: FolderWaiters[K]};
		characters: {[K in keyof FolderWaiters]: FolderWaiters[K]};
		maps: {[K in keyof FolderWaiters]: FolderWaiters[K]};
	}

	const isUndefined = Undefined(),
	      isMusicPacks = Arr(isMusicPack),
	      isPlugins = Rec(isStr, isPlugin),
	      isCopy = And(isIDName, Obj({"newID": isUint})),
	      isCopied = Obj({"oldID": isUint, "newID": isUint, "path": isStr}),
	      isSignalMeasure = Tuple(isUint, isUint, isUint, isUint, ...isUint),
	      isSignalPosition = Tuple(isUint, isUint),
	      internal = {
		      "images": {},
		      "audio": {},
		      "characters": {},
		      "maps": {},
	      },
	      combined = {
		      "images": {},
		      "audio": {},
		      "characters": {},
		      "maps": {},
	      },
	      ep = <const Args extends any[], T extends any, const ArgNames extends string[] = ArgTuple<Args["length"]>>(endpoint: string, args: ArgNames, typeguard: TypeGuard<T>, waiter?: `wait${string}`, modFn?: (params: any, ret: T) => any, on: any = internal) => {
		const [sub, sFn] = Subscription.bind(1);

		if (waiter && on) {
			on[waiter] = () => sub;
		}

		return (...params: Args) => {
			const ps = args.length === 0 ? undefined : args.length === 1 && args[0] === "" ? args[0] : params.reduce((o, v, n) => o[args[n]] = v, {}),
			      p = arpc.request(endpoint, ps, typeguard.throws());

			p.then(modFn ? r => sFn(modFn(r, ps)) : r => sFn(r ?? ps));

			return p;
		}
	      },
	      w = <const T>(id: number, typeguard: TypeGuard<T>, waiter: `wait${string}`, on: any = combined, int: any = internal) => {
		const sub = arpc.subscribe(id, typeguard.throws()),
		      fn = () => sub;

		if (int) {
			on[waiter] = Subscription.merge(sub, int[waiter]);
		} else {
			on[waiter] = fn;
		}

		return fn;
	      },
	      folderEPs = (prefix: keyof typeof internal, added: number, moved: number, removed: number, copied: number, folderAdded: number, folderMoved: number, folderRemove: number) => Object.freeze({
		"list":         ep<[], FolderItems>            (`${prefix}.list`,         [],             isFolderItems),
		"createFolder": ep<[string], string>           (`${prefix}.createFolder`, [""],           isStr,       "waitFolderAdded",   undefined, internal[prefix]),
		"move":         ep<[string, string], string>   (`${prefix}.move`,         ["from", "to"], isStr,       "waitMoved",         undefined, internal[prefix]),
		"moveFolder":   ep<[string, string], string>   (`${prefix}.moveFolder`,   ["from", "to"], isStr,       "waitFolderMoved",   undefined, internal[prefix]),
		"remove":       ep<[string],         undefined>(`${prefix}.remove`,       [""],           isUndefined, "waitRemoved",       undefined, internal[prefix]),
		"removeFolder": ep<[string],         undefined>(`${prefix}.removeFolder`, [""],           isUndefined, "waitFolderRemoved", undefined, internal[prefix]),
		"copy":         ep<[number, string], IDPath>   (`${prefix}.copy`,         ["id", "path"], isIDPath,    "waitCopied",        undefined, internal[prefix]),

		"waitAdded":         w(added,         Arr(isIDName), "waitAdded",         combined[prefix], internal[prefix]),
		"waitMoved":         w(moved,         isFromTo,      "waitMoved",         combined[prefix], internal[prefix]),
		"waitRemoved":       w(removed,       isStr,         "waitRemoved",       combined[prefix], internal[prefix]),
		"waitCopied":        w(copied,        isCopied,      "waitCopied",        combined[prefix], internal[prefix]),
		"waitFolderAdded":   w(folderAdded,   isStr,         "waitFolderAdded",   combined[prefix], internal[prefix]),
		"waitFolderMoved":   w(folderMoved,   isFromTo,      "waitFolderMoved",   combined[prefix], internal[prefix]),
		"waitFolderRemoved": w(folderRemove,  isStr,         "waitFolderRemoved", combined[prefix], internal[prefix])
	      }),
	      rpc = {
		"ready": ep<[], undefined>("conn.ready", [], isUndefined),

		"setCurrentMap": ep<[number], undefined>("maps.setCurrentMap", [""], isUndefined),
		"getUserMap":    ep<[],       number>   ("maps.getUserMap",    [],   isUint),
		"setUserMap":    ep<[number], undefined>("maps.setUserMap",    [""], isUndefined, "waitCurrentUserMap"),
		"getMapData":    ep<[number], MapData>  ("maps.getMapData",    [""], isMapData),

		"newMap":           ep<[NewMap],      IDName>   ("maps.new",             [""],            isIDName),
		"setMapDetails":    ep<[GridDetails], undefined>("maps.setMapDetails",   [""],            isUndefined, "waitMapChange"),
		"setMapStart":      ep<[MapStart],    undefined>("maps.setStartMap",     [""],            isUndefined, "waitMapStartChange"),
		"setGridDistance":  ep<[number],      undefined>("maps.setGridDistance", [""],            isUndefined, "waitGridDistanceChange"),
		"setGridDiagonal":  ep<[boolean],     undefined>("maps.setGridDiagonal", [""],            isUndefined, "waitGridDiagonalChange"),
		"setLightColour":   ep<[Colour],      undefined>("maps.setLightcolour",  [""],            isUndefined, "waitMapLightChange"),
		"setMapKeyData":    ep<[string, any], undefined>("maps.setData",         ["key", "data"], isUndefined, "waitMapDataSet"),
		"removeMapKeyData": ep<[string],      undefined>("maps.removeData",      [""],            isUndefined, "waitMapDataRemove"),

		"signalMeasure":      ep<[[number, number, number, number, ...number[]] | null], undefined>("maps.signalMeasure",      [""], isUndefined),
		"signalPosition":     ep<[[number, number]],                                     undefined>("maps.signalPosition",     [""], isUndefined),
		"signalMovePosition": ep<[[number, number]],                                     undefined>("maps.signalMovePosition", [""], isUndefined),

		"addLayer":         ep<[string],                            string>     ("maps.addLayer",         [""],                       isStr,         "waitLayerAdd"),
		"addLayerFolder":   ep<[string],                            string>     ("maps.addLayerFolder",   [""],                       isStr,         "waitLayerFolderAdd"),
		"renameLayer":      ep<[string, string],                    LayerRename>("maps.renameLayer",      ["path", "name"],           isLayerRename, "waitLayerRename"),
		"moveLayer":        ep<[string, string, number],            undefined>  ("maps.moveLayer",        ["from", "to", "position"], isUndefined,   "waitLayerMove"),
		"showLayer":        ep<[string],                            undefined>  ("maps.showLayer",        [""],                       isUndefined,   "waitLayerShow"),
		"hideLayer":        ep<[string],                            undefined>  ("maps.hideLayer",        [""],                       isUndefined,   "waitLayerHide"),
		"lockLayer":        ep<[string],                            undefined>  ("maps.lockLayer",        [""],                       isUndefined,   "waitLayerLock"),
		"unlockLayer":      ep<[string],                            undefined>  ("maps.unlockLayer",      [""],                       isUndefined,   "waitLayerUnlock"),
		"removeLayer":      ep<[string],                            undefined>  ("maps.removeLayer",      [""],                       isUndefined,   "waitMaskAdd"),
		"addToMask":        ep<[Mask],                              undefined>  ("maps.addToMask",        [""],                       isUndefined,   "waitMaskRemove"),
		"removeFromMask":   ep<[number],                            undefined>  ("maps.removeFromMask",   [""],                       isUndefined,   "waitMaskSet"),
		"setMask":          ep<[boolean, Mask[]],                   undefined>  ("maps.setMask",          ["baseOpaque", "masks"],    isUndefined,   "waitLayerRemove"),
		"addToken":         ep<[string, Token, number | undefined], number>     ("maps.addToken",         ["path", "token", "pos"],   isUint,        "waitTokenAdd", (p, id: number) => (p["token"]["id"] = id, p)),
		"removeToken":      ep<[number],                            undefined>  ("maps.removeToken",      [""],                       isUndefined,   "waitTokenRemove"),
		"setToken":         ep<[TokenSet],                          undefined>  ("maps.setToken",         [""],                       isUndefined,   "waitTokenSet"),
		"setTokenMulti":    ep<[TokenSet[]],                        undefined>  ("maps.setTokenMulti",    [""],                       isUndefined,   "waitTokenMultiSet"),
		"setTokenLayerPos": ep<[number, string, number],            undefined>  ("maps.setTokenLayerPos", ["id", "to", "newPos"],     isUndefined,   "waitTokenMoveLayerPos"),
		"shiftLayer":       ep<[string, number, number],            undefined>  ("maps.shiftLayer",       ["path", "dx", "dy"],       isUndefined,   "waitLayerShift"),
		"addWall":          ep<[string, Wall],                      number>     ("maps.addWall",          ["id", "wall"],             isUint,        "waitWallAdded", (p, id: number) => (p["wall"]["id"] = id, p)),
		"removeWall":       ep<[number],                            undefined>  ("maps.removeWall",       [""],                       isUndefined,   "waitWallRemoved"),
		"modifyWall":       ep<[Wall],                              undefined>  ("maps.modifyWall",       [""],                       isUndefined,   "waitWallModified"),
		"moveWall":         ep<[number, string],                    undefined>  ("maps.moveWall",         ["id", "path"],             isUndefined,   "waitWallMoved"),

		"musicPackList":        ep<[],                       MusicPack[]>("music.list",           [],                        isMusicPacks),
		"musicPackAdd":         ep<[string],                 IDName>     ("music.new",            [""],                      isIDName,    "waitMusicPackAdd"),
		"musicPackRename":      ep<[number, string],         string>     ("music.rename",         ["id", "name"],            isStr,       "waitMusicPackRename"),
		"musicPackRemove":      ep<[number],                 undefined>  ("music.remove",         [""],                      isUndefined, "waitMusicPackRemove"),
		"musicPackCopy":        ep<[number, string],         IDName>     ("music.copy",           ["id", "name"],            isIDName,    "waitMusicPackCopy", (p, name: string) => (p["name"] = name, p)),
		"musicPackSetVolumd":   ep<[number, number],         undefined>  ("music.setVolume",      ["id", "volume"],          isUndefined, "waitMusicPackVolume"),
		"musicPackPlayer":      ep<[number, number],         number>     ("music.playPack",       ["id", "playTime"],        isUint,      "waitMusicPackPlay"),
		"musicPackStop":        ep<[number],                 undefined>  ("music.stopPack",       [""],                      isUndefined, "waitMusicPackStop"),
		"musicPackStopAll":     ep<[],                       undefined>  ("music.stopAllPacks",   [],                        isUndefined, "waitMusicPackStopAll"),
		"musicPackTrackAll":    ep<[number, number[]],       undefined>  ("music.addTracks",      ["id", "tracks"],          isUndefined, "waitMusicPackTrackAdd"),
		"musicPackTrackRemove": ep<[number, number],         undefined>  ("music.removeTrack",    ["id", "track"],           isUndefined, "waitMusicPackTrackRemove"),
		"musicPackTrackVolume": ep<[number, number, number], undefined>  ("music.setTrackVolume", ["id", "track", "volume"], isUndefined, "waitMusicPackTrackVolume"),
		"musicPackTrackRepeat": ep<[number, number, number], undefined>  ("music.setTrackRepeat", ["id", "track", "repeat"], isUndefined, "waitMusicPackTrackRepeat"),

		"characterCreate": ep<[string, Keystore],           IDPath>   ("character.create", ["path", "data"],              isIDPath), // waitCharacterAdded???
		"characterModify": ep<[number, Keystore, string[]], undefined>("character.modify", ["id", "setting", "removing"], isUndefined, "waitCharacterDataChange"),
		"characterGet":    ep<[number],                     Keystore> ("character.get",    [""],                          isKeystore),

		"listPlugins":   ep<[],                           Record<string, Plugin>>("plugins.list",   [],                            isPlugins),
		"enablePlugin":  ep<[string],                     undefined>             ("plugin.enable",  [""],                          isUndefined),
		"disablePlugin": ep<[string],                     undefined>             ("plugin.disable", [""],                          isUndefined),
		"pluginSetting": ep<[string, Keystore, string[]], undefined>             ("plugin.set",     ["id", "setting", "removing"], isUndefined, "waitPluginSetting"),

		"broadcastWindow": ep<[string, number, string], undefined>("broadcastWindow", ["module", "id", "contents"], isUndefined, "waitBroadcastWindow"),
		"broadcast":       ep<[Broadcast],              undefined>("broadcast",       [""],                         isUndefined, "waitBroadcast"),

		"images": folderEPs("images", broadcastImageItemAdd, broadcastImageItemMove, broadcastImageItemRemove, broadcastImageItemCopy, broadcastImageFolderAdd, broadcastImageFolderMove, broadcastImageFolderRemove),
		"audio": folderEPs("audio", broadcastAudioItemAdd, broadcastAudioItemMove, broadcastAudioItemRemove, broadcastAudioItemCopy, broadcastAudioFolderAdd, broadcastAudioFolderMove, broadcastAudioFolderRemove),
		"maps": folderEPs("maps", broadcastMapItemAdd, broadcastMapItemMove, broadcastMapItemRemove, broadcastMapItemCopy, broadcastMapFolderAdd, broadcastMapFolderMove, broadcastMapFolderRemove),
		"characters": folderEPs("characters", broadcastCharacterItemAdd, broadcastCharacterItemMove, broadcastCharacterItemRemove, broadcastCharacterItemCopy, broadcastCharacterFolderAdd, broadcastCharacterFolderMove, broadcastCharacterFolderRemove),

		"waitCurrentUserMap":       w(broadcastCurrentUserMap,       isUint,                 "waitCurrentUserMap"),
		"waitCurrentUserMapData":   w(broadcastCurrentUserMapData,   isMapData,              "waitCurrentUserMapData"),
		"waitMapDataSet":           w(broadcastMapDataSet,           isKeyData,              "waitMapDataSet"),
		"waitMapDataRemove":        w(broadcastMapDataRemove,        isStr,                  "waitMapDataRemove"),
		"waitCharacterDataChange":  w(broadcastCharacterDataChange,  isCharacterDataChange,  "waitCharacterDataChange"),
		"waitMapChange":            w(broadcastMapItemChange,        isMapDetails,           "waitMapChange"),
		"waitMapStartChange":       w(broadcastMapStartChange,       isMapStart,             "waitMapStartChange"),
		"waitLayerAdd":             w(broadcastLayerAdd,             isStr,                  "waitLayerAdd"),
		"waitLayerFolderAdd":       w(broadcastLayerFolderAdd,       isStr,                  "waitLayerFolderAdd"),
		"waitLayerMove":            w(broadcastLayerMove,            isLayerMove,            "waitLayerMove"),
		"waitLayerRename":          w(broadcastLayerRename,          isLayerRename,          "waitLayerRename"),
		"waitLayerRemove":          w(broadcastLayerRemove,          isStr,                  "waitLayerRemove"),
		"waitGridDistanceChange":   w(broadcastGridDistanceChange,   isUint,                 "waitGridDistanceChange"),
		"waitGridDiagonalChange":   w(broadcastGridDiagonalChange,   isBool,                 "waitGridDiagonalChange"),
		"waitMapLightChange":       w(broadcastMapLightChange,       isColour,               "waitMapLightChange"),
		"waitLayerShow":            w(broadcastLayerShow,            isStr,                  "waitLayerShow"),
		"waitLayerHide":            w(broadcastLayerHide,            isStr,                  "waitLayerHide"),
		"waitLayerLock":            w(broadcastLayerLock,            isStr,                  "waitLayerLock"),
		"waitLayerUnlock":          w(broadcastLayerUnlock,          isStr,                  "waitLayerUnlock"),
		"waitMaskAdd":              w(broadcastMaskAdd,              isMask,                 "waitMaskAdd"),
		"waitMaskRemove":           w(broadcastMaskRemove,           isUint,                 "waitMaskRemove"),
		"waitMaskSet":              w(broadcastMaskSet,              isMaskSet,              "waitMaskSet"),
		"waitTokenAdd":             w(broadcastTokenAdd,             isTokenAdd,             "waitTokenAdd"),
		"waitTokenRemove":          w(broadcastTokenRemove,          isUint,                 "waitTokenRemove"),
		"waitTokenMoveLayerPos":    w(broadcastTokenMoveLayerPos,    isTokenMoveLayerPos,    "waitTokenMoveLayerPos"),
		"waitTokenSet":             w(broadcastTokenSet,             isTokenSet,             "waitTokenSet"),
		"waitTokenSetMulti":        w(broadcastTokenSetMulti,        Arr(isTokenSet),        "waitTokenSetMulti"),
		"waitLayerShift":           w(broadcastLayerShift,           isLayerShift,           "waitLayerShift"),
		"waitWallAdded":            w(broadcastWallAdd,              isWallPath,             "waitWallAdded"),
		"waitWallRemoved":          w(broadcastWallRemove,           isUint,                 "waitWallRemoved"),
		"waitWallModified":         w(broadcastWallModify,           isWall,                 "waitWallModified"),
		"waitWallMoved":            w(broadcastWallMoveLayer,        isIDPath,               "waitWallMoved"),
		"waitMusicPackAdd":         w(broadcastMusicPackAdd,         isIDName,               "waitMusicPackAdd"),
		"waitMusicPackRename":      w(broadcastMusicPackRename,      isIDName,               "waitMusicPackRename"),
		"waitMusicPackRemove":      w(broadcastMusicPackRemove,      isUint,                 "waitMusicPackRemove"),
		"waitMusicPackCopy":        w(broadcastMusicPackCopy,        isCopy,                 "waitMusicPackCopy"),
		"waitMusicPackVolume":      w(broadcastMusicPackVolume,      isMusicPackVolume,      "waitMusicPackVolume"),
		"waitMusicPackPlay":        w(broadcastMusicPackPlay,        isMusicPackPlay,        "waitMusicPackPlay"),
		"waitMusicPackStop":        w(broadcastMusicPackStop,        isUint,                 "waitMusicPackStop"),
		"waitMusicPackStopAll":     w(broadcastMusicPackStopAll,     isUndefined,            "waitMusicPackStopAll"),
		"waitMusicPackTrackAdd":    w(broadcastMusicPackTrackAdd,    isMusicPackTrackAdd,    "waitMusicPackTrackAdd"),
		"waitMusicPackTrackRemove": w(broadcastMusicPackTrackRemove, isMusicPackTrackRemove, "waitMusicPackTrackRemove"),
		"waitMusicPackTrackVolume": w(broadcastMusicPackTrackVolume, isMusicPackTrackVolume, "waitMusicPackTrackVolume"),
		"waitMusicPackTrackRepeat": w(broadcastMusicPackTrackRepeat, isMusicPackTrackRepeat, "waitMusicPackTrackRepeat"),
		"waitPluginChange":         w(broadcastPluginChange,         isUndefined,            "waitPluginChange"),
		"waitPluginSetting":        w(broadcastPluginSettingChange,  isPluginDataChange,     "waitPluginSetting"),
		"waitSignalMeasure":        w(broadcastSignalMeasure,        isSignalMeasure,        "waitSignalMeasure"),
		"waitSignalPosition":       w(broadcastSignalPosition,       isSignalPosition,       "waitSignalPosition"),
		"waitSignalMovePosition":   w(broadcastSignalMovePosition,   isSignalPosition,       "waitSignalMovePosition"),
		"waitBroadcastWindow":      w(broadcastWindow,               isBroadcastWindow,      "waitBroadcastWindow"),
		"waitBroadcast":            w(broadcastAny,                  isBroadcast,            "waitBroadcast")
	      };

	return [Object.freeze(rpc), Object.freeze(internal as {[K in keyof InternalWaiters]: InternalWaiters[K]}), Object.freeze(combined as {[K in keyof InternalWaiters]: InternalWaiters[K]})] as const;
})(),
inited = pageLoad.then(() => WS("/socket").then(ws => {
	arpc.reconnect(ws);

	arpc.await(-999).catch(handleError);

	return arpc.await(broadcastIsAdmin, isUint).then(userLevel => {
		isAdmin = userLevel === 2;
		isUser = userLevel === 1;

		return arpc.request("conn.currentTime", (t: any): t is number => isUint(t));
	}).then(t => {
		timeShift = t - Date.now() / 1000;
	});
})).catch(handleError);
