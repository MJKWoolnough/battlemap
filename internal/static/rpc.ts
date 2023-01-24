import type {InternalWaits, KeystoreData, RPC as RPCType, Uint} from './types.js';
import type {Binding} from './lib/dom.js';
import {WS} from './lib/conn.js';
import {Subscription} from './lib/inter.js';
import pageLoad from './lib/load.js';
import {isInt, queue} from './lib/misc.js';
import {RPC} from './lib/rpc.js';
import {Colour} from './colours.js';
import lang from './language.js';
import {shell} from './windows.js';

const broadcastIsAdmin = -1, broadcastCurrentUserMap = -2, broadcastCurrentUserMapData = -3, broadcastMapDataSet = -4, broadcastMapDataRemove = -5, broadcastMapStartChange = -6, broadcastImageItemAdd = -7, broadcastAudioItemAdd = -8, broadcastCharacterItemAdd = -9, broadcastMapItemAdd = -10, broadcastImageItemMove = -11, broadcastAudioItemMove = -12, broadcastCharacterItemMove = -13, broadcastMapItemMove = -14, broadcastImageItemRemove = -15, broadcastAudioItemRemove = -16, broadcastCharacterItemRemove = -17, broadcastMapItemRemove = -18, broadcastImageItemCopy = -19, broadcastAudioItemCopy = -20, broadcastCharacterItemCopy = -21, broadcastMapItemCopy = -22, broadcastImageFolderAdd = -23, broadcastAudioFolderAdd = -24, broadcastCharacterFolderAdd = -25, broadcastMapFolderAdd = -26, broadcastImageFolderMove = -27, broadcastAudioFolderMove = -28, broadcastCharacterFolderMove = -29, broadcastMapFolderMove = -30, broadcastImageFolderRemove = -31, broadcastAudioFolderRemove = -32, broadcastCharacterFolderRemove = -33, broadcastMapFolderRemove = -34, broadcastMapItemChange = -35, broadcastCharacterDataChange = -36, broadcastLayerAdd = -37, broadcastLayerFolderAdd = -38, broadcastLayerMove = -39, broadcastLayerRename = -40, broadcastLayerRemove = -41, broadcastGridDistanceChange = -42, broadcastGridDiagonalChange = -43, broadcastMapLightChange = -44, broadcastLayerShow = -45, broadcastLayerHide = -46, broadcastLayerLock = -47, broadcastLayerUnlock = -48, broadcastMaskAdd = -49, broadcastMaskRemove = -50, broadcastMaskSet = -51, broadcastTokenAdd = -52, broadcastTokenRemove = -53, broadcastTokenMoveLayerPos = -54, broadcastTokenSet = -55, broadcastTokenSetMulti = -56, broadcastLayerShift = -57, broadcastWallAdd = -58, broadcastWallRemove = -59, broadcastWallModify = -60, broadcastWallMoveLayer = -61, broadcastMusicPackAdd = -62, broadcastMusicPackRename = -63, broadcastMusicPackRemove = -64, broadcastMusicPackCopy = -65, broadcastMusicPackVolume = -66, broadcastMusicPackPlay = -67, broadcastMusicPackStop = -68, broadcastMusicPackStopAll = -69, broadcastMusicPackTrackAdd = -70, broadcastMusicPackTrackRemove = -71, broadcastMusicPackTrackVolume = -72, broadcastMusicPackTrackRepeat = -73, broadcastPluginChange = -74, broadcastPluginSettingChange = -75, broadcastWindow = -76, broadcastSignalMeasure = -77, broadcastSignalPosition = -78, broadcastSignalMovePosition = -79, broadcastAny = -80;

export let isAdmin: boolean,
isUser: boolean,
timeShift = 0;

export const internal = {
	"images":     {},
	"audio":      {},
	"characters": {},
	"maps":       {}
} as InternalWaits,
combined = {
	"images":     {},
	"audio":      {},
	"characters": {},
	"maps":       {}
} as InternalWaits,
rpc = {
	"images":     {},
	"audio":      {},
	"characters": {},
	"maps":       {}
} as RPCType,
addMapDataChecker = (fn: (data: Record<string, any>) => void) => mapDataCheckers.push(fn),
addCharacterDataChecker = (fn: (data: Record<string, KeystoreData>) => void) => characterDataCheckers.push(fn),
addTokenDataChecker = (fn: (data: Record<string, KeystoreData>) => void) => tokenDataCheckers.push(fn),
handleError = (e: Error | string | Binding) => {
	console.log(e);
	shell.alert(lang["ERROR"], (e instanceof Error ? e.message : Object.getPrototypeOf(e) === Object.prototype ? JSON.stringify(e): e.toString()) || lang["ERROR_UNKNOWN"]);
},
inited = pageLoad.then(() => WS("/socket").then(ws => {
	const arpc = new RPC(ws),
	      argProcessors: Record<string, (args: unknown[], names: string[]) => unknown> = {
		"": () => {},
		"!": (args: unknown[]) => args[0],
		"*": (args: unknown[], names: string[]) => Object.fromEntries(names.map((key, pos) => [key, args[pos]]))
	      },
	      waiters: Record<string, [string, number, (data: any) => data is any][]> = {
		"": [
			["waitCurrentUserMap",       broadcastCurrentUserMap,       checkUint],
			["waitCurrentUserMapData",   broadcastCurrentUserMapData,   checkMapData],
			["waitMapDataSet",           broadcastMapDataSet,           checkMapKeyData],
			["waitMapDataRemove",        broadcastMapDataRemove,        checkString],
			["waitCharacterDataChange",  broadcastCharacterDataChange,  checkCharacterDataChange],
			["waitMapChange",            broadcastMapItemChange,        checkMapDetails],
			["waitMapStartChange",       broadcastMapStartChange,       checkMapStart],
			["waitLayerAdd",             broadcastLayerAdd,             checkString],
			["waitLayerFolderAdd",       broadcastLayerFolderAdd,       checkString],
			["waitLayerMove",            broadcastLayerMove,            checkLayerMove],
			["waitLayerRename",          broadcastLayerRename,          checkLayerRename],
			["waitLayerRemove",          broadcastLayerRemove,          checkString],
			["waitGridDistanceChange",   broadcastGridDistanceChange,   checkUint],
			["waitGridDiagonalChange",   broadcastGridDiagonalChange,   checkBoolean],
			["waitMapLightChange",       broadcastMapLightChange,       checkColour],
			["waitLayerShow",            broadcastLayerShow,            checkString],
			["waitLayerHide",            broadcastLayerHide,            checkString],
			["waitLayerLock",            broadcastLayerLock,            checkString],
			["waitLayerUnlock",          broadcastLayerUnlock,          checkString],
			["waitMaskAdd",              broadcastMaskAdd,              checkMask],
			["waitMaskRemove",           broadcastMaskRemove,           checkUint],
			["waitMaskSet",              broadcastMaskSet,              checkMaskSet],
			["waitTokenAdd",             broadcastTokenAdd,             checkTokenAdd],
			["waitTokenRemove",          broadcastTokenRemove,          checkUint],
			["waitTokenMoveLayerPos",    broadcastTokenMoveLayerPos,    checkTokenMoveLayerPos],
			["waitTokenSet",             broadcastTokenSet,             checkTokenSet],
			["waitTokenSetMulti",        broadcastTokenSetMulti,        checkTokenMultiSet],
			["waitLayerShift",           broadcastLayerShift,           checkLayerShift],
			["waitWallAdded",            broadcastWallAdd,              checkWallPath],
			["waitWallRemoved",          broadcastWallRemove,           checkUint],
			["waitWallModified",         broadcastWallModify,           checkWall],
			["waitWallMoved",            broadcastWallMoveLayer,        checkIDPath],
			["waitMusicPackAdd",         broadcastMusicPackAdd,         checkIDName],
			["waitMusicPackRename",      broadcastMusicPackRename,      checkIDName],
			["waitMusicPackRemove",      broadcastMusicPackRemove,      checkUint],
			["waitMusicPackCopy",        broadcastMusicPackCopy,        checkMusicPackCopy],
			["waitMusicPackVolume",      broadcastMusicPackVolume,      checkMusicPackVolume],
			["waitMusicPackPlay",        broadcastMusicPackPlay,        checkMusicPackPlay],
			["waitMusicPackStop",        broadcastMusicPackStop,        checkUint],
			["waitMusicPackStopAll",     broadcastMusicPackStopAll,     returnVoid],
			["waitMusicPackTrackAdd",    broadcastMusicPackTrackAdd,    checkMusicPackTrackAdd],
			["waitMusicPackTrackRemove", broadcastMusicPackTrackRemove, checkMusicPackTrack],
			["waitMusicPackTrackVolume", broadcastMusicPackTrackVolume, checkMusicPackTrackVolume],
			["waitMusicPackTrackRepeat", broadcastMusicPackTrackRepeat, checkMusicPackTrackRepeat],
			["waitPluginChange",         broadcastPluginChange,         returnVoid],
			["waitPluginSetting",        broadcastPluginSettingChange,  checkPluginSetting],
			["waitSignalMeasure",        broadcastSignalMeasure,        checkSignalMeasure],
			["waitSignalPosition",       broadcastSignalPosition,       checkSignalPosition],
			["waitSignalMovePosition",   broadcastSignalMovePosition,   checkSignalPosition],
			["waitBroadcastWindow",      broadcastWindow,               checkBroadcastWindow],
			["waitBroadcast",            broadcastAny,                  checkBroadcast]
		],
		"images": [
			["waitAdded",         broadcastImageItemAdd,      checkAdded],
			["waitMoved",         broadcastImageItemMove,     checkFromTo],
			["waitRemoved",       broadcastImageItemRemove,   checkString],
			["waitCopied",        broadcastImageItemCopy,     checkCopied],
			["waitFolderAdded",   broadcastImageFolderAdd,    checkString],
			["waitFolderMoved",   broadcastImageFolderMove,   checkFromTo],
			["waitFolderRemoved", broadcastImageFolderRemove, checkString]
		],
		"audio": [
			["waitAdded",         broadcastAudioItemAdd,      checkAdded],
			["waitMoved",         broadcastAudioItemMove,     checkFromTo],
			["waitRemoved",       broadcastAudioItemRemove,   checkString],
			["waitCopied",        broadcastAudioItemCopy,     checkCopied],
			["waitFolderAdded",   broadcastAudioFolderAdd,    checkString],
			["waitFolderMoved",   broadcastAudioFolderMove,   checkFromTo],
			["waitFolderRemoved", broadcastAudioFolderRemove, checkString]
		],
		"characters": [
			["waitAdded",         broadcastCharacterItemAdd,      checkAdded],
			["waitMoved",         broadcastCharacterItemMove,     checkFromTo],
			["waitRemoved",       broadcastCharacterItemRemove,   checkString],
			["waitCopied",        broadcastCharacterItemCopy,     checkCopied],
			["waitFolderAdded",   broadcastCharacterFolderAdd,    checkString],
			["waitFolderMoved",   broadcastCharacterFolderMove,   checkFromTo],
			["waitFolderRemoved", broadcastCharacterFolderRemove, checkString]
		],
		"maps": [
			["waitAdded",         broadcastMapItemAdd,      checkAdded],
			["waitMoved",         broadcastMapItemMove,     checkFromTo],
			["waitRemoved",       broadcastMapItemRemove,   checkString],
			["waitCopied",        broadcastMapItemCopy,     checkCopied],
			["waitFolderAdded",   broadcastMapFolderAdd,    checkString],
			["waitFolderMoved",   broadcastMapFolderMove,   checkFromTo],
			["waitFolderRemoved", broadcastMapFolderRemove, checkString]
		]
	      },
	      endpoints: Record<string, [string, string, keyof typeof argProcessors | string[], (data: any) => data is any, string, string][]> ={
		"": [
			["ready"      , "conn.ready"      , "", returnVoid, "", ""],

			["setCurrentMap", "maps.setCurrentMap", "!", returnVoid,   "", ""],
			["getUserMap",    "maps.getUserMap",    "",  checkUint,    "", ""],
			["setUserMap",    "maps.setUserMap",    "!", returnVoid,   "waitCurrentUserMap", ""],
			["getMapData",    "maps.getMapData",    "!", checkMapData, "", ""],

			["newMap",           "maps.new",             "!",            checkIDName, "", ""],
			["setMapDetails",    "maps.setMapDetails",   "!",            returnVoid,  "waitMapChange", ""],
			["setMapStart",      "maps.setMapStart",     "!",            returnVoid,  "waitMapStartChange", ""],
			["setGridDistance",  "maps.setGridDistance", "!",            returnVoid,  "waitGridDistanceChange", ""],
			["setGridDiagonal",  "maps.setGridDiagonal", "!",            returnVoid,  "waitGridDiagonalChange", ""],
			["setLightColour",   "maps.setLightColour",  "!",            returnVoid,  "waitMapLightChange", ""],
			["setMapKeyData",    "maps.setData",        ["key", "data"], returnVoid,  "waitMapDataSet", ""],
			["removeMapKeyData", "maps.removeData",      "!",            returnVoid,  "waitMapDataRemove", ""],

			["signalMeasure",      "maps.signalMeasure",      "!", returnVoid, "", ""],
			["signalPosition",     "maps.signalPosition",     "!", returnVoid, "", ""],
			["signalMovePosition", "maps.signalMovePosition", "!", returnVoid, "", ""],

			["addLayer",         "maps.addLayer",          "!",                       checkString,      "waitLayerAdd", "*"],
			["addLayerFolder",   "maps.addLayerFolder",    "!",                       checkString,      "waitLayerFolderAdd", "*"],
			["renameLayer",      "maps.renameLayer",      ["path", "name"],           checkLayerRename, "waitLayerRename", "*"],
			["moveLayer",        "maps.moveLayer",        ["from", "to", "position"], returnVoid,       "waitLayerMove", ""],
			["showLayer",        "maps.showLayer",         "!",                       returnVoid,       "waitLayerShow", ""],
			["hideLayer",        "maps.hideLayer",         "!",                       returnVoid,       "waitLayerHide", ""],
			["lockLayer",        "maps.lockLayer",         "!",                       returnVoid,       "waitLayerLock", ""],
			["unlockLayer",      "maps.unlockLayer",       "!",                       returnVoid,       "waitLayerUnlock", ""],
			["addToMask",        "maps.addToMask",         "!",                       returnVoid,       "waitMaskAdd", ""],
			["removeFromMask",   "maps.removeFromMask",    "!",                       returnVoid,       "waitMaskRemove", ""],
			["setMask",          "maps.setMask",          ["baseOpaque", "masks"],    returnVoid,       "waitMaskSet", ""],
			["removeLayer",      "maps.removeLayer",       "!",                       returnVoid,       "waitLayerRemove", ""],
			["addToken",         "maps.addToken",         ["path", "token"],          checkUint,        "waitTokenAdd", "token/id"],
			["removeToken",      "maps.removeToken",       "!",                       returnVoid,       "waitTokenRemove", ""],
			["setToken",         "maps.setToken",          "!",                       returnVoid,       "waitTokenSet", ""],
			["setTokenMulti",    "maps.setTokenMulti",     "!",                       returnVoid,       "waitTokenMultiSet", ""],
			["setTokenLayerPos", "maps.setTokenLayerPos", ["id", "to", "newPos"],     returnVoid,       "waitTokenMoveLayerPos", ""],
			["shiftLayer",       "maps.shiftLayer",       ["path", "dx", "dy"],       returnVoid,       "waitLayerShift", ""],
			["addWall",          "maps.addWall",          ["path", "wall"],           checkUint,        "waitWallAdded", "wall/id"],
			["removeWall",       "maps.removeWall",        "!",                       returnVoid,       "waitWallRemoved", ""],
			["modifyWall",       "maps.modifyWall",        "!",                       returnVoid,       "waitWallModified", ""],
			["moveWall",         "maps.moveWall",         ["id", "path"],             returnVoid,       "waitWallMoved", ""],

			["musicPackList",        "music.list",            "",                       checkMusicPacks, "", ""],
			["musicPackAdd",         "music.new",             "!",                      checkIDName,     "waitMusicPackAdd", "*"],
			["musicPackRename",      "music.rename",         ["id", "name"],            checkString,     "waitMusicPackRename", "*"],
			["musicPackRemove",      "music.remove",          "!",                      returnVoid,      "waitMusicPackRemove", ""],
			["musicPackCopy",        "music.copy",           ["id", "name"],            checkIDName,     "waitMusicPackCopy", "name"],
			["musicPackSetVolume",   "music.setVolume",      ["id", "volume"],          returnVoid,      "waitMusicPackVolume", ""],
			["musicPackPlay",        "music.playPack",       ["id", "playTime"],        checkUint,       "waitMusicPackPlay", "*"],
			["musicPackStop",        "music.stopPack",        "!",                      returnVoid,      "waitMusicPackStop", ""],
			["musicPackStopAll",     "music.stopAllPacks",    "",                       returnVoid,      "waitMusicPackStopAll", ""],
			["musicPackTrackAdd",    "music.addTracks",      ["id", "tracks"],          returnVoid,      "waitMusicPackTrackAdd", ""],
			["musicPackTrackRemove", "music.removeTrack",    ["id", "track"],           returnVoid,      "waitMusicPackTrackRemove", ""],
			["musicPackTrackVolume", "music.setTrackVolume", ["id", "track", "volume"], returnVoid,      "waitMusicPackTrackVolume", ""],
			["musicPackTrackRepeat", "music.setTrackRepeat", ["id", "track", "repeat"], returnVoid,      "waitMusicPackTrackRepeat", ""],

			["characterCreate", "characters.create", ["path", "data"],              checkIDPath,    "", ""],
			["characterModify", "characters.modify", ["id", "setting", "removing"], returnVoid,     "waitCharacterDataChange", ""],
			["characterGet",    "characters.get",     "!",                          checkCharacter, "", ""],

			["listPlugins",   "plugins.list",    "",                           checkPlugins, "", ""],
			["enablePlugin",  "plugins.enable",  "!",                          returnVoid,   "", ""],
			["disablePlugin", "plugins.disable", "!",                          returnVoid,   "", ""],
			["pluginSetting", "plugins.set",    ["id", "setting", "removing"], returnVoid,   "waitPluginSetting", ""],

			["broadcastWindow", "broadcastWindow", ["module", "id", "contents"], returnVoid, "waitBroadcastWindow", ""],
			["broadcast",       "broadcast",        "!",                         returnVoid, "waitBroadcast", ""]
		],
		"images": [
			["list",         "imageAssets.list",          "",            checkFolderItems, "", ""],
			["createFolder", "imageAssets.createFolder",  "!",           checkString,      "waitFolderAdded", "*"],
			["move",         "imageAssets.move",         ["from", "to"], checkString,      "waitMoved", "to"],
			["moveFolder",   "imageAssets.moveFolder",   ["from", "to"], checkString,      "waitFolderMoved", "to"],
			["remove",       "imageAssets.remove",        "!",           returnVoid,       "waitRemoved", ""],
			["removeFolder", "imageAssets.removeFolder",  "!",           returnVoid,       "waitFolderRemoved", ""],
			["copy",         "imageAssets.copy",         ["id", "path"], checkIDPath,      "waitCopied", "name"]
		],
		"audio": [
			["list",         "audioAssets.list",          "",            checkFolderItems, "", ""],
			["createFolder", "audioAssets.createFolder",  "!",           checkString,      "waitFolderAdded", ""],
			["move",         "audioAssets.move",         ["from", "to"], checkString,      "waitMoved", "to"],
			["moveFolder",   "audioAssets.moveFolder",   ["from", "to"], checkString,      "waitFolderMoved", "to"],
			["remove",       "audioAssets.remove",        "!",           returnVoid,       "waitRemoved", ""],
			["removeFolder", "audioAssets.removeFolder",  "!",           returnVoid,       "waitFolderRemoved", ""],
			["copy",         "audioAssets.copy",         ["id", "path"], checkIDPath,      "waitCopied", "name"]
		],
		"characters": [
			["list",         "characters.list",          "",            checkFolderItems, "", ""],
			["createFolder", "characters.createFolder",  "!",           checkString,      "waitFolderAdded", ""],
			["move",         "characters.move",         ["from", "to"], checkString,      "waitMoved", "to"],
			["moveFolder",   "characters.moveFolder",   ["from", "to"], checkString,      "waitFolderMoved", "to"],
			["remove",       "characters.remove",        "!",           returnVoid,       "waitRemoved", ""],
			["removeFolder", "characters.removeFolder",  "!",           returnVoid,       "waitFolderRemoved", ""],
			["copy",         "characters.copy",         ["id", "path"], checkIDPath,      "waitCopied", "name"]
		],
		"maps": [
			["list",         "maps.list",          "",            checkFolderItems, "", ""],
			["createFolder", "maps.createFolder",  "!",           checkString,      "waitFolderAdded", ""],
			["move",         "maps.move",         ["from", "to"], checkString,      "waitMoved", "to"],
			["moveFolder",   "maps.moveFolder",   ["from", "to"], checkString,      "waitFolderMoved", "to"],
			["remove",       "maps.remove",        "!",           returnVoid,       "waitRemoved", ""],
			["removeFolder", "maps.removeFolder",  "!",           returnVoid,       "waitFolderRemoved", ""],
			["copy",         "maps.copy",         ["id", "path"], checkIDPath,      "waitCopied", "name"]
		]
	      },
	      pseudoWait = () => new Subscription<any>(() => {});

	for (const e in endpoints) {
		const rk = (e === "" ? rpc : rpc[e as keyof RPCType]) as Record<string, Function>,
		      ik = (e === "" ? internal : internal[e as keyof InternalWaits]) as Record<string, Function>;
		for (const [name, endpoint, args, checker, internalWaiter, postKey] of endpoints[e]) {
			const processArgs = argProcessors[typeof args === "string" ? args : "*"];
			if (internalWaiter === "") {
				rk[name] = (...params: unknown[]) => arpc.request(endpoint, processArgs(params, args as string[]), checker).catch(handleError);
			} else {
				const [iw, fn] = Subscription.bind(1);
				ik[internalWaiter] = iw.splitCancel();
				if (postKey === "") {
					rk[name] = (...params: unknown[]) => {
						const a = processArgs(params, args as string[]);
						fn(a);
						return arpc.request(endpoint, a, checker).catch(handleError);
					};
				} else if (postKey === "*") {
					rk[name] = (...params: unknown[]) => arpc.request(endpoint, processArgs(params, args as string[]), checker).catch(handleError).then(data => {
						fn(data);
						return data;
					});
				} else if (postKey === "token/id") {
					rk[name] = (...params: unknown[]) => {
						const a = processArgs(params, args as string[]) as {token: {id: Uint}};
						return arpc.request(endpoint, a, checker).catch(handleError).then(data => {
							a.token.id = data;
							fn(a);
							return data;
						});
					}
				} else {
					rk[name] = (...params: unknown[]) => {
						const a = processArgs(params, args as string[]) as object;
						return arpc.request(endpoint, a, checker).catch(handleError).then(data => {
							fn(Object.assign(a, {[postKey]: data}));
							return data;
						});
					}
				}
			}
		}
	}
	for (const k in waiters) {
		const rk = (k === "" ? rpc : rpc[k as keyof RPCType]) as Record<string, Function>,
		      ik = (k === "" ? internal : internal[k as keyof InternalWaits]) as Record<string, Function>,
		      ck = (k === "" ? combined : combined[k as keyof InternalWaits]) as Record<string, Function>;
		for (const [name, broadcastID, checker] of waiters[k]) {
			const [waiter, fn] = Subscription.bind(1);
			arpc.subscribe(broadcastID, checker).when(data => queue(async () => fn(data))).catch(handleError);
			rk[name] = () => waiter;
			if (ik[name]) {
				ck[name] = Subscription.merge(rk[name](), ik[name]()).splitCancel();
			} else {
				ik[name] = pseudoWait;
				ck[name] = rk[name];
			}
		}
	}
	arpc.await(-999).catch(handleError);
	Object.freeze(rpc);
	return arpc.await(broadcastIsAdmin, checkUint).then(userLevel => {
		isAdmin = userLevel === 2;
		isUser = userLevel === 1;
		return arpc.request("conn.currentTime", (t: any): t is number => checkUint(t, "currentTime"));
	}).then(t => {
		timeShift = t - Date.now() / 1000;
	});
})).catch(handleError);

type checkers = [(data: any, name: string, key?: string) => data is any, string][];

const mapDataCheckers: ((data: Record<string, any>) => void)[] = [],
      tokenDataCheckers: ((data: Record<string, KeystoreData>) => void)[] = [],
      characterDataCheckers: ((data: Record<string, KeystoreData>) => void)[] = [],
      returnVoid = (_?: any): _ is any => true,
      throwError = (err: string) => {throw new TypeError(err)},
      checkInt = (data: any, name = "Int", key = ""): data is number => {
	if (!isInt(data)) {
		throwError(key ? `invalid ${name} object, key '${key}' contains an invalid Int: ${JSON.stringify(data)}` : `expecting Int type, got ${JSON.stringify(data)}`);
	}
	return true;
      },
      checkUint = (data: any, name = "Uint", key = "", max = Number.MAX_SAFE_INTEGER): data is number => {
	if (!isInt(data, 0, max)) {
		throwError(key ? `invalid ${name} object, key '${key}' contains an invalid Uint: ${JSON.stringify(data)}` : `expecting Uint type, got ${JSON.stringify(data)}`);
	}
	return true;
      },
      checkByte = (data: any, name = "Byte", key = ""): data is number => checkUint(data, name, key, 255),
      checkObject = (data: any, name: string, key = ""): data is Object => {
	if (typeof data !== "object") {
		throwError(key ? `invalid ${name} object, key '${key}' contains invalid data: ${JSON.stringify(data)}` : `expecting ${name} object, got ${JSON.stringify(data)}`);
	}
	return true;
      },
      checkString = (data: any, name = "String", key = ""): data is string => {
	if (typeof data !== "string") {
		throwError(key ? `invalid ${name} object, key '${key}' contains an invalid string: ${JSON.stringify(data)}` : `expecting ${name} type, got ${JSON.stringify(data)}`);
	}
	return true;
      },
      checkBoolean = (data: any, name = "Boolean", key = ""): data is boolean => {
	if (typeof data !== "boolean") {
		throwError(key ? `invalid ${name} object, key '${key}' contains an invalid boolean: ${JSON.stringify(data)}` : `expecting ${name} type, got ${JSON.stringify(data)}`);
	}
	return true;
      },
      checkArray = (data: any, name: string, key = ""): data is Array<any> => {
	if (!(data instanceof Array)) {
		throwError(`invalid ${name} object, key '${key}' contains an invalid Array: ${JSON.stringify(data)}`);
	}
	return true;
      },
      checker = (data: any, name: string, checkers: checkers) => {
	for (let [fn, key] of checkers) {
		if (key.charAt(0) === "?") {
			if (data[key = key.slice(1)] === undefined) {
				continue;
			}
		}
		if (!fn(key ? data[key] : data, name, key)) {
			return false;
		}
	}
	return true;
      },
      checksColour: checkers = [[checkObject, ""], [checkByte, "r"], [checkByte, "g"], [checkByte, "b"], [checkByte, "a"]],
      checkColour = (data: any, name = "Colour"): data is any => {
	checker(data, name, checksColour);
	Colour.from(data);
	return true;
      },
      checksID: checkers = [[checkObject, ""], [checkUint, "id"]],
      checkID = (data: any, name: string): data is Object => checker(data, name, checksID),
      checksIDName: checkers = [[checkID, ""], [checkString, "name"]],
      checkIDName = (data: any): data is any => checker(data, "IDName", checksIDName),
      checkAdded = (data: any): data is any => {
	checkArray(data, "added");
	for (const i of data) {
		checkIDName(i);
	}
	return true;
      },
      checksIDPath: checkers = [[checkID, ""], [checkString, "path"]],
      checkIDPath = (data: any): data is any => checker(data, "IDPath", checksIDPath),
      checksFromTo: checkers = [[checkObject, ""], [checkString, "from"], [checkString, "to"]],
      checkFromTo = (data: any, name = "FromTo"): data is any => checker(data, name, checksFromTo),
      checksCopied: checkers = [[checkObject, ""], [checkUint, "oldID"], [checkUint, "newID"], [checkString, "path"]],
      checkCopied = (data: any): data is any => checker(data, "Copied", checksCopied),
      checksLayerMove: checkers = [[checkFromTo, ""], [checkUint, "position"]],
      checkLayerMove = (data: any): data is any => checker(data, "LayerMove", checksLayerMove),
      checksLayerRename: checkers = [[checkObject, ""], [checkString, "path"], [checkString, "name"]],
      checkLayerRename = (data: any): data is any => checker(data, "LayerRename", checksLayerRename),
      checksFolderLayers: checkers = [[checkObject, ""], [checkObject, "folders"], [checkObject, "items"]],
      checkFolderItems = (data: any): data is any => {
	checker(data, "FolderItems", checksFolderLayers);
	for (const key in data["folders"]) {
		checkFolderItems(data["folders"][key]);
	}
	for (const key in data["items"]) {
		checkUint(data["items"][key], "FolderItems", key);
	}
	return true;
      },
      checksMapKeyData: checkers = [[checkObject, ""], [checkString, "key"]],
      checkMapKeyData = (data: any): data is any => {
	checker(data, "KeyData", checksMapKeyData);
	const d = {[data.key]: data.data};
	for (const c of mapDataCheckers) {
		c(d);
	}
	if (!d[data.key]) {
		for (const k of data) {
			delete data[k];
		}
		data[""] = "";
	}
	return true;
      },
      checksKeystoreData: checkers = [[checkObject, ""], [checkBoolean, "user"]],
      checkKeystoreData = (data: any, name = "KeystoreData"): data is any => {
	checkObject(data, name);
	for (const key in data) {
		checker(data[key], name, checksKeystoreData);
		if (data[key]["data"] === undefined) {
			throwError(`invalid KeystoreData object, key '${key}' contains no data`);
		}
	}
	return true;
      },
      checksKeystoreDataChange: checkers = [[checkObject, ""], [checkKeystoreData, "setting"], [checkArray, "removing"]],
      checkKeystoreDataChange = (data: any, name: string): data is any => {
	checker(data, name, checksKeystoreDataChange);
	for (const r of data.removing) {
		checkString(r, name, "removing");
	}
	return true;
      },
      checkCharacter = (data: any): data is any => {
	checkKeystoreData(data, "Character");
	for (const c of characterDataCheckers) {
		c(data);
	}
	return true;
      },
      checksCharacterDataChange: checkers = [[checkKeystoreDataChange, ""], [checkUint, "id"]],
      checkCharacterDataChange = (data: any): data is any => {
	checker(data, "CharacterDataChange", checksCharacterDataChange);
	for (const c of characterDataCheckers) {
		c(data.setting);
	}
	return true;
      },
      checksMapDetails: checkers = [[checkObject, ""], [checkByte, "gridType"], [checkUint, "gridSize"], [checkUint, "gridStroke"], [checkColour, "gridColour"]],
      checkMapDetails = (data: any, name = "MapDetails"): data is any => checker(data, name, checksMapDetails),
      checksTokenMoveLayerPos: checkers = [[checkID, ""], [checkString, "to"], [checkUint, "newPos"]],
      checkTokenMoveLayerPos = (data: any): data is any => checker(data, "TokenMoveLayer", checksTokenMoveLayerPos),
      checksTokenSet: checkers = [[checkID, ""], [checkInt, "?x"], [checkInt, "?y"], [checkUint, "?width"], [checkUint, "?height"], [checkByte, "?rotation"], [checkBoolean, "?snap"], [checkUint, "?src"], [checkUint, "?patternWidth"], [checkUint, "?patternHeight"], [checkBoolean, "?flip"], [checkBoolean, "?flop"], [checkKeystoreData, "?tokenData"], [checkArray, "?removeTokenData"], [checkColour, "?fill"], [checkColour, "?stroke"], [checkUint, "?strokeWidth"], [checkArray, "?points"], [checkArray, "?lightColours"], [checkArray, "?lightStages"], [checkArray, "?lightTimings"]],
      checkTokenSet = (data: any, name = "TokenSet"): data is any => {
	checker(data, name, checksTokenSet);
	if (data["lightColours"]) {
		for (const cs of data["lightColours"]) {
			checkArray(cs, name, "lightColours");
			for (const c of cs) {
				checkColour(c, `${name}->lightColours`);
			}
		}
	}
	if (data["lightStages"]) {
		for (const s of data["lightStages"]) {
			checkUint(s, name, "lightStages")
		}
	}
	if (data["lightTimings"]) {
		for (const s of data["lightTimings"]) {
			checkUint(s, name, "lightTimings")
		}
	}
	if (data["removeTokenData"]) {
		for (const k of data["removeTokenData"]) {
			checkString(k, name, "removeTokenData");
		}
	}
	if (data["points"]) {
		for (const p of data["points"]) {
			checker(p, `${name}->Points`, checksCoords);
		}
	}
	return true;
      },
      checkTokenMultiSet = (data: any): data is any => {
	checkArray(data, "TokenSetMulti");
	for (const tk of data) {
		checkTokenSet(tk, "TokenSetMulti");
	}
	return true;
      },
      checksToken: checkers = [[checkID, ""], [checkInt, "x"], [checkInt, "y"], [checkUint, "width"], [checkUint, "height"], [checkByte, "rotation"], [checkBoolean, "snap"], [checkArray, "lightColours"], [checkArray, "lightStages"], [checkArray, "lightTimings"], [checkKeystoreData, "tokenData"]],
      checksTokenImage: checkers = [[checkUint, "src"], [checkUint, "patternWidth"], [checkUint, "patternHeight"], [checkBoolean, "flip"], [checkBoolean, "flop"]],
      checksTokenShape: checkers = [[checkColour, "fill"], [checkColour, "stroke"], [checkUint, "strokeWidth"], [checkUint, "fillType"], [checkArray, "fills"]],
      checksCoords: checkers = [[checkObject, ""], [checkInt, "x"], [checkInt, "y"]],
      checksFills: checkers = [[checkObject, ""], [checkByte, "pos"], [checkColour, "colour"]],
      checkToken = (data: any, name = "Token"): data is any => {
	checker(data, name, checksToken);
	for (const cs of data["lightColours"]) {
		checkArray(cs, "TokenSet", "lightColours");
		for (const c of cs) {
			checkColour(c, "TokenSet->lightColours");
		}
	}
	for (const s of data["lightStages"]) {
		checkUint(s, "TokenSet", "lightStages")
	}
	for (const s of data["lightTimings"]) {
		checkUint(s, "TokenSet", "lightTimings")
	}
	switch (data.tokenType) {
	case undefined:
	case 0:
		checker(data, name, checksTokenImage);
		break;
	case 2:
		checkArray(data.points, name, "points");
		for (const p of data.points) {
			checker(p, "Token->Points", checksCoords);
		}
	case 1:
		checker(data, name, checksTokenShape);
		if (data.isEllipse !== undefined) {
			checkBoolean(data.isEllipse, "Token", "isEllipse");
		}
		for (const f of data.fills) {
			checker(f, "Token->Fills", checksFills);
		}
		break;
	default:
		throw new TypeError("invalid Token object, key 'tokenType' contains invalid data");
	}
	for (const c of tokenDataCheckers) {
		c(data.tokenData);
	}
	return true;
      },
      checksTokenAdd: checkers = [[checkObject, ""], [checkString, "path"], [checkToken, "token"]],
      checkTokenAdd = (data: any): data is any => checker(data, "TokenAdd", checksTokenAdd),
      checksLayerFolder: checkers = [[checkString, "name"], [checkBoolean, "hidden"], [checkArray, "children"]],
      checksLayerTokens: checkers = [[checkString, "name"], [checkBoolean, "hidden"], [checkBoolean, "locked"], [checkArray, "tokens"], [checkArray, "walls"]],
      checksLayerGrid: checkers = [[checkBoolean, "hidden"]],
      checkLayerFolder = (data: any, name = "LayerFolder"): data is any => {
	if (name !== "MapData") {
		checker(data, name, checksLayerFolder);
	}
	for (const c of data["children"]) {
		checkObject(c, "LayerFolder");
		if (c.children !== undefined) {
			checkLayerFolder(c);
		} else if (c.name === "Grid" || c.name === "Light") {
			checker(c, "LayerGrid", checksLayerGrid);
		} else {
			checker(c, "LayerTokens", checksLayerTokens);
			for (const t of c["tokens"]) {
				checkToken(t);
			}
			for (const w of c["walls"]) {
				checkWall(w, "Layer->Wall");
			}
		}
	}
	return true;
      },
      checksMaskSet: checkers = [[checkObject, ""], [checkBoolean, "baseOpaque"], [checkArray, "masks"]],
      checkMaskSet = (data: any): data is any => {
	checker(data, "MaskSet", checksMaskSet);
	for (const mask of data.masks) {
		checkMask(mask);
	}
	return true;
      },
      checkMapStart = (data: any): data is any => {
	checkArray(data, "MapStart");
	if (data.length !== 2) {
		throwError("invalid number of coords for MapStart");
	}
	checkUint(data[0], "MapStart->startX");
	checkUint(data[1], "MapStart->startY");
	return true;
      },
      checksMapData: checkers = [[checkMapDetails, ""], [checkUint, "startX"], [checkUint, "startY"], [checkUint, "gridDistance"], [checkBoolean, "gridDiagonal"], [checkColour, "lightColour"], [checkMaskSet, ""], [checkArray, "children"], [checkLayerFolder, ""], [checkObject, "data"]],
      checkMapData = (data: any): data is any => {
	checker(data, "MapData", checksMapData);
	for (const c of mapDataCheckers) {
		c(data.data);
	}
	return true;
      },
      checksLayerShift: checkers = [[checkObject, ""], [checkString, "path"], [checkInt, "dx"], [checkInt, "dy"]],
      checkLayerShift = (data: any): data is any => checker(data, "LayerShift", checksLayerShift),
      checksWall: checkers = [[checkObject, ""], [checkUint, "id"], [checkInt, "x1"], [checkInt, "y1"], [checkInt, "x2"], [checkInt, "y2"], [checkColour, "colour"], [checkByte, "scattering"]],
      checkWall = (data: any, name = "Wall"): data is any => checker(data, name, checksWall),
      checksWallPath: checkers = [[checkWall, ""], [checkString, "path"]],
      checkWallPath = (data: any): data is any => checker(data, "WallPath", checksWallPath),
      checksMusicTrack: checkers = [[checkID, ""], [checkUint, "volume"], [checkInt, "repeat"]],
      checkMusicTrack = (data: any) => checker(data, "musicTrack", checksMusicTrack),
      checksMusicPack: checkers = [[checkIDName, ""], [checkArray, "tracks"], [checkUint, "volume"], [checkUint, "playTime"]],
      checkMusicPack = (data: any) => {
	checker(data, "musicPack", checksMusicPack);
	for (const t of data["tracks"]) {
		checkMusicTrack(t);
	}
	return true;
      },
      checkMusicPacks = (data: any): data is any => {
	checkArray(data, "musicPacks");
	for (const pack of data) {
		checkMusicPack(pack);
	}
	return true;
      },
      checksMusicPackVolume: checkers = [[checkID, ""], [checkUint, "volume"]],
      checkMusicPackVolume = (data: any): data is any => checker(data, "MusicPackVolume", checksMusicPackVolume),
      checksMusicPackPlay: checkers = [[checkID, ""], [checkUint, "playTime"]],
      checkMusicPackPlay = (data: any): data is any => checker(data, "MusicPackPlay", checksMusicPackPlay),
      checksMusicPackTrackAdd: checkers = [[checkID, ""], [checkArray, "tracks"]],
      checkMusicPackTrackAdd = (data: any): data is any => {
	checker(data, "MusicPackTrackAdd", checksMusicPackTrackAdd);
	for (const t of data["tracks"]) {
		checkUint(t, "MusicPackTrackAdd->Track");
	}
	return true;
      },
      checksMusicPackTrack: checkers = [[checkID, ""], [checkUint, "track"]],
      checkMusicPackTrack = (data: any, name = "MusicPackTrackRemove"): data is any => checker(data, name, checksMusicPackTrack),
      checksMusicPackTrackVolume: checkers = [[checkMusicPackTrack, ""], [checkUint, "volume"]],
      checkMusicPackTrackVolume = (data: any): data is any => checker(data, "MusicPackTrackVolume", checksMusicPackTrackVolume),
      checksMusicPackTrackRepeat: checkers = [[checkMusicPackTrack, ""], [checkInt, "repeat"]],
      checkMusicPackTrackRepeat = (data: any): data is any => checker(data, "MusicPackTrackRepeat", checksMusicPackTrackRepeat),
      checksMusicPackCopy: checkers = [[checkIDName, ""], [checkUint, "newID"]],
      checkMusicPackCopy = (data: any): data is any => checker(checksMusicPackCopy, "MusicPackCopy", data),
      checkPlugins = (data: any): data is any => {
	checkObject(data, "plugins");
	for (const p in data) {
		checkObject(data, "plugins->plugin", p);
		checkBoolean(data[p]["enabled"], "plugin->enabled", "enabled");
		checkObject(data[p]["data"], "plugin->data", "data");
	}
	return true;
      },
      checksPluginSetting: checkers = [[checkKeystoreDataChange, ""], [checkString, "id"]],
      checkPluginSetting = (data: any): data is any => checker(data, "PluginSetting", checksPluginSetting),
      checkSignalMeasure = (data: any): data is any => {
	if (data === null) {
		return true;
	}
	checkArray(data, "SignalMeasure");
	if (data.length < 4 || data.length % 2 == 1) {
		throw new TypeError("invalid SignalMeasure array, needs even length at least 4");
	}
	for (let i = 0; i < data.length; i++) {
		checkUint(data[i], `SignalPosition.${i % 2 == 0 ? "x" : "y"}${(i >> 1) + 1}`);
	}
	return true;
      },
      checkSignalPosition = (data: any): data is any => {
	checkArray(data, "SignalPosition");
	if (data.length !== 2) {
		throw new TypeError("invalid SignalPosition array, needs length 2");
	}
	checkUint(data[0], "SignalPosition.x");
	checkUint(data[1], "SignalPosition.y");
	return true;
      },
      checkMask = (data: any): data is any => {
	checkArray(data, "Mask");
	if (data.length === 0) {
		throwError("invalid mask data");
	}
	switch (data[0]) {
	case 0:
	case 1:
		if (data.length !== 5) {
			throwError("invalid number of points for rect mask");
		}
		break;
	case 2:
	case 3:
		if (data.length !== 5) {
			throwError("invalid number of points for ellipse mask");
		}
		break;
	case 4:
	case 5:
		if (data.length < 7 || (data.length & 1) === 0) {
			throwError("invalid number of points for poly mask");
		}
		break;
	default:
	}
	for (let i = 1; i < data.length; i++) {
		checkUint(data[i], "Mask", i + "");
	}
	return true;
      },
      checksBroadcastWindow: checkers = [[checkID, ""], [checkString, "module"], [checkString, "contents"]],
      checkBroadcastWindow = (data: any): data is any => checker(data, "BroadcastWindow", checksBroadcastWindow),
      checkBroadcast = (data: any): data is any => {
	checkObject(data, "Broadcast");
	if (data["type"] === undefined) {
		throwError("invalid Broadcast object, missing 'type' key");
	}
	return true;
      };
