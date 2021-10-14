import  type {RPC as RPCType, InternalWaits, KeystoreData, Uint} from './types.js';
import {Subscription} from './lib/inter.js';
import RPC from './lib/rpc_ws.js';
import {shell} from './windows.js';
import {isInt, isUint, queue, setUser, setAdmin} from './shared.js';
import lang from './language.js';

const broadcastIsAdmin = -1, broadcastCurrentUserMap = -2, broadcastCurrentUserMapData = -3, broadcastMapDataSet = -4, broadcastMapDataRemove = -5, broadcastMapStartChange = -6, broadcastImageItemAdd = -7, broadcastAudioItemAdd = -8, broadcastCharacterItemAdd = -9, broadcastMapItemAdd = -10, broadcastImageItemMove = -11, broadcastAudioItemMove = -12, broadcastCharacterItemMove = -13, broadcastMapItemMove = -14, broadcastImageItemRemove = -15, broadcastAudioItemRemove = -16, broadcastCharacterItemRemove = -17, broadcastMapItemRemove = -18, broadcastImageItemCopy = -19, broadcastAudioItemCopy = -20, broadcastCharacterItemCopy = -21, broadcastMapItemCopy = -22, broadcastImageFolderAdd = -23, broadcastAudioFolderAdd = -24, broadcastCharacterFolderAdd = -25, broadcastMapFolderAdd = -26, broadcastImageFolderMove = -27, broadcastAudioFolderMove = -28, broadcastCharacterFolderMove = -29, broadcastMapFolderMove = -30, broadcastImageFolderRemove = -31, broadcastAudioFolderRemove = -32, broadcastCharacterFolderRemove = -33, broadcastMapFolderRemove = -34, broadcastMapItemChange = -35, broadcastCharacterDataChange = -36, broadcastTokenDataChange = -37, broadcastLayerAdd = -38, broadcastLayerFolderAdd = -39, broadcastLayerMove = -40, broadcastLayerRename = -41, broadcastLayerRemove = -42, broadcastGridDistanceChange = -43, broadcastGridDiagonalChange = -44, broadcastMapLightChange = -45, broadcastLayerShow = -46, broadcastLayerHide = -47, broadcastMaskAdd = -48, broadcastMaskRemove = -49, broadcastMaskSet = -50, broadcastTokenAdd = -51, broadcastTokenRemove = -52, broadcastTokenMoveLayerPos = -53, broadcastTokenSet = -54, broadcastLayerShift = -55, broadcastLightShift = -56, broadcastTokenLightChange = -57, broadcastWallAdd = -58, broadcastWallRemove = -59, broadcastMusicPackAdd = -60, broadcastMusicPackRename = -61, broadcastMusicPackRemove = -62, broadcastMusicPackCopy = -63, broadcastMusicPackVolume = -64, broadcastMusicPackPlay = -65, broadcastMusicPackStop = -66, broadcastMusicPackStopAll = -67, broadcastMusicPackTrackAdd = -68, broadcastMusicPackTrackRemove = -69, broadcastMusicPackTrackVolume = -70, broadcastMusicPackTrackRepeat = -71, broadcastPluginChange = -72, broadcastPluginSettingChange = -73, broadcastWindow = -74, broadcastSignalMeasure = -75, broadcastSignalPosition = -76, broadcastSignalMovePosition = -77, broadcastAny = -78;

let initSend: () => void, connIDSet: (id: Uint) => void;

export const internal = {
	"images":     {},
	"audio":      {},
	"characters": {},
	"maps":       {},
} as InternalWaits,
combined = {
	"images":     {},
	"audio":      {},
	"characters": {},
	"maps":       {},
} as InternalWaits,
rpc = {
	"images":     {},
	"audio":      {},
	"characters": {},
	"maps":       {},
} as RPCType,
addMapDataChecker = (fn: (data: Record<string, any>) => void) => mapDataCheckers.push(fn),
addCharacterDataChecker = (fn: (data: Record<string, KeystoreData>) => void) => characterDataCheckers.push(fn),
addTokenDataChecker = (fn: (data: Record<string, KeystoreData>) => void) => tokenDataCheckers.push(fn),
handleError = (e: Error | string) => {
	console.log(e);
	shell.alert(lang["ERROR"], e instanceof Error ? e.message || lang["ERROR_UNKNOWN"] : typeof e  === "object" ? JSON.stringify(e) : e);
},
inited = new Promise<void>(success => initSend = success),
connID = new Promise<Uint>(success => connIDSet = success);

export default (url: string): Promise<void> => {
	return RPC(url, 1.1).then(arpc => {
		arpc.await(broadcastIsAdmin).then(checkUint).then(userLevel => {
			setAdmin(userLevel === 2);
			setUser(userLevel === 1);
			initSend();
		});
		arpc.request("conn.connID").then(checkUint).then(connIDSet);

		const argProcessors: Record<string, (args: IArguments, names: string[]) => any> = {
			"": () => {},
			"!": (args: IArguments) => args[0],
			"*": (args: IArguments, names: string[]) => Object.fromEntries(names.map((key, pos) => [key, args[pos]]))
		      },
		      waiters: Record<string, [string, number, (data: any) => any][]> = {
			"": [
				["waitCurrentUserMap",       broadcastCurrentUserMap,       checkUint],
				["waitCurrentUserMapData",   broadcastCurrentUserMapData,   checkMapData],
				["waitMapDataSet",           broadcastMapDataSet,           checkMapKeyData],
				["waitMapDataRemove",        broadcastMapDataRemove,        checkString],
				["waitCharacterDataChange",  broadcastCharacterDataChange,  checkCharacterDataChange],
				["waitTokenDataChange",      broadcastTokenDataChange,      checkTokenDataChange],
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
				["waitMaskAdd",              broadcastMaskAdd,              checkMask],
				["waitMaskRemove",           broadcastMaskRemove,           checkUint],
				["waitMaskSet",              broadcastMaskSet,              checkMaskSet],
				["waitTokenAdd",             broadcastTokenAdd,             checkTokenAdd],
				["waitTokenRemove",          broadcastTokenRemove,          checkUint],
				["waitTokenMoveLayerPos",    broadcastTokenMoveLayerPos,    checkTokenMoveLayerPos],
				["waitTokenSet",             broadcastTokenSet,             checkTokenSet],
				["waitLayerShift",           broadcastLayerShift,           checkLayerShift],
				["waitLightShift",           broadcastLightShift,           checkLightShift],
				["waitTokenLightChange",     broadcastTokenLightChange,     checkLightChange],
				["waitWallAdded",            broadcastWallAdd,              checkWallPath],
				["waitWallRemoved",          broadcastWallRemove,           checkUint],
				["waitMusicPackAdd",         broadcastMusicPackAdd,         checkString],
				["waitMusicPackRename",      broadcastMusicPackRename,      checkFromTo],
				["waitMusicPackRemove",      broadcastMusicPackRemove,      checkString],
				["waitMusicPackCopy",        broadcastMusicPackCopy,        checkFromTo],
				["waitMusicPackVolume",      broadcastMusicPackVolume,      checkMusicPackVolume],
				["waitMusicPackPlay",        broadcastMusicPackPlay,        checkMusicPackPlay],
				["waitMusicPackStop",        broadcastMusicPackStop,        checkString],
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
				["waitAdded",         broadcastImageItemAdd,      checkIDName],
				["waitMoved",         broadcastImageItemMove,     checkFromTo],
				["waitRemoved",       broadcastImageItemRemove,   checkString],
				["waitCopied",        broadcastImageItemCopy,     checkCopied],
				["waitFolderAdded",   broadcastImageFolderAdd,    checkString],
				["waitFolderMoved",   broadcastImageFolderMove,   checkFromTo],
				["waitFolderRemoved", broadcastImageFolderRemove, checkString]
			],
			"audio": [
				["waitAdded",         broadcastAudioItemAdd,      checkIDName],
				["waitMoved",         broadcastAudioItemMove,     checkFromTo],
				["waitRemoved",       broadcastAudioItemRemove,   checkString],
				["waitCopied",        broadcastAudioItemCopy,     checkCopied],
				["waitFolderAdded",   broadcastAudioFolderAdd,    checkString],
				["waitFolderMoved",   broadcastAudioFolderMove,   checkFromTo],
				["waitFolderRemoved", broadcastAudioFolderRemove, checkString]
			],
			"characters": [
				["waitAdded",         broadcastCharacterItemAdd,      checkIDName],
				["waitMoved",         broadcastCharacterItemMove,     checkFromTo],
				["waitRemoved",       broadcastCharacterItemRemove,   checkString],
				["waitCopied",        broadcastCharacterItemCopy,     checkCopied],
				["waitFolderAdded",   broadcastCharacterFolderAdd,    checkString],
				["waitFolderMoved",   broadcastCharacterFolderMove,   checkFromTo],
				["waitFolderRemoved", broadcastCharacterFolderRemove, checkString]
			],
			"maps": [
				["waitAdded",         broadcastMapItemAdd,      checkIDName],
				["waitMoved",         broadcastMapItemMove,     checkFromTo],
				["waitRemoved",       broadcastMapItemRemove,   checkString],
				["waitCopied",        broadcastMapItemCopy,     checkCopied],
				["waitFolderAdded",   broadcastMapFolderAdd,    checkString],
				["waitFolderMoved",   broadcastMapFolderMove,   checkFromTo],
				["waitFolderRemoved", broadcastMapFolderRemove, checkString]
			]
		      },
		      endpoints: Record<string, [string, string, keyof typeof argProcessors | string[], (data: any) => any, string, string][]> ={
			"": [
				["ready"      , "conn.ready"      , "", returnVoid, "", ""],
				["currentTime", "conn.currentTime", "", checkUint,  "", ""],

				["setCurrentMap", "maps.setCurrentMap", "!", returnVoid,   "", ""],
				["getUserMap",    "maps.getUserMap",    "",  checkUint,    "", ""],
				["setUserMap",    "maps.setUserMap",    "!", returnVoid,   "waitCurrentUserMap", ""],
				["getMapData",    "maps.getMapData",    "!", checkMapData, "", ""],

				["newMap",           "maps.new",             "!",                 checkIDName, "", ""],
				["setMapDetails",    "maps.setMapDetails",   "!",                 returnVoid,  "waitMapChange", ""],
				["setMapStart",      "maps.setMapStart",    ["startX", "startY"], returnVoid,  "waitMapStartChange", ""],
				["setGridDistance",  "maps.setGridDistance", "!",                 returnVoid,  "waitGridDistanceChange", ""],
				["setGridDiagonal",  "maps.setGridDiagonal", "!",                 returnVoid,  "waitGridDiagonalChange", ""],
				["setLightColour",   "maps.setLightColour",  "!",                 returnVoid,  "waitMapLightChange", ""],
				["setMapKeyData",    "maps.setData",        ["key", "data"],      returnVoid,  "waitMapDataSet", ""],
				["removeMapKeyData", "maps.removeData",      "!",                 returnVoid,  "waitMapDataRemove", ""],

				["signalMeasure",      "maps.signalMeasure",      "!", returnVoid, "", ""],
				["signalPosition",     "maps.signalPosition",     "!", returnVoid, "", ""],
				["signalMovePosition", "maps.signalMovePosition", "!", returnVoid, "", ""],

				["addLayer",         "maps.addLayer",          "!",                                       checkString,      "waitLayerAdd", "*"],
				["addLayerFolder",   "maps.addLayerFolder",    "!",                                       checkString,      "waitLayerFolderAdd", "*"],
				["renameLayer",      "maps.renameLayer",      ["path", "name"],                           checkLayerRename, "waitLayerRename", "*"],
				["moveLayer",        "maps.moveLayer",        ["from", "to", "position"],                 returnVoid,       "waitLayerMove", ""],
				["showLayer",        "maps.showLayer",         "!",                                       returnVoid,       "waitLayerShow", ""],
				["hideLayer",        "maps.hideLayer",         "!",                                       returnVoid,       "waitLayerHide", ""],
				["addToMask",        "maps.addToMask",         "!",                                       returnVoid,       "waitMaskAdd", ""],
				["removeFromMask",   "maps.removeFromMask",    "!",                                       returnVoid,       "waitMaskRemove", ""],
				["resetMask",        "maps.setMask",          ["baseOpaque", "masks"],                    returnVoid,       "waitMaskSet", ""],
				["removeLayer",      "maps.removeLayer",       "!",                                       returnVoid,       "waitLayerRemove", ""],
				["addToken",         "maps.addToken",         ["path", "token"],                          checkUint,        "waitTokenAdd", "token/id"],
				["removeToken",      "maps.removeToken",       "!",                                       returnVoid,       "waitTokenRemove", ""],
				["setToken",         "maps.setToken",          "!",                                       returnVoid,       "waitTokenSet", ""],
				["setTokenLayerPos", "maps.setTokenLayerPos", ["id", "to", "newPos"],                     returnVoid,       "waitTokenMoveLayerPos", ""],
				["shiftLayer",       "maps.shiftLayer",       ["path", "dx", "dy"],                       returnVoid,       "waitLayerShift", ""],
				["shiftLight",       "maps.shiftLight",       ["x", "y"],                                 returnVoid,       "waitLightShift", ""],
				["setTokenLight",    "maps.setTokenLight",    ["id", "lightColour", "lightIntensity"],    returnVoid,       "waitTokenLightChange", ""],
				["addWall",          "maps.addWall",          ["path", "x1", "y1", "x2", "y2", "colour"], checkUint,        "waitWallAdded", "id"],
				["removeWall",       "maps.removeWall",        "!",                                       returnVoid,       "waitWallRemoved", ""],

				["musicPackList",        "music.list",            "",                              checkMusicPacks, "", ""],
				["musicPackAdd",         "music.new",             "!",                             checkString,     "waitMusicPackAdd", "*"],
				["musicPackRename",      "music.rename",         ["from", "to"],                   checkString,     "waitMusicPackRename", "*"],
				["musicPackRemove",      "music.remove",          "!",                             returnVoid,      "waitMusicPackRemove", ""],
				["musicPackCopy",        "music.copy",           ["from", "to"],                   checkString,     "waitMusicPackCopy", "to"],
				["musicPackSetVolume",   "music.setVolume",      ["musicPack", "volume"],          returnVoid,      "waitMusicPackVolume", ""],
				["musicPackPlay",        "music.playPack",       ["musicPack", "playTime"],        checkUint,       "waitMusicPackPlay", "*"],
				["musicPackStop",        "music.stopPack",        "!",                             returnVoid,      "waitMusicPackStop", ""],
				["musicPackStopAll",     "music.stopAllPacks",    "",                              returnVoid,      "waitMusicPackStopAll", ""],
				["musicPackTrackAdd",    "music.addTracks",      ["musicPack", "tracks"],          returnVoid,      "waitMusicPackTrackAdd", ""],
				["musicPackTrackRemove", "music.removeTrack",    ["musicPack", "track"],           returnVoid,      "waitMusicPackTrackRemove", ""],
				["musicPackTrackVolume", "music.setTrackVolume", ["musicPack", "track", "volume"], returnVoid,      "waitMusicPackTrackVolume", ""],
				["musicPackTrackRepeat", "music.setTrackRepeat", ["musicPack", "track", "repeat"], returnVoid,      "waitMusicPackTrackRepeat", ""],

				["characterCreate", "characters.create", ["path", "data"],              checkIDPath,       "", ""],
				["characterModify", "characters.modify", ["id", "setting", "removing"], returnVoid,        "waitCharacterDataChange", ""],
				["characterGet",    "characters.get",     "!",                          checkCharacter,    "", ""],

				["tokenModify", "maps.modifyTokenData", ["id", "setting", "removing"], returnVoid, "waitTokenDataChange", ""],

				["listPlugins",   "plugins.list",    "",                           checkPlugins, "", ""],
				["enablePlugin",  "plugins.enable",  "!",                          returnVoid,   "", ""],
				["disablePlugin", "plugins.disable", "!",                          returnVoid,   "", ""],
				["pluginSetting", "plugins.set",    ["id", "setting", "removing"], returnVoid,   "waitPluginSetting", ""],

				["broadcastWindow", "broadcastWindow", ["module", "id", "contents"], returnVoid, "waitBroadcastWindow", ""],
				["broadcast",       "broadcast",        "!",                         returnVoid, "waitBroadcast", ""],
			],
			"images": [
				["list",         "imageAssets.list",         "",             checkFolderItems, "", ""],
				["createFolder", "imageAssets.createFolder", "!",            checkString,      "waitFolderAdded", "*"],
				["move",         "imageAssets.move",         ["from", "to"], checkString,      "waitMoved", "to"],
				["moveFolder",   "imageAssets.moveFolder",   ["from", "to"], checkString,      "waitFolderMoved", "to"],
				["remove",       "imageAssets.remove",       "!",            returnVoid,       "waitRemoved", ""],
				["removeFolder", "imageAssets.removeFolder", "!",            returnVoid,       "waitFolderRemoved", ""],
				["copy",         "imageAssets.copy",         ["id", "path"], checkIDPath,      "waitCopied", "name"]
			],
			"audio": [
				["list",         "audioAssets.list",         "",             checkFolderItems, "", ""],
				["createFolder", "audioAssets.createFolder", "!",            checkString,      "waitFolderAdded", ""],
				["move",         "audioAssets.move",         ["from", "to"], checkString,      "waitMoved", "to"],
				["moveFolder",   "audioAssets.moveFolder",   ["from", "to"], checkString,      "waitFolderMoved", "to"],
				["remove",       "audioAssets.remove",       "!",            returnVoid,       "waitRemoved", ""],
				["removeFolder", "audioAssets.removeFolder", "!",            returnVoid,       "waitFolderRemoved", ""],
				["copy",         "audioAssets.copy",         ["id", "path"], checkIDPath,      "waitCopied", "name"]
			],
			"characters": [
				["list",         "characters.list",         "",             checkFolderItems, "", ""],
				["createFolder", "characters.createFolder", "!",            checkString,      "waitFolderAdded", ""],
				["move",         "characters.move",         ["from", "to"], checkString,      "waitMoved", "to"],
				["moveFolder",   "characters.moveFolder",   ["from", "to"], checkString,      "waitFolderMoved", "to"],
				["remove",       "characters.remove",       "!",            returnVoid,       "waitRemoved", ""],
				["removeFolder", "characters.removeFolder", "!",            returnVoid,       "waitFolderRemoved", ""],
				["copy",         "characters.copy",         ["id", "path"], checkIDPath,      "waitCopied", "name"]
			],
			"maps": [
				["list",         "maps.list",         "",             checkFolderItems, "", ""],
				["createFolder", "maps.createFolder", "!",            checkString,      "waitFolderAdded", ""],
				["move",         "maps.move",         ["from", "to"], checkString,      "waitMoved", "to"],
				["moveFolder",   "maps.moveFolder",   ["from", "to"], checkString,      "waitFolderMoved", "to"],
				["remove",       "maps.remove",       "!",            returnVoid,       "waitRemoved", ""],
				["removeFolder", "maps.removeFolder", "!",            returnVoid,       "waitFolderRemoved", ""],
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
					rk[name] = function() {return arpc.request(endpoint, processArgs(arguments, args as string[])).then(checker).catch(handleError)}
				} else {
					let fn: Function;
					ik[internalWaiter] = Subscription.splitCancel(new Subscription(successFn => fn = successFn));
					if (postKey === "") {
						rk[name] = function() {
							const a = processArgs(arguments, args as string[]);
							fn(a);
							return arpc.request(endpoint, a).then(checker).catch(handleError);
						}
					} else if (postKey === "*") {
						rk[name] = function() {
							return arpc.request(endpoint, processArgs(arguments, args as string[])).then(checker).catch(handleError).then(data => {
								fn(data);
								return data;
							});
						}
					} else if (postKey === "token/id") {
						rk[name] = function() {
							const a = processArgs(arguments, args as string[]);
							return arpc.request(endpoint, a).then(checker).catch(handleError).then(data => {
								a.token.id = data;
								fn(a);
								return data;
							});
						}
					} else {
						rk[name] = function() {
							const a = processArgs(arguments, args as string[]);
							return arpc.request(endpoint, a).then(checker).catch(handleError).then(data => {
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
				let fn: Function;
				const waiter = new Subscription(success => fn = success);
				arpc.await(broadcastID, true).then(checker).then(data => queue(async () => fn(data)));
				rk[name] = () => waiter;
				if (ik[name]) {
					ck[name] = Subscription.splitCancel(Subscription.merge(rk[name](), ik[name]()));
				} else {
					ik[name] = pseudoWait;
					ck[name] = rk[name];
				}
			}
		}
		arpc.await(-999).catch(handleError);
		Object.freeze(rpc);
		return inited;
	});
};

type checkers = [(data: any, name: string, key?: string) => void, string][];

const mapDataCheckers: ((data: Record<string, any>) => void)[] = [],
      tokenDataCheckers: ((data: Record<string, KeystoreData>) => void)[] = [],
      characterDataCheckers: ((data: Record<string, KeystoreData>) => void)[] = [],
      returnVoid = () => {},
      throwError = (err: string) => {throw new TypeError(err)},
      checkInt = (data: any, name = "Int", key = "") => {
	if (!isInt(data)) {
		throwError(key ? `invalid ${name} object, key '${key}' contains an invalid Int: ${JSON.stringify(data)}` : `expecting Int type, got ${JSON.stringify(data)}`);
	}
      },
      checkUint = (data: any, name = "Uint", key = "", max = Number.MAX_SAFE_INTEGER) => {
	if (!isUint(data, max)) {
		throwError(key ? `invalid ${name} object, key '${key}' contains an invalid Uint: ${JSON.stringify(data)}` : `expecting Uint type, got ${JSON.stringify(data)}`);
	}
	return data;
      },
      checkByte = (data: any, name = "Byte", key = "") => checkUint(data, name, key, 255),
      checkObject = (data: any, name: string, key = "") => {
	if (typeof data !== "object") {
		throwError(key ? `invalid ${name} object, key '${key}' contains invalid data: ${JSON.stringify(data)}` : `expecting ${name} object, got ${JSON.stringify(data)}`);
	}
      },
      checkString = (data: any, name = "String", key = "") => {
	if (typeof data !== "string") {
		throwError(key ? `invalid ${name} object, key '${key}' contains an invalid string: ${JSON.stringify(data)}` : `expecting ${name} type, got ${JSON.stringify(data)}`);
	}
	return data;
      },
      checkBoolean = (data: any, name = "Boolean", key = "") => {
	if (typeof data !== "boolean") {
		throwError(key ? `invalid ${name} object, key '${key}' contains an invalid boolean: ${JSON.stringify(data)}` : `expecting ${name} type, got ${JSON.stringify(data)}`);
	}
	return data;
      },
      checkArray = (data: any, name: string, key = "") => {
	if (!(data instanceof Array)) {
		throwError(`invalid ${name} object, key '${key}' contains an invalid Array: ${JSON.stringify(data)}`);
	}
      },
      checker = (data: any, name: string, checkers: checkers) => {
	for (let [fn, key] of checkers) {
		if (key.charAt(0) === "?") {
			key = key.slice(1);
			if (data[key] === undefined) {
				continue;
			}
		}
		fn(key ? data[key] : data, name, key);
	}
	return data;
      },
      checksColour: checkers = [[checkObject, ""], [checkByte, "r"], [checkByte, "g"], [checkByte, "b"], [checkByte, "a"], [Object.freeze, ""]],
      checkColour = (data: any, name = "Colour") => checker(Object.freeze(data), name, checksColour),
      checksID: checkers = [[checkObject, ""], [checkUint, "id"]],
      checkID = (data: any, name: string) => checker(data, name, checksID),
      checksIDName: checkers = [[checkID, ""], [checkString, "name"]],
      checkIDName = (data: any) => checker(data, "IDName", checksIDName),
      checksIDPath: checkers = [[checkID, ""], [checkString, "path"]],
      checkIDPath = (data: any) => checker(data, "IDPath", checksIDPath),
      checksFromTo: checkers = [[checkObject, ""], [checkString, "from"], [checkString, "to"]],
      checkFromTo = (data: any, name = "FromTo") => checker(data, name, checksFromTo),
      checksCopied: checkers = [[checkObject, ""], [checkUint, "oldID"], [checkUint, "newID"], [checkString, "path"]],
      checkCopied = (data: any) => checker(data, "Copied", checksCopied),
      checksLayerMove: checkers = [[checkObject, ""], [checkString, "from"], [checkString, "to"], [checkUint, "position"]],
      checkLayerMove = (data: any) => checker(data, "LayerMove", checksLayerMove),
      checksLayerRename: checkers = [[checkObject, ""], [checkString, "path"], [checkString, "name"]],
      checkLayerRename = (data: any) => checker(data, "LayerRename", checksLayerRename),
      checksFolderLayers: checkers = [[checkObject, ""], [checkObject, "folders"], [checkObject, "items"]],
      checkFolderItems = (data: any) => {
	checker(data, "FolderItems", checksFolderLayers);
	for (const key in data["folders"]) {
		checkFolderItems(data["folders"][key]);
	}
	for (const key in data["items"]) {
		checkUint(data["items"][key], "FolderItems", key);
	}
	return data;
      },
      checksMapKeyData: checkers = [[checkObject, ""], [checkString, "key"]],
      checkMapKeyData = (data: any) => {
	checker(data, "KeyData", checksMapKeyData)
	const d = {[data.key]: data.data};
	for (const c of mapDataCheckers) {
		c(d);
	}
	if (!d[data.key]) {
		return {"": ""};
	}
	return data;
      },
      checksKeystoreData: checkers = [[checkObject, ""], [checkBoolean, "user"]],
      checkKeystoreData = (data: any, name = "KeystoreData") => {
	checkObject(data, name);
	for (const key in data) {
		checker(data[key], name, checksKeystoreData);
		if (data[key]["data"] === undefined) {
			throwError(`invalid KeystoreData object, key '${key}' contains no data`);
		}
	}
	return data;
      },
      checksKeystoreDataChange: checkers = [[checkObject, ""], [checkKeystoreData, "setting"], [checkArray, "removing"]],
      checkKeystoreDataChange = (data: any, name: string) => {
	checker(data, name, checksKeystoreDataChange)
	for (const r of data.removing) {
		checkString(r, name, "removing");
	}
	return data;
      },
      checkCharacter = (data: any) => {
	checkKeystoreData(data, "Character");
	for (const c of characterDataCheckers) {
		c(data);
	}
	return data;
      },
      checksCharacterDataChange: checkers = [[checkKeystoreDataChange, ""], [checkUint, "id"]],
      checkCharacterDataChange = (data: any) => {
	checker(data, "CharacterDataChange", checksCharacterDataChange)
	for (const c of characterDataCheckers) {
		c(data.setting);
	}
	return data;
      },
      checksTokenDataChange: checkers = [[checkKeystoreDataChange, ""], [checkUint, "id"]],
      checkTokenDataChange = (data: any) => {
	checker(data, "TokenDataChange", checksTokenDataChange)
	for (const c of tokenDataCheckers) {
		c(data.setting);
	}
	return data;
      },
      checksMapDetails: checkers = [[checkObject, ""], [checkByte, "gridType"], [checkUint, "gridSize"], [checkUint, "gridStroke"], [checkColour, "gridColour"]],
      checkMapDetails = (data: any, name = "MapDetails") => checker(data, name, checksMapDetails),
      checksTokenMoveLayerPos: checkers = [[checkID, ""], [checkString, "to"], [checkUint, "newPos"]],
      checkTokenMoveLayerPos = (data: any) => checker(data, "TokenMoveLayer", checksTokenMoveLayerPos),
      checksTokenSet: checkers = [[checkID, ""], [checkInt, "?x"], [checkInt, "?y"], [checkUint, "?width"], [checkUint, "?height"], [checkByte, "?rotation"], [checkBoolean, "?snap"], [checkUint, "?src"], [checkUint, "?patternWidth"], [checkUint, "?patternHeight"], [checkBoolean, "?flip"], [checkBoolean, "?flop"], [checkKeystoreData, "?tokenData"], [checkArray, "?removeTokenData"], [checkColour, "?fill"], [checkColour, "?stroke"], [checkUint, "?strokeWidth"], [checkArray, "?points"]],
      checkTokenSet = (data: any) => {
	checker(data, "TokenSet", checksTokenSet);
	if (data["removeTokenData"]) {
		for (const k of data["removeTokenData"]) {
			checkString(k, "TokenSet", "removeTokenData");
		}
	}
	if (data["points"]) {
		for (const p of data["points"]) {
			checker(p, "TokenSet->Points", checksCoords);
		}
	}
	return data;
      },
      checksToken: checkers = [[checkID, ""], [checkInt, "x"], [checkInt, "y"], [checkUint, "width"], [checkUint, "height"], [checkByte, "rotation"], [checkBoolean, "snap"], [checkColour, "lightColour"], [checkUint, "lightIntensity"]],
      checksTokenImage: checkers = [[checkUint, "src"], [checkUint, "patternWidth"], [checkUint, "patternHeight"], [checkBoolean, "flip"], [checkBoolean, "flop"], [checkKeystoreData, "tokenData"]],
      checksTokenShape: checkers = [[checkColour, "fill"], [checkColour, "stroke"], [checkUint, "strokeWidth"], [checkUint, "fillType"], [checkArray, "fills"]],
      checksCoords: checkers = [[checkObject, ""], [checkInt, "x"], [checkInt, "y"]],
      checksFills: checkers = [[checkObject, ""], [checkByte, "pos"], [checkColour, "colour"]],
      checkToken = (data: any, name = "Token") => {
	checker(data, name, checksToken);
	switch (data.tokenType) {
	case undefined:
	case 0:
		checker(data, name, checksTokenImage);
		for (const c of tokenDataCheckers) {
			c(data.tokenData);
		}
		break;
	case 2:
		checkArray(data.points, name, "points")
		for (const p of data.points) {
			checker(p, "Token->Points", checksCoords);
		}
	case 1:
		checker(data, name, checksTokenShape);
		for (const f of data.fills) {
			checker(f, "Token->Fills", checksFills);
		}
		break;
	default:
		throw new TypeError("invalid Token object, key 'tokenType' contains invalid data");
	}
	return data;
      },
      checksTokenAdd: checkers = [[checkObject, ""], [checkString, "path"], [checkToken, "token"]],
      checkTokenAdd = (data: any) => checker(data, "TokenAdd", checksTokenAdd),
      checksLayerFolder: checkers = [[checkString, "name"], [checkBoolean, "hidden"], [checkArray, "children"]],
      checksLayerTokens: checkers = [[checkString, "name"], [checkBoolean, "hidden"], [checkArray, "tokens"], [checkArray, "walls"]],
      checksLayerGrid: checkers = [[checkBoolean, "hidden"]],
      checkLayerFolder = (data: any, name = "LayerFolder") => {
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
      },
      checksMapStart: checkers = [[checkObject, ""], [checkUint, "startX"], [checkUint, "startY"]],
      checkMapStart = (data: any, name = "MapStart") => checker(data, name, checksMapStart),
      checksMapData: checkers = [[checkMapDetails, ""], [checkMapStart, ""], [checkUint, "gridDistance"], [checkBoolean, "gridDiagonal"], [checkColour, "lightColour"], [checkUint, "lightX"], [checkUint, "lightY"], [checkArray, "children"], [checkLayerFolder, ""], [checkObject, "data"]],
      checkMapData = (data: any) => {
	checker(data, "MapData", checksMapData);
	for (const c of mapDataCheckers) {
		c(data.data);
	}
	return data;
      },
      checksLayerShift: checkers = [[checkObject, ""], [checkString, "path"], [checkInt, "dx"], [checkInt, "dy"]],
      checkLayerShift = (data: any) => checker(data, "LayerShift", checksLayerShift),
      checkLightShift = (data: any) => checker(data, "LightShift", checksCoords),
      checksLightChange: checkers = [[checkObject, ""], [checkString, "path"], [checkUint, "pos"], [checkColour, "lightColour"], [checkUint, "lightIntensity"]],
      checkLightChange = (data: any) => checker(data, "LightChange", checksLightChange),
      checksWall: checkers = [[checkObject, ""], [checkUint, "x1"], [checkUint, "y1"], [checkUint, "x2"], [checkUint, "y2"], [checkColour, "colour"]],
      checkWall = (data: any, name = "Wall") => checker(data, name, checksWall),
      checksWallPath: checkers = [[checkWall, ""], [checkString, "path"]],
      checkWallPath = (data: any) => checker(data, "WallPath", checksWallPath),
      checksMusicTrack: checkers = [[checkObject, ""], [checkUint, "volume"], [checkInt, "repeat"]],
      checkMusicTrack = (data: any) => checker(data, "musicTrack", checksMusicTrack),
      checksMusicPack: checkers = [[checkObject, ""], [checkArray, "tracks"], [checkUint, "volume"], [checkUint, "playTime"]],
      checkMusicPack = (data: any) => {
	checker(data, "musicPack", checksMusicPack);
	for (const t of data["tracks"]) {
		checkMusicTrack(t);
	}
	return data;
      },
      checkMusicPacks = (data: any) => {
	checkObject(data, "musicPacks");
	for (const n in data) {
		checkMusicPack(data[n]);
	}
	return data;
      },
      checksMusicPackObject: checkers = [[checkObject, ""], [checkString, "musicPack"]],
      checkMusicPackObject = (data: any, name = "MusicPackObject") => checker(data, name, checksMusicPackObject), 
      checksMusicPackVolume: checkers = [[checkMusicPackObject, ""], [checkUint, "volume"]],
      checkMusicPackVolume = (data: any) => checker(data, "MusicPackVolume", checksMusicPackVolume),
      checksMusicPackPlay: checkers = [[checkMusicPackObject, ""], [checkUint, "playTime"]],
      checkMusicPackPlay = (data: any) => checker(data, "MusicPackPlay", checksMusicPackPlay),
      checksMusicPackTrackAdd: checkers = [[checkMusicPackObject, ""], [checkArray, "tracks"]],
      checkMusicPackTrackAdd = (data: any) => {
	checker(data, "MusicPackTrackAdd", checksMusicPackTrackAdd);
	for (const t of data["tracks"]) {
		checkUint(t, "MusicPackTrackAdd->Track");
	}
	return data;
      },
      checksMusicPackTrack: checkers = [[checkMusicPackObject, ""], [checkUint, "track"]],
      checkMusicPackTrack = (data: any, name = "MusicPackTrackRemove") => checker(data, name, checksMusicPackTrack),
      checksMusicPackTrackVolume: checkers = [[checkMusicPackTrack, ""], [checkUint, "volume"]],
      checkMusicPackTrackVolume = (data: any) => checker(data, "MusicPackTrackVolume", checksMusicPackTrackVolume),
      checksMusicPackTrackRepeat: checkers = [[checkMusicPackTrack, ""], [checkInt, "repeat"]],
      checkMusicPackTrackRepeat = (data: any) => checker(data, "MusicPackTrackRepeat", checksMusicPackTrackRepeat),
      checkPlugins = (data: any) => {
	checkObject(data, "plugins");
	for (const p in data) {
		checkObject(data, "plugins->plugin", p);
		checkBoolean(data[p]["enabled"], "plugin->enabled", "enabled");
		checkObject(data[p]["data"], "plugin->data", "data");
	}
	return data;
      },
      checksPluginSetting: checkers = [[checkKeystoreDataChange, ""], [checkString, "id"]],
      checkPluginSetting = (data: any) => checker(data, "PluginSetting", checksPluginSetting),
      checkSignalMeasure = (data: any) => {
	if (data === null) {
		return data;
	}
	checkArray(data, "SignalMeasure");
	if (data.length !== 4) {
		throw new TypeError("invalid SignalMeasure array, needs length 4");
	}
	checkUint(data[0], "SignalPosition.x1");
	checkUint(data[1], "SignalPosition.y1");
	checkUint(data[2], "SignalPosition.x2");
	checkUint(data[3], "SignalPosition.y2");
	return data;
      },
      checkSignalPosition = (data: any) => {
	checkArray(data, "SignalPosition");
	if (data.length !== 2) {
		throw new TypeError("invalid SignalPosition array, needs length 2");
	}
	checkUint(data[0], "SignalPosition.x");
	checkUint(data[1], "SignalPosition.y");
	return data;
      },
      checkMask = (data: any) => {
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
		if (data.length !== 4) {
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
      },
      checksMaskSet: checkers = [[checkObject, ""], [checkBoolean, "baseOpaque"], [checkArray, "masks"]],
      checkMaskSet = (data: any) => {
	checker(data, "MaskSet", checksMaskSet);
	for (const mask of data.masks) {
		checkMask(mask);
	}
	return data;
      },
      checksBroadcastWindow: checkers = [[checkID, ""], [checkString, "module"], [checkString, "contents"]],
      checkBroadcastWindow = (data: any) => checker(data, "BroadcastWindow", checksBroadcastWindow),
      checkBroadcast = (data: any) => {
	checkObject(data, "Broadcast");
	if (data["type"] === undefined) {
		throwError("invalid Broadcast object, missing 'type' key");
	}
	return data;
      };
