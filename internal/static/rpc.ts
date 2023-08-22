import type {Broadcast, FolderItems, GridDetails, IDName, IDPath, Keystore, KeystoreData, LayerRename, MapData, MapStart, Mask, MusicPack, NewMap, Plugin, Token, TokenSet, Wall} from './types.js';
import type {Binding} from './lib/bind.js';
import type {TypeGuard} from './lib/typeguard.js';
import {WS} from './lib/conn.js';
import {Subscription} from './lib/inter.js';
import pageLoad from './lib/load.js';
import {queue} from './lib/misc.js';
import {RPC} from './lib/rpc.js';
import {Arr, Rec, Undefined} from './lib/typeguard.js';
import {Colour} from './colours.js';
import lang from './language.js';
import {isFolderItems, isIDName, isIDPath, isKeystore, isLayerRename, isMapData, isMusicPack, isPlugin, isStr, isUint} from './types.js';
import {shell} from './windows.js';

const broadcastIsAdmin = -1, broadcastCurrentUserMap = -2, broadcastCurrentUserMapData = -3, broadcastMapDataSet = -4, broadcastMapDataRemove = -5, broadcastMapStartChange = -6, broadcastImageItemAdd = -7, broadcastAudioItemAdd = -8, broadcastCharacterItemAdd = -9, broadcastMapItemAdd = -10, broadcastImageItemMove = -11, broadcastAudioItemMove = -12, broadcastCharacterItemMove = -13, broadcastMapItemMove = -14, broadcastImageItemRemove = -15, broadcastAudioItemRemove = -16, broadcastCharacterItemRemove = -17, broadcastMapItemRemove = -18, broadcastImageItemCopy = -19, broadcastAudioItemCopy = -20, broadcastCharacterItemCopy = -21, broadcastMapItemCopy = -22, broadcastImageFolderAdd = -23, broadcastAudioFolderAdd = -24, broadcastCharacterFolderAdd = -25, broadcastMapFolderAdd = -26, broadcastImageFolderMove = -27, broadcastAudioFolderMove = -28, broadcastCharacterFolderMove = -29, broadcastMapFolderMove = -30, broadcastImageFolderRemove = -31, broadcastAudioFolderRemove = -32, broadcastCharacterFolderRemove = -33, broadcastMapFolderRemove = -34, broadcastMapItemChange = -35, broadcastCharacterDataChange = -36, broadcastLayerAdd = -37, broadcastLayerFolderAdd = -38, broadcastLayerMove = -39, broadcastLayerRename = -40, broadcastLayerRemove = -41, broadcastGridDistanceChange = -42, broadcastGridDiagonalChange = -43, broadcastMapLightChange = -44, broadcastLayerShow = -45, broadcastLayerHide = -46, broadcastLayerLock = -47, broadcastLayerUnlock = -48, broadcastMaskAdd = -49, broadcastMaskRemove = -50, broadcastMaskSet = -51, broadcastTokenAdd = -52, broadcastTokenRemove = -53, broadcastTokenMoveLayerPos = -54, broadcastTokenSet = -55, broadcastTokenSetMulti = -56, broadcastLayerShift = -57, broadcastWallAdd = -58, broadcastWallRemove = -59, broadcastWallModify = -60, broadcastWallMoveLayer = -61, broadcastMusicPackAdd = -62, broadcastMusicPackRename = -63, broadcastMusicPackRemove = -64, broadcastMusicPackCopy = -65, broadcastMusicPackVolume = -66, broadcastMusicPackPlay = -67, broadcastMusicPackStop = -68, broadcastMusicPackStopAll = -69, broadcastMusicPackTrackAdd = -70, broadcastMusicPackTrackRemove = -71, broadcastMusicPackTrackVolume = -72, broadcastMusicPackTrackRepeat = -73, broadcastPluginChange = -74, broadcastPluginSettingChange = -75, broadcastWindow = -76, broadcastSignalMeasure = -77, broadcastSignalPosition = -78, broadcastSignalMovePosition = -79, broadcastAny = -80;

type ArgTuple<N extends Number, U extends string[] = []> = U["length"] extends N ? U : ArgTuple<N, [string, ...U]>;

type EndPointsOf<T extends readonly [string, string, string[], TypeGuard<any>, string?, number?, ...any][]> = {[K in keyof T as K extends number ? T[K][0] extends "" ? never : T[K][0] : never]: T[K] extends [string, string, string[], TypeGuard<infer U>, string?, number?, ...(infer V)] ? (...v: V) => Promise<U> : never}

const mapDataCheckers: ((data: Record<string, any>) => void)[] = [],
      tokenDataCheckers: ((data: Record<string, KeystoreData>) => void)[] = [],
      characterDataCheckers: ((data: Record<string, KeystoreData>) => void)[] = [],
      isUndefined = Undefined(),
      isMusicPacks = Arr(isMusicPack),
      isPlugins = Rec(isStr, isPlugin),
      ep = <const Args extends any[], T extends any, const ArgNames extends ArgTuple<Args["length"]> = ArgTuple<Args["length"]>>(name: string, endpoint: string, args: ArgNames, typeguard: TypeGuard<T>, waiter?: string, broadcastID?: number): [string, string, string[], TypeGuard<T>, string | undefined, number | undefined, ...Args[]] => [name, endpoint, args, typeguard, waiter, broadcastID],
      endpointWaiters = [
	ep<[], undefined>      ("ready",         "conn.ready",         [],   isUndefined),
	ep<[number], undefined>("setCurrentMap", "maps.setCurrentMap", [""], isUndefined),
	ep<[],       number>   ("getUserMap",    "maps.getUserMap",    [],   isUint),
	ep<[number], undefined>("setUserMap",    "maps.setUserMap",    [""], isUndefined, "waitCurrentUserMap",     broadcastCurrentUserMap),
	ep<[number], MapData>  ("getMapData",    "maps.getMapData",    [""], isMapData,   "waitCurrentUserMapData", broadcastCurrentUserMapData),

	ep<[NewMap],      IDName>   ("newMap",          "maps.new",             [""],            isIDName),
	ep<[GridDetails], undefined>("setMapDetails",   "maps.setMapDetails",   [""],            isUndefined, "waitMapChange",          broadcastMapItemChange),
	ep<[MapStart],    undefined>("setMapStart",     "maps.setStartMap",     [""],            isUndefined, "waitMapStartChange",     broadcastMapStartChange),
	ep<[number],      undefined>("setGridDistance", "maps.setGridDistance", [""],            isUndefined, "waitGridDistanceChange", broadcastGridDistanceChange),
	ep<[boolean],     undefined>("setGridDiagonal", "maps.setGridDiagonal", [""],            isUndefined, "waitGridDiagonalChange", broadcastGridDiagonalChange),
	ep<[Colour],      undefined>("setLightColour",  "maps.setLightcolour",  [""],            isUndefined, "waitMapLightChange",     broadcastMapLightChange),
	ep<[string, any], undefined>("setMapKeyData",   "maps.setData",         ["key", "data"], isUndefined, "waitMapDataSet",         broadcastMapDataSet),
	ep<[string],      undefined>("removeMapKeyData", "maps.removeData",     [""],            isUndefined, "waitMapDataRemove",      broadcastMapDataRemove),

	ep<[[number, number, number, number, ...number[]] | null], undefined>("signalMeasure",      "maps.signalMeasure",      [""], isUndefined, "waitSignalMeasure",      broadcastSignalMeasure),
	ep<[[number, number]],                                     undefined>("signalPosition",     "maps.signalPosition",     [""], isUndefined, "waitSignalPosition",     broadcastSignalPosition),
	ep<[[number, number]],                                     undefined>("signalMovePosition", "maps.signalMovePosition", [""], isUndefined, "waitSignalMovePosition", broadcastSignalMovePosition),

	ep<[string],                            string>     ("addLayer",         "maps.addLayer",         [""],                       isStr,         "waitLayerAdd",          broadcastLayerAdd),
	ep<[string],                            string>     ("addLayerFolder",   "maps.addLayerFolder",   [""],                       isStr,         "waitLayerFolderAdd",    broadcastLayerFolderAdd),
	ep<[string, string],                    LayerRename>("renameLayer",      "maps.renameLayer",      ["path", "name"],           isLayerRename, "waitLayerRename",       broadcastLayerRename),
	ep<[string, string, number],            undefined>  ("moveLayer",        "maps.moveLayer",        ["from", "to", "position"], isUndefined,   "waitLayerMove",         broadcastLayerMove),
	ep<[string],                            undefined>  ("showLayer",        "maps.showLayer",        [""],                       isUndefined,   "waitLayerShow",         broadcastLayerShow),
	ep<[string],                            undefined>  ("hideLayer",        "maps.hideLayer",        [""],                       isUndefined,   "waitLayerHide",         broadcastLayerHide),
	ep<[string],                            undefined>  ("lockLayer",        "maps.lockLayer",        [""],                       isUndefined,   "waitLayerLock",         broadcastLayerLock),
	ep<[string],                            undefined>  ("unlockLayer",      "maps.unlockLayer",      [""],                       isUndefined,   "waitLayerUnlock",       broadcastLayerUnlock),
	ep<[string],                            undefined>  ("removeLayer",      "maps.removeLayer",      [""],                       isUndefined,   "waitLayerRemove",       broadcastLayerRemove),
	ep<[Mask],                              undefined>  ("addToMask",        "maps.addToMask",        [""],                       isUndefined,   "waitMaskAdd",           broadcastMaskAdd),
	ep<[number],                            undefined>  ("removeFromMask",   "maps.removeFromMask",   [""],                       isUndefined,   "waitMaskRemove",        broadcastMaskRemove),
	ep<[boolean, Mask[]],                   undefined>  ("setMask",          "maps.setMask",          ["baseOpaque", "masks"],    isUndefined,   "waitMaskSet",           broadcastMaskSet),
	ep<[string, Token, number | undefined], number>     ("addToken",         "maps.addToken",         ["path", "token", "pos"],   isUint,        "waitTokenAdd",          broadcastTokenAdd),
	ep<[number],                            undefined>  ("removeToken",      "maps.removeToken",      [""],                       isUndefined,   "waitTokenRemove",       broadcastTokenRemove),
	ep<[TokenSet],                          undefined>  ("setToken",         "maps.setToken",         [""],                       isUndefined,   "waitTokenSet",          broadcastTokenSet),
	ep<[TokenSet[]],                        undefined>  ("setTokenMulti",    "maps.setTokenMulti",    [""],                       isUndefined,   "waitTokenMultiSet",     broadcastTokenSetMulti),
	ep<[number, string, number],            undefined>  ("setTokenLayerPos", "maps.setTokenLayerPos", ["id", "to", "newPos"],     isUndefined,   "waitTokenMoveLayerPos", broadcastTokenMoveLayerPos),
	ep<[string, number, number],            undefined>  ("shiftLayer",       "maps.shiftLayer",       ["path", "dx", "dy"],       isUndefined,   "waitLayerShift",        broadcastLayerShift),
	ep<[string, Wall],                      number>     ("addWall",          "maps.addWall",          ["id", "wall"],             isUint,        "waitWallAdded",         broadcastWallAdd),
	ep<[number],                            undefined>  ("removeWall",       "maps.removeWall",       [""],                       isUndefined,   "waitWallRemoved",       broadcastWallRemove),
	ep<[Wall],                              undefined>  ("modifyWall",       "maps.modifyWall",       [""],                       isUndefined,   "waitWallModified",      broadcastWallModify),
	ep<[number, string],                    undefined>  ("moveWall",         "maps.moveWall",         ["id", "path"],             isUndefined,   "waitWallMoved",         broadcastWallMoveLayer),

	ep<[],                       MusicPack[]>("musicPackList",        "music.list",           [],                        isMusicPacks),
	ep<[string],                 IDName>     ("musicPackAdd",         "music.new",            [""],                      isIDName,    "waitMusicPackAdd",         broadcastMusicPackAdd),
	ep<[number, string],         string>     ("musicPackRename",      "music.rename",         ["id", "name"],            isStr,       "waitMusicPackRename",      broadcastMusicPackRename),
	ep<[number],                 undefined>  ("musicPackRemove",      "music.remove",         [""],                      isUndefined, "waitMusicPackRemove",      broadcastMusicPackRemove),
	ep<[number, string],         IDName>     ("musicPackCopy",        "music.copy",           ["id", "name"],            isIDName,    "waitMusicPackCopy",        broadcastMusicPackCopy),
	ep<[number, number],         undefined>  ("musicPackSetVolume",   "music.setVolume",      ["id", "volume"],          isUndefined, "waitMusicPackVolume",      broadcastMusicPackVolume),
	ep<[number, number],         number>     ("musicPackPlay",        "music.playPack",       ["id", "playTime"],        isUint,      "waitMusicPackPlay",        broadcastMusicPackPlay),
	ep<[number],                 undefined>  ("musicPackStop",        "music.stopPack",       [""],                      isUndefined, "waitMusicPackStop",        broadcastMusicPackStop),
	ep<[],                       undefined>  ("musicPackStopAll",     "music.stopAllPacks",   [],                        isUndefined, "waitMusicPackStopAll",     broadcastMusicPackStopAll),
	ep<[number, number[]],       undefined>  ("musicPackTrackAdd",    "music.addTracks",      ["id", "tracks"],          isUndefined, "waitMusicPackTrackAdd",    broadcastMusicPackTrackAdd),
	ep<[number, number],         undefined>  ("musicPackTrackRemove", "music.removeTrack",    ["id", "track"],           isUndefined, "waitMusicPackTrackRemove", broadcastMusicPackTrackRemove),
	ep<[number, number, number], undefined>  ("musicPackTrackVolume", "music.setTrackVolume", ["id", "track", "volume"], isUndefined, "waitMusicPackTrackVolume", broadcastMusicPackTrackVolume),
	ep<[number, number, number], undefined>  ("musicPackTrackRepeat", "music.setTrackRepeat", ["id", "track", "repeat"], isUndefined, "waitMusicPackTrackRepeat", broadcastMusicPackTrackRepeat),

	ep<[string, Keystore],           IDPath>   ("characterCreate", "character.create", ["path", "data"],              isIDPath), // waitCharacterAdded???
	ep<[number, Keystore, string[]], undefined>("characterModify", "character.modify", ["id", "setting", "removing"], isUndefined, "waitCharacterDataChange", broadcastCharacterDataChange),
	ep<[number],                     Keystore> ("characterGet",    "character.get",    [""],                          isKeystore),

	ep<[],                           Record<string, Plugin>>("listPlugins",   "plugins.list",   [],   isPlugins),
	ep<[string],                     undefined>             ("enablePlugin",  "plugin.enable",  [""], isUndefined),
	ep<[string],                     undefined>             ("disablePlugin", "plugin.disable", [""], isUndefined),
	ep<[string, Keystore, string[]], undefined>             ("pluginSetting", "plugin.set",     ["id", "setting", "removing"], isUndefined, "waitPluginSetting", broadcastPluginSettingChange),

	ep<[string, number, string], undefined>("broadcastWindow", "broadcastWindow", ["module", "id", "contents"], isUndefined, "waitBroadcastWindow", broadcastWindow),
	ep<[Broadcast],              undefined>("broadcast",       "broadcast",       [""],                         isUndefined, "waitBroadcast",       broadcastAny)
      ] as const,
      folderWaits = (prefix: string, added: number, moved: number, removed: number, copied: number, folderAdded: number, folderMoved: number, folderRemove: number) => ([
	ep<[], FolderItems>            ("list",         `${prefix}.list`,         [],             isFolderItems),
	ep<[], IDName[]>               ("",             ``,                       [],             Arr(isIDName), "waitAdded",         added), 
	ep<[string], string>           ("createFolder", `${prefix}.createFolder`, [""],           isStr,         "waitFolderAdded",   folderAdded),
	ep<[string, string], string>   ("move",         `${prefix}.move`,         ["from", "to"], isStr,         "waitMoved",         moved),
	ep<[string, string], string>   ("moveFolder",   `${prefix}.moveFolder`,   ["from", "to"], isStr,         "waitFolderMoved",   folderMoved),
	ep<[string],         undefined>("remove",       `${prefix}.remove`,       [""],           isUndefined,   "waitRemoved",       removed),
	ep<[string],         undefined>("removeFolder", `${prefix}.removeFolder`, [""],           isUndefined,   "waitFolderRemoved", folderRemove),
	ep<[number, string], IDPath>   ("copy",         `${prefix}.copy`,         ["id", "path"], isIDPath,      "waitCopied",        copied)
      ] as const),
      images = folderWaits("images", broadcastImageItemAdd, broadcastImageItemMove, broadcastImageItemRemove, broadcastImageItemCopy, broadcastImageFolderAdd, broadcastImageFolderMove, broadcastImageFolderRemove),
      audio = folderWaits("audio", broadcastAudioItemAdd, broadcastAudioItemMove, broadcastAudioItemRemove, broadcastAudioItemCopy, broadcastAudioFolderAdd, broadcastAudioFolderMove, broadcastAudioFolderRemove),
      characters = folderWaits("characters", broadcastCharacterItemAdd, broadcastCharacterItemMove, broadcastCharacterItemRemove, broadcastCharacterItemCopy, broadcastCharacterFolderAdd, broadcastCharacterFolderMove, broadcastCharacterFolderRemove),
      maps = folderWaits("maps", broadcastMapItemAdd, broadcastMapItemMove, broadcastMapItemRemove, broadcastMapItemCopy, broadcastMapFolderAdd, broadcastMapFolderMove, broadcastMapFolderRemove),
      arpc = new RPC(),
      genEPWaits = <const Params extends readonly any[], const T extends readonly [string, string, string[], TypeGuard<any>, string?, number?, ...Params][]>(eps: T) => {
	const rpc = {} as EndPointsOf<T>;

	for (const [name, ep, params, tg, wait, broadcast] of eps) {
		if (params.length === 0) {
			rpc[name] = () => arpc.request(ep, tg);
		} else if (params.length === 1 && params[0] === "") {
			rpc[name] = (p: Params[0]) => arpc.request(ep, {[params[0]]: p}, tg);
		} else {
			rpc[name] = (...ps: Params) => {
				const args: Record<string, any> = {};

				for (let i = 0; i < ps.length; i++) {
					args[params[i]] = ps[i];
				}

				arpc.request(ep, args, tg)
			};
		}
	}

	return rpc;
      };

export let isAdmin: boolean,
isUser: boolean,
timeShift = 0;

export const addMapDataChecker = (fn: (data: Record<string, any>) => void) => mapDataCheckers.push(fn),
addCharacterDataChecker = (fn: (data: Record<string, KeystoreData>) => void) => characterDataCheckers.push(fn),
addTokenDataChecker = (fn: (data: Record<string, KeystoreData>) => void) => tokenDataCheckers.push(fn),
handleError = (e: Error | string | Binding) => {
	console.log(e);
	shell.alert(lang["ERROR"], (e instanceof Error ? e.message : Object.getPrototypeOf(e) === Object.prototype ? JSON.stringify(e): e.toString()) || lang["ERROR_UNKNOWN"]);
},
[rpc, internal, combined] = (() => {

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
