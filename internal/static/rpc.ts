import type {Broadcast, FolderItems, GridDetails, IDName, IDPath, Keystore, KeystoreData, LayerRename, MapData, MapStart, Mask, MusicPack, NewMap, Plugin, Token, TokenSet, Wall} from './types.js';
import type {Binding} from './lib/bind.js';
import type {TypeGuard} from './lib/typeguard.js';
import {WS} from './lib/conn.js';
import {Subscription} from './lib/inter.js';
import pageLoad from './lib/load.js';
import {queue} from './lib/misc.js';
import {RPC} from './lib/rpc.js';
import {And, Arr, Obj, Rec, Tuple, Undefined} from './lib/typeguard.js';
import {Colour, isColour} from './colours.js';
import lang from './language.js';
import {isBool, isBroadcast, isBroadcastWindow, isCharacterDataChange, isFolderItems, isFromTo, isIDName, isIDPath, isKeyData, isKeystore, isLayerMove, isLayerRename, isLayerShift, isMapData, isMapDetails, isMapStart, isMask, isMaskSet, isMusicPack, isMusicPackPlay, isMusicPackTrackAdd, isMusicPackTrackRemove, isMusicPackTrackRepeat, isMusicPackTrackVolume, isMusicPackVolume, isPlugin, isPluginDataChange, isStr, isTokenAdd, isTokenMoveLayerPos, isTokenSet, isUint, isWall, isWallPath} from './types.js';
import {shell} from './windows.js';

const broadcastIsAdmin = -1, broadcastCurrentUserMap = -2, broadcastCurrentUserMapData = -3, broadcastMapDataSet = -4, broadcastMapDataRemove = -5, broadcastMapStartChange = -6, broadcastImageItemAdd = -7, broadcastAudioItemAdd = -8, broadcastCharacterItemAdd = -9, broadcastMapItemAdd = -10, broadcastImageItemMove = -11, broadcastAudioItemMove = -12, broadcastCharacterItemMove = -13, broadcastMapItemMove = -14, broadcastImageItemRemove = -15, broadcastAudioItemRemove = -16, broadcastCharacterItemRemove = -17, broadcastMapItemRemove = -18, broadcastImageItemCopy = -19, broadcastAudioItemCopy = -20, broadcastCharacterItemCopy = -21, broadcastMapItemCopy = -22, broadcastImageFolderAdd = -23, broadcastAudioFolderAdd = -24, broadcastCharacterFolderAdd = -25, broadcastMapFolderAdd = -26, broadcastImageFolderMove = -27, broadcastAudioFolderMove = -28, broadcastCharacterFolderMove = -29, broadcastMapFolderMove = -30, broadcastImageFolderRemove = -31, broadcastAudioFolderRemove = -32, broadcastCharacterFolderRemove = -33, broadcastMapFolderRemove = -34, broadcastMapItemChange = -35, broadcastCharacterDataChange = -36, broadcastLayerAdd = -37, broadcastLayerFolderAdd = -38, broadcastLayerMove = -39, broadcastLayerRename = -40, broadcastLayerRemove = -41, broadcastGridDistanceChange = -42, broadcastGridDiagonalChange = -43, broadcastMapLightChange = -44, broadcastLayerShow = -45, broadcastLayerHide = -46, broadcastLayerLock = -47, broadcastLayerUnlock = -48, broadcastMaskAdd = -49, broadcastMaskRemove = -50, broadcastMaskSet = -51, broadcastTokenAdd = -52, broadcastTokenRemove = -53, broadcastTokenMoveLayerPos = -54, broadcastTokenSet = -55, broadcastTokenSetMulti = -56, broadcastLayerShift = -57, broadcastWallAdd = -58, broadcastWallRemove = -59, broadcastWallModify = -60, broadcastWallMoveLayer = -61, broadcastMusicPackAdd = -62, broadcastMusicPackRename = -63, broadcastMusicPackRemove = -64, broadcastMusicPackCopy = -65, broadcastMusicPackVolume = -66, broadcastMusicPackPlay = -67, broadcastMusicPackStop = -68, broadcastMusicPackStopAll = -69, broadcastMusicPackTrackAdd = -70, broadcastMusicPackTrackRemove = -71, broadcastMusicPackTrackVolume = -72, broadcastMusicPackTrackRepeat = -73, broadcastPluginChange = -74, broadcastPluginSettingChange = -75, broadcastWindow = -76, broadcastSignalMeasure = -77, broadcastSignalPosition = -78, broadcastSignalMovePosition = -79, broadcastAny = -80;

type ArgTuple<N extends Number, U extends string[] = []> = U["length"] extends N ? U : ArgTuple<N, [string, ...U]>;

const mapDataCheckers: ((data: Record<string, any>) => void)[] = [],
      tokenDataCheckers: ((data: Record<string, KeystoreData>) => void)[] = [],
      characterDataCheckers: ((data: Record<string, KeystoreData>) => void)[] = [],
      isUndefined = Undefined(),
      isMusicPacks = Arr(isMusicPack),
      isPlugins = Rec(isStr, isPlugin),
      isCopy = And(isIDName, Obj({"newID": isUint})),
      isCopied = Obj({"oldID": isUint, "newID": isUint, "path": isStr}),
      isSignalMeasure = Tuple(isUint, isUint, isUint, isUint, ...isUint),
      isSignalPosition = Tuple(isUint, isUint),
      arpc = new RPC(),
      ep = <const Args extends any[], T extends any, const ArgNames extends string[] = ArgTuple<Args["length"]>>(endpoint: string, args: ArgNames, typeguard: TypeGuard<T>) => (...params: Args) => arpc.request(endpoint, args.length === 0 ? undefined : args.length === 1 && args[0] === "" ? args[0] : params.reduce((o, v, n) => o[args[n]] = v, {}), typeguard.throws()),
      w = <const T>(id: number, typeguard: TypeGuard<T>) => () => arpc.subscribe(id, typeguard.throws()),
      folderEPs = (prefix: string, added: number, moved: number, removed: number, copied: number, folderAdded: number, folderMoved: number, folderRemove: number) => Object.freeze({
	"list":         ep<[], FolderItems>            (`${prefix}.list`,         [],             isFolderItems),
	"createFolder": ep<[string], string>           (`${prefix}.createFolder`, [""],           isStr),
	"move":         ep<[string, string], string>   (`${prefix}.move`,         ["from", "to"], isStr),
	"moveFolder":   ep<[string, string], string>   (`${prefix}.moveFolder`,   ["from", "to"], isStr),
	"remove":       ep<[string],         undefined>(`${prefix}.remove`,       [""],           isUndefined),
	"removeFolder": ep<[string],         undefined>(`${prefix}.removeFolder`, [""],           isUndefined),
	"copy":         ep<[number, string], IDPath>   (`${prefix}.copy`,         ["id", "path"], isIDPath),

	"waitAdded":         w(added,         Arr(isIDName)),
	"waitMoved":         w(moved,         isFromTo),
	"waitRemoved":       w(removed,       isStr),
	"waitCopied":        w(copied,        isCopied),
	"waitFolderAdded":   w(folderAdded,   isStr),
	"waitFolderMoved":   w(folderMoved,   isFromTo),
	"waitFolderRemoved": w(folderRemove,  isStr)
      });

export let isAdmin: boolean,
isUser: boolean,
timeShift = 0;

type WaitersOf<T> = {[K in keyof T as K extends `wait${string}` ? K : never]: T[K]}

type FolderWaiters = WaitersOf<typeof rpc["images"]>;

type InternalWaiters = WaitersOf<typeof rpc> & {
	images: {[K in keyof FolderWaiters]: FolderWaiters[K]};
	audio: {[K in keyof FolderWaiters]: FolderWaiters[K]};
	characters: {[K in keyof FolderWaiters]: FolderWaiters[K]};
	maps: {[K in keyof FolderWaiters]: FolderWaiters[K]};
}

export const addMapDataChecker = (fn: (data: Record<string, any>) => void) => mapDataCheckers.push(fn),
addCharacterDataChecker = (fn: (data: Record<string, KeystoreData>) => void) => characterDataCheckers.push(fn),
addTokenDataChecker = (fn: (data: Record<string, KeystoreData>) => void) => tokenDataCheckers.push(fn),
handleError = (e: Error | string | Binding) => {
	console.log(e);
	shell.alert(lang["ERROR"], (e instanceof Error ? e.message : Object.getPrototypeOf(e) === Object.prototype ? JSON.stringify(e): e.toString()) || lang["ERROR_UNKNOWN"]);
},
internal: {[K in keyof InternalWaiters]: InternalWaiters[K]} = {},
combined: {[K in keyof InternalWaiters]: InternalWaiters[K]} = {},
rpc = Object.freeze({
	"ready": ep<[], undefined>("conn.ready", [], isUndefined),

	"setCurrentMap": ep<[number], undefined>("maps.setCurrentMap", [""], isUndefined),
	"getUserMap":    ep<[],       number>   ("maps.getUserMap",    [],   isUint),
	"setUserMap":    ep<[number], undefined>("maps.setUserMap",    [""], isUndefined),
	"getMapData":    ep<[number], MapData>  ("maps.getMapData",    [""], isMapData),

	"newMap":           ep<[NewMap],      IDName>   ("maps.new",             [""],            isIDName),
	"setMapDetails":    ep<[GridDetails], undefined>("maps.setMapDetails",   [""],            isUndefined),
	"setMapStart":      ep<[MapStart],    undefined>("maps.setStartMap",     [""],            isUndefined),
	"setGridDistance":  ep<[number],      undefined>("maps.setGridDistance", [""],            isUndefined),
	"setGridDiagonal":  ep<[boolean],     undefined>("maps.setGridDiagonal", [""],            isUndefined),
	"setLightColour":   ep<[Colour],      undefined>("maps.setLightcolour",  [""],            isUndefined),
	"setMapKeyData":    ep<[string, any], undefined>("maps.setData",         ["key", "data"], isUndefined),
	"removeMapKeyData": ep<[string],      undefined>("maps.removeData",      [""],            isUndefined),

	"signalMeasure":      ep<[[number, number, number, number, ...number[]] | null], undefined>("maps.signalMeasure",      [""], isUndefined),
	"signalPosition":     ep<[[number, number]],                                     undefined>("maps.signalPosition",     [""], isUndefined),
	"signalMovePosition": ep<[[number, number]],                                     undefined>("maps.signalMovePosition", [""], isUndefined),

	"addLayer":         ep<[string],                            string>     ("maps.addLayer",         [""],                       isStr),
	"addLayerFolder":   ep<[string],                            string>     ("maps.addLayerFolder",   [""],                       isStr),
	"renameLayer":      ep<[string, string],                    LayerRename>("maps.renameLayer",      ["path", "name"],           isLayerRename),
	"moveLayer":        ep<[string, string, number],            undefined>  ("maps.moveLayer",        ["from", "to", "position"], isUndefined),
	"showLayer":        ep<[string],                            undefined>  ("maps.showLayer",        [""],                       isUndefined),
	"hideLayer":        ep<[string],                            undefined>  ("maps.hideLayer",        [""],                       isUndefined),
	"lockLayer":        ep<[string],                            undefined>  ("maps.lockLayer",        [""],                       isUndefined),
	"unlockLayer":      ep<[string],                            undefined>  ("maps.unlockLayer",      [""],                       isUndefined),
	"removeLayer":      ep<[string],                            undefined>  ("maps.removeLayer",      [""],                       isUndefined),
	"addToMask":        ep<[Mask],                              undefined>  ("maps.addToMask",        [""],                       isUndefined),
	"removeFromMask":   ep<[number],                            undefined>  ("maps.removeFromMask",   [""],                       isUndefined),
	"setMask":          ep<[boolean, Mask[]],                   undefined>  ("maps.setMask",          ["baseOpaque", "masks"],    isUndefined),
	"addToken":         ep<[string, Token, number | undefined], number>     ("maps.addToken",         ["path", "token", "pos"],   isUint),
	"removeToken":      ep<[number],                            undefined>  ("maps.removeToken",      [""],                       isUndefined),
	"setToken":         ep<[TokenSet],                          undefined>  ("maps.setToken",         [""],                       isUndefined),
	"setTokenMulti":    ep<[TokenSet[]],                        undefined>  ("maps.setTokenMulti",    [""],                       isUndefined),
	"setTokenLayerPos": ep<[number, string, number],            undefined>  ("maps.setTokenLayerPos", ["id", "to", "newPos"],     isUndefined),
	"shiftLayer":       ep<[string, number, number],            undefined>  ("maps.shiftLayer",       ["path", "dx", "dy"],       isUndefined),
	"addWall":          ep<[string, Wall],                      number>     ("maps.addWall",          ["id", "wall"],             isUint),
	"removeWall":       ep<[number],                            undefined>  ("maps.removeWall",       [""],                       isUndefined),
	"modifyWall":       ep<[Wall],                              undefined>  ("maps.modifyWall",       [""],                       isUndefined),
	"moveWall":         ep<[number, string],                    undefined>  ("maps.moveWall",         ["id", "path"],             isUndefined),

	"musicPackList":        ep<[],                       MusicPack[]>("music.list",           [],                        isMusicPacks),
	"musicPackAdd":         ep<[string],                 IDName>     ("music.new",            [""],                      isIDName),
	"musicPackRename":      ep<[number, string],         string>     ("music.rename",         ["id", "name"],            isStr),
	"musicPackRemove":      ep<[number],                 undefined>  ("music.remove",         [""],                      isUndefined),
	"musicPackCopy":        ep<[number, string],         IDName>     ("music.copy",           ["id", "name"],            isIDName),
	"musicPackSetVolumd":   ep<[number, number],         undefined>  ("music.setVolume",      ["id", "volume"],          isUndefined),
	"musicPackPlayer":      ep<[number, number],         number>     ("music.playPack",       ["id", "playTime"],        isUint),
	"musicPackStop":        ep<[number],                 undefined>  ("music.stopPack",       [""],                      isUndefined),
	"musicPackStopAll":     ep<[],                       undefined>  ("music.stopAllPacks",   [],                        isUndefined),
	"musicPackTrackAll":    ep<[number, number[]],       undefined>  ("music.addTracks",      ["id", "tracks"],          isUndefined),
	"musicPackTrackRemove": ep<[number, number],         undefined>  ("music.removeTrack",    ["id", "track"],           isUndefined),
	"musicPackTrackVolume": ep<[number, number, number], undefined>  ("music.setTrackVolume", ["id", "track", "volume"], isUndefined),
	"musicPackTrackRepeat": ep<[number, number, number], undefined>  ("music.setTrackRepeat", ["id", "track", "repeat"], isUndefined),

	"characterCreate": ep<[string, Keystore],           IDPath>   ("character.create", ["path", "data"],              isIDPath), // waitCharacterAdded???
	"characterModify": ep<[number, Keystore, string[]], undefined>("character.modify", ["id", "setting", "removing"], isUndefined),
	"characterGet":    ep<[number],                     Keystore> ("character.get",    [""],                          isKeystore),

	"listPlugins":   ep<[],                           Record<string, Plugin>>("plugins.list",   [],                            isPlugins),
	"enablePlugin":  ep<[string],                     undefined>             ("plugin.enable",  [""],                          isUndefined),
	"disablePlugin": ep<[string],                     undefined>             ("plugin.disable", [""],                          isUndefined),
	"pluginSetting": ep<[string, Keystore, string[]], undefined>             ("plugin.set",     ["id", "setting", "removing"], isUndefined),

	"broadcastWindow": ep<[string, number, string], undefined>("broadcastWindow", ["module", "id", "contents"], isUndefined),
	"broadcast":       ep<[Broadcast],              undefined>("broadcast",       [""],                         isUndefined),

	"images": folderEPs("images", broadcastImageItemAdd, broadcastImageItemMove, broadcastImageItemRemove, broadcastImageItemCopy, broadcastImageFolderAdd, broadcastImageFolderMove, broadcastImageFolderRemove),
	"audio": folderEPs("audio", broadcastAudioItemAdd, broadcastAudioItemMove, broadcastAudioItemRemove, broadcastAudioItemCopy, broadcastAudioFolderAdd, broadcastAudioFolderMove, broadcastAudioFolderRemove),
	"maps": folderEPs("maps", broadcastMapItemAdd, broadcastMapItemMove, broadcastMapItemRemove, broadcastMapItemCopy, broadcastMapFolderAdd, broadcastMapFolderMove, broadcastMapFolderRemove),
	"characters": folderEPs("characters", broadcastCharacterItemAdd, broadcastCharacterItemMove, broadcastCharacterItemRemove, broadcastCharacterItemCopy, broadcastCharacterFolderAdd, broadcastCharacterFolderMove, broadcastCharacterFolderRemove),

	"waitCurrentUserMap":       w(broadcastCurrentUserMap,       isUint),
	"waitCurrentUserMapData":   w(broadcastCurrentUserMapData,   isMapData),
	"waitMapDataSet":           w(broadcastMapDataSet,           isKeyData),
	"waitMapDataRemove":        w(broadcastMapDataRemove,        isStr),
	"waitCharacterDataChange":  w(broadcastCharacterDataChange,  isCharacterDataChange),
	"waitMapChange":            w(broadcastMapItemChange,        isMapDetails),
	"waitMapStartChange":       w(broadcastMapStartChange,       isMapStart),
	"waitLayerAdd":             w(broadcastLayerAdd,             isStr),
	"waitLayerFolderAdd":       w(broadcastLayerFolderAdd,       isStr),
	"waitLayerMove":            w(broadcastLayerMove,            isLayerMove),
	"waitLayerRename":          w(broadcastLayerRename,          isLayerRename),
	"waitLayerRemove":          w(broadcastLayerRemove,          isStr),
	"waitGridDistanceChange":   w(broadcastGridDistanceChange,   isUint),
	"waitGridDiagonalChange":   w(broadcastGridDiagonalChange,   isBool),
	"waitMapLightChange":       w(broadcastMapLightChange,       isColour),
	"waitLayerShow":            w(broadcastLayerShow,            isStr),
	"waitLayerHide":            w(broadcastLayerHide,            isStr),
	"waitLayerLock":            w(broadcastLayerLock,            isStr),
	"waitLayerUnlock":          w(broadcastLayerUnlock,          isStr),
	"waitMaskAdd":              w(broadcastMaskAdd,              isMask),
	"waitMaskRemove":           w(broadcastMaskRemove,           isUint),
	"waitMaskSet":              w(broadcastMaskSet,              isMaskSet),
	"waitTokenAdd":             w(broadcastTokenAdd,             isTokenAdd),
	"waitTokenRemove":          w(broadcastTokenRemove,          isUint),
	"waitTokenMoveLayerPos":    w(broadcastTokenMoveLayerPos,    isTokenMoveLayerPos),
	"waitTokenSet":             w(broadcastTokenSet,             isTokenSet),
	"waitTokenSetMulti":        w(broadcastTokenSetMulti,        Arr(isTokenSet)),
	"waitLayerShift":           w(broadcastLayerShift,           isLayerShift),
	"waitWallAdded":            w(broadcastWallAdd,              isWallPath),
	"waitWallRemoved":          w(broadcastWallRemove,           isUint),
	"waitWallModified":         w(broadcastWallModify,           isWall),
	"waitWallMoved":            w(broadcastWallMoveLayer,        isIDPath),
	"waitMusicPackAdd":         w(broadcastMusicPackAdd,         isIDName),
	"waitMusicPackRename":      w(broadcastMusicPackRename,      isIDName),
	"waitMusicPackRemove":      w(broadcastMusicPackRemove,      isUint),
	"waitMusicPackCopy":        w(broadcastMusicPackCopy,        isCopy),
	"waitMusicPackVolume":      w(broadcastMusicPackVolume,      isMusicPackVolume),
	"waitMusicPackPlay":        w(broadcastMusicPackPlay,        isMusicPackPlay),
	"waitMusicPackStop":        w(broadcastMusicPackStop,        isUint),
	"waitMusicPackStopAll":     w(broadcastMusicPackStopAll,     isUndefined),
	"waitMusicPackTrackAdd":    w(broadcastMusicPackTrackAdd,    isMusicPackTrackAdd),
	"waitMusicPackTrackRemove": w(broadcastMusicPackTrackRemove, isMusicPackTrackRemove),
	"waitMusicPackTrackVolume": w(broadcastMusicPackTrackVolume, isMusicPackTrackVolume),
	"waitMusicPackTrackRepeat": w(broadcastMusicPackTrackRepeat, isMusicPackTrackRepeat),
	"waitPluginChange":         w(broadcastPluginChange,         isUndefined),
	"waitPluginSetting":        w(broadcastPluginSettingChange,  isPluginDataChange),
	"waitSignalMeasure":        w(broadcastSignalMeasure,        isSignalMeasure),
	"waitSignalPosition":       w(broadcastSignalPosition,       isSignalPosition),
	"waitSignalMovePosition":   w(broadcastSignalMovePosition,   isSignalPosition),
	"waitBroadcastWindow":      w(broadcastWindow,               isBroadcastWindow),
	"waitBroadcast":            w(broadcastAny,                  isBroadcast)
}),
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
