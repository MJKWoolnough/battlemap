import {RPC as RPCType, InternalWaits, KeystoreData} from './types.js';
import {Subscription} from './lib/inter.js';
import RPC from './lib/rpc_ws.js';
import {handleError, queue, rpcInitSend} from './misc.js';

const broadcastIsAdmin = -1, broadcastCurrentUserMap = -2, broadcastCurrentUserMapData = -3, broadcastMapDataSet = -4, broadcastMapDataRemove = -5, broadcastImageItemAdd = -6, broadcastAudioItemAdd = -7, broadcastCharacterItemAdd = -8, broadcastMapItemAdd = -9, broadcastImageItemMove = -10, broadcastAudioItemMove = -11, broadcastCharacterItemMove = -12, broadcastMapItemMove = -13, broadcastImageItemRemove = -14, broadcastAudioItemRemove = -15, broadcastCharacterItemRemove = -16, broadcastMapItemRemove = -17, broadcastImageItemLink = -18, broadcastAudioItemLink = -19, broadcastCharacterItemLink = -20, broadcastMapItemLink = -21, broadcastImageFolderAdd = -22, broadcastAudioFolderAdd = -23, broadcastCharacterFolderAdd = -24, broadcastMapFolderAdd = -25, broadcastImageFolderMove = -26, broadcastAudioFolderMove = -27, broadcastCharacterFolderMove = -28, broadcastMapFolderMove = -29, broadcastImageFolderRemove = -30, broadcastAudioFolderRemove = -31, broadcastCharacterFolderRemove = -32, broadcastMapFolderRemove = -33, broadcastMapItemChange = -34, broadcastCharacterDataChange = -35, broadcastTokenDataChange = -36, broadcastCharacterDataRemove = -37, broadcastTokenDataRemove = -38, broadcastLayerAdd = -39, broadcastLayerFolderAdd = -40, broadcastLayerMove = -41, broadcastLayerRename = -42, broadcastLayerRemove = -43, broadcastMapLightChange = -44, broadcastLayerShow = -45, broadcastLayerHide = -46, broadcastLayerMaskAdd = -47, broadcastLayerMaskChange = -48, broadcastLayerMaskRemove = -49, broadcastTokenAdd = -50, broadcastTokenRemove = -51, broadcastTokenMoveLayerPos = -52, broadcastTokenSet = -53, broadcastLayerShift = -54, broadcastLightShift = -55, broadcastTokenLightChange = -56, broadcastWallAdd = -57, broadcastWallRemove = -58, broadcastMusicPackAdd = -59, broadcastMusicPackRename = -60, broadcastMusicPackRemove = -61, broadcastMusicPackCopy = -62, broadcastMusicPackVolume = -63, broadcastMusicPackPlay = -64, broadcastMusicPackStop = -65, broadcastMusicPackStopAll = -66, broadcastMusicPackTrackAdd = -67, broadcastMusicPackTrackRemove = -68, broadcastMusicPackTrackVolume = -69, broadcastMusicPackTrackRepeat = -70, broadcastPluginChange = -71, broadcastPluginSettingChange = -72, broadcastAny = -73;

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
addTokenDataChecker = (fn: (data: Record<string, KeystoreData>) => void) => tokenDataCheckers.push(fn);

export default function (url: string): Promise<Readonly<RPCType>>{
	return RPC(url, 1.1).then(arpc => {
		const argProcessors: Record<string, (args: IArguments, names: string[]) => any> = {
			"": () => {},
			"!": (args: IArguments) => args[0],
			"*": (args: IArguments, names: string[]) => Object.fromEntries(names.map((key, pos) => [key, args[pos]]))
		      },
		      waiters: Record<string, [string, number, (data: any) => any][]> ={
			"": [
				["waitCurrentUserMap",       broadcastCurrentUserMap,       checkUint],
				["waitCurrentUserMapData",   broadcastCurrentUserMapData,   checkMapData],
				["waitMapDataSet",           broadcastMapDataSet,           checkMapKeyData],
				["waitMapDataRemove",        broadcastMapDataRemove,        checkString],
				["waitCharacterDataChange",  broadcastCharacterDataChange,  checkCharacterDataChange],
				["waitTokenDataChange",      broadcastTokenDataChange,      checkTokenDataChange],
				["waitMapChange",            broadcastMapItemChange,        checkMapDetails],
				["waitLayerAdd",             broadcastLayerAdd,             checkString],
				["waitLayerFolderAdd",       broadcastLayerFolderAdd,       checkString],
				["waitLayerMove",            broadcastLayerMove,            checkLayerMove],
				["waitLayerRename",          broadcastLayerRename,          checkLayerRename],
				["waitLayerRemove",          broadcastLayerRemove,          checkString],
				["waitMapLightChange",       broadcastMapLightChange,       checkColour],
				["waitLayerShow",            broadcastLayerShow,            checkString],
				["waitLayerHide",            broadcastLayerHide,            checkString],
				["waitLayerMaskAdd",         broadcastLayerMaskAdd,         checkUint],
				["waitLayerMaskChange",      broadcastLayerMaskChange,      checkUint],
				["waitLayerMaskRemove",      broadcastLayerMaskRemove,      checkUint],
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
				["waitBroadcast",            broadcastAny,                  checkBroadcast]
			],
			"images": [
				["waitAdded",         broadcastImageItemAdd,      checkIDName],
				["waitMoved",         broadcastImageItemMove,     checkFromTo],
				["waitRemoved",       broadcastImageItemRemove,   checkString],
				["waitLinked",        broadcastImageItemLink,     checkIDName],
				["waitFolderAdded",   broadcastImageFolderAdd,    checkString],
				["waitFolderMoved",   broadcastImageFolderMove,   checkFromTo],
				["waitFolderRemoved", broadcastImageFolderRemove, checkString]
			],
			"audio": [
				["waitAdded",         broadcastAudioItemAdd,      checkIDName],
				["waitMoved",         broadcastAudioItemMove,     checkFromTo],
				["waitRemoved",       broadcastAudioItemRemove,   checkString],
				["waitLinked",        broadcastAudioItemLink,     checkIDName],
				["waitFolderAdded",   broadcastAudioFolderAdd,    checkString],
				["waitFolderMoved",   broadcastAudioFolderMove,   checkFromTo],
				["waitFolderRemoved", broadcastAudioFolderRemove, checkString]
			],
			"characters": [
				["waitAdded",         broadcastCharacterItemAdd,      checkIDName],
				["waitMoved",         broadcastCharacterItemMove,     checkFromTo],
				["waitRemoved",       broadcastCharacterItemRemove,   checkString],
				["waitLinked",        broadcastCharacterItemLink,     checkIDName],
				["waitFolderAdded",   broadcastCharacterFolderAdd,    checkString],
				["waitFolderMoved",   broadcastCharacterFolderMove,   checkFromTo],
				["waitFolderRemoved", broadcastCharacterFolderRemove, checkString]
			],
			"maps": [
				["waitAdded",         broadcastMapItemAdd,      checkIDName],
				["waitMoved",         broadcastMapItemMove,     checkFromTo],
				["waitRemoved",       broadcastMapItemRemove,   checkString],
				["waitLinked",        broadcastMapItemLink,     checkIDName],
				["waitFolderAdded",   broadcastMapFolderAdd,    checkString],
				["waitFolderMoved",   broadcastMapFolderMove,   checkFromTo],
				["waitFolderRemoved", broadcastMapFolderRemove, checkString]
			]
		      },
		      endpoints: Record<string, [string, string, string | string[], (data: any) => any, string, string][]> ={
			"": [
				["connID", "conn.connID", "", checkUint , "", ""],
				["ready", "conn.ready"  , "", returnVoid, "", ""],

				["setCurrentMap", "maps.setCurrentMap", "!", returnVoid,   "", ""],
				["getUserMap",    "maps.getUserMap",    "",  checkUint,    "", ""],
				["setUserMap",    "maps.setUserMap",    "!", returnVoid,   "waitCurrentUserMap", ""],
				["getMapData",    "maps.getMapData",    "!", checkMapData, "", ""],

				["newMap",           "maps.new",            "!",            checkIDName, "", ""],
				["setMapDetails",    "maps.setMapDetails",  "!",            returnVoid,  "waitMapChange", ""],
				["setLightColour",   "maps.setLightColour", "!",            returnVoid,  "waitMapLightChange", ""],
				["setMapKeyData",    "maps.setData",       ["key", "data"], returnVoid,  "waitMapDataSet", ""],
				["removeMapKeyData", "maps.removeData",     "!",            returnVoid,  "waitMapDataRemove", ""],

				["addLayer",         "maps.addLayer",        "!",                                            checkString,      "waitLayerAdd", "*"],
				["addLayerFolder",   "maps.addLayerFolder",  "!",                                            checkString,      "waitLayerFolderAdd", "*"],
				["renameLayer",      "maps.renameLayer",    ["path", "name"],                                checkLayerRename, "waitLayerRename", "*"],
				["moveLayer",        "maps.moveLayer",      ["from", "to", "position"],                      returnVoid,       "waitLayerMove", ""],
				["showLayer",        "maps.showLayer",       "!",                                            returnVoid,       "waitLayerShow", ""],
				["hideLayer",        "maps.hideLayer",       "!",                                            returnVoid,       "waitLayerHide", ""],
				["addMask",          "maps.addMask",        ["path", "mask"],                                returnVoid,       "", ""],
				["removeMask",       "maps.removeMask",      "!",                                            returnVoid,       "", ""],
				["removeLayer",      "maps.removeLayer",     "!",                                            returnVoid,       "waitLayerRemove", ""],
				["addToken",         "maps.addToken",       ["path", "token"],                               checkUint,        "waitTokenAdd", "token/id"],
				["removeToken",      "maps.removeToken",     "!",                                            returnVoid,       "waitTokenRemove", ""],
				["setToken",         "maps.setToken",        "!",                                            returnVoid,       "waitTokenSet", ""],
				["setTokenLayerPos", "maps.setTokenLayer",  ["id", "to", "newPos"],                          returnVoid,       "waitTokenMoveLayerPos", ""],
				["shiftLayer",       "maps.shiftLayer",     ["path", "dx", "dy"],                            returnVoid,       "waitLayerShift", ""],
				["shiftLight",       "maps.shiftLight",     ["x", "y"],                                      returnVoid,       "waitLightShift", ""],
				["setTokenLight",    "maps.setTokenLight",  ["id", "lightColour", "lightIntensity"],         returnVoid,       "waitTokenLightChange", ""],
				["addWall",          "maps.addWall",        ["path", "x1", "y1", "x2", "y2", "colour"],      checkUint,        "waitWallAdded", "id"],
				["removeWall",       "maps.removeWall",      "!",                                            returnVoid,       "waitWallRemoved", ""],

				["musicPackList",            "music.list",            "",                              checkMusicPacks, "", ""],
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
				["musicPackVolume",      "music.setTrackVolume", ["musicPack", "track", "volume"], returnVoid,      "waitMusicPackTrackVolume", ""],
				["musicPackRepeat",      "music.setTrackRepeat", ["musicPack", "track", "repeat"], returnVoid,      "waitMusicPackTrackRepeat", ""],

				["characterCreate", "characters.create", ["path", "data"],              checkIDName,       "", ""],
				["characterModify", "characters.set",    ["id", "setting", "removing"], returnVoid,        "waitCharacterDataChange", ""],
				["characterGet",    "characters.get",     "!",                          checkCharacter,    "", ""],

				["tokenModify", "maps.modifyTokenData", ["id", "setting", "removing"], returnVoid, "waitTokenDataChange", ""],

				["listPlugins",   "plugins.list",    "",              checkPlugins, "", ""],
				["enablePlugin",  "plugins.enable",  "!",             returnVoid,   "", ""],
				["disablePlugin", "plugins.disable", "!",             returnVoid,   "", ""],
				["pluginSetting", "plugins.set",    ["file", "data"], returnVoid,   "", ""],

				["loggedIn",          "auth.loggedIn",        "",                            checkBoolean, "", ""],
				["loginRequirements", "auth.requirements",    "",                            checkString,  "", ""],
				["login",             "auth.login",           "!",                           checkString,  "", ""],
				["changePassword",    "auth.changePassword", ["oldPassword", "newPassword"], checkString,  "", ""],
				["logout",            "auth.logout",          "",                            returnVoid,   "", ""],

				["broadcast", "broadcast", "!", returnVoid, "waitBroadcast", ""],
			],
			"images": [
				["list",         "imageAssets.list",         "",             checkFolderItems, "", ""],
				["createFolder", "imageAssets.createFolder", "!",            checkString,      "waitFolderAdded", "*"],
				["move",         "imageAssets.move",         ["from", "to"], checkString,      "waitMoved", "to"],
				["moveFolder",   "imageAssets.moveFolder",   ["from", "to"], checkString,      "waitFolderMoved", "to"],
				["remove",       "imageAssets.remove",       "!",            returnVoid,       "waitRemoved", ""],
				["removeFolder", "imageAssets.removeFolder", "!",            returnVoid,       "waitFolderRemoved", ""],
				["link",         "imageAssets.link",         ["id", "name"], checkString,      "waitLinked", "name"]
			],
			"audio": [
				["list",         "audioAssets.list",         "",             checkFolderItems, "", ""],
				["createFolder", "audioAssets.createFolder", "!",            checkString,      "waitFolderAdded", ""],
				["move",         "audioAssets.move",         ["from", "to"], checkString,      "waitMoved", "to"],
				["moveFolder",   "audioAssets.moveFolder",   ["from", "to"], checkString,      "waitFolderMoved", "to"],
				["remove",       "audioAssets.remove",       "!",            returnVoid,       "waitRemoved", ""],
				["removeFolder", "audioAssets.removeFolder", "!",            returnVoid,       "waitFolderRemoved", ""],
				["link",         "audioAssets.link",         ["id", "name"], checkString,      "waitLinked", "name"]
			],
			"characters": [
				["list",         "characters.list",         "",             checkFolderItems, "", ""],
				["createFolder", "characters.createFolder", "!",            checkString,      "waitFolderAdded", ""],
				["move",         "characters.move",         ["from", "to"], checkString,      "waitMoved", "to"],
				["moveFolder",   "characters.moveFolder",   ["from", "to"], checkString,      "waitFolderMoved", "to"],
				["remove",       "characters.remove",       "!",            returnVoid,       "waitRemoved", ""],
				["removeFolder", "characters.removeFolder", "!",            returnVoid,       "waitFolderRemoved", ""],
				["link",         "characters.link",         ["id", "name"], checkString,      "waitLinked", "name"]
			],
			"maps": [
				["list",         "maps.list",         "",             checkFolderItems, "", ""],
				["createFolder", "maps.createFolder", "!",            checkString,      "waitFolderAdded", ""],
				["move",         "maps.move",         ["from", "to"], checkString,      "waitMoved", "to"],
				["moveFolder",   "maps.moveFolder",   ["from", "to"], checkString,      "waitFolderMoved", "to"],
				["remove",       "maps.remove",       "!",            returnVoid,       "waitRemoved", ""],
				["removeFolder", "maps.removeFolder", "!",            returnVoid,       "waitFolderRemoved", ""],
				["link",         "maps.link",         ["id", "name"], checkString,      "waitLinked", "name"]
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
					ik[name] = Subscription.splitCancel(new Subscription(successFn => fn = successFn));
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
				arpc.await(broadcastID, true).then(checker).then(data => queue(async function() {
					fn(data);
				}));
				rk[name] = () => waiter;
				if (ik[name]) {
					ck[name] = Subscription.splitCancel(Subscription.merge(rk[name](), ik[name]()));
				} else {
					ik[name] = pseudoWait;
					ck[name] = rk[name];
				}
			}
		}
		rpc.waitLogin = () => arpc.await(broadcastIsAdmin).then(checkUint);
		rpcInitSend();
		return Object.freeze(rpc);
	});
}

type checkers = [(data: any, name: string, key?: string) => void, string][];

const mapDataCheckers: ((data: Record<string, any>) => void)[] = [],
      tokenDataCheckers: ((data: Record<string, KeystoreData>) => void)[] = [],
      characterDataCheckers: ((data: Record<string, KeystoreData>) => void)[] = [],
      returnVoid = () => {},
      throwError = (err: string) => {throw new TypeError(err)},
      checkInt = (data: any, name = "Int", key = "") => {
	if (typeof data !== "number" || data % 1 !== 0) {
		throwError(key ? `invalid ${name} object, key '${key}' contains an invalid Int: ${JSON.stringify(data)}` : `expecting Int type, got ${JSON.stringify(data)}`);
	}
      },
      checkUint = (data: any, name = "Uint", key = "", max = Number.MAX_SAFE_INTEGER) => {
	if (typeof data !== "number" || data % 1 !== 0 || data < 0 || data > max) {
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
      checksFromTo: checkers = [[checkObject, ""], [checkString, "from"], [checkString, "to"]],
      checkFromTo = (data: any, name = "FromTo") => checker(data, name, checksFromTo),
      checksLayerMove: checkers = [[checkID, ""], [checkString, "to"]],
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
      checkKeystoreData = (data: any, name = "KeystoreData", key = "") => {
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
      checksWallPos: checkers = [[checkObject, ""], [checkString, "path"], [checkUint, "pos"]],
      checkWallPos = (data: any, name = "TokenPos") => checker(data, name, checksWallPos),
      checksTokenChange: checkers = [[checkID, ""], [checkInt, "x"], [checkInt, "y"], [checkUint, "width"], [checkUint, "height"], [checkByte, "rotation"]],
      checkTokenChange = (data: any) => checker(data, "TokenChange", checksTokenChange),
      checksTokenMovePos: checkers = [[checkID, ""], [checkUint, "newPos"]],
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
      checksTokenFlip: checkers = [[checkID, ""], [checkBoolean, "flip"]],
      checkTokenFlip = (data: any) =>  checker(data, "TokenFlip", checksTokenFlip),
      checksTokenFlop: checkers = [[checkID, ""], [checkBoolean, "flop"]],
      checkTokenFlop = (data: any) =>  checker(data, "TokenFlip", checksTokenFlop),
      checksTokenSnap: checkers = [[checkID, ""], [checkBoolean, "snap"]],
      checkTokenSnap = (data: any) =>  checker(data, "TokenFlip", checksTokenSnap),
      checksTokenSource: checkers = [[checkID, ""], [checkString, "source"]],
      checkTokenSource = (data: any) =>  checker(data, "TokenFlip", checksTokenSource),
      checksToken: checkers = [[checkObject, ""], [checkInt, "x"], [checkInt, "y"], [checkUint, "width"], [checkUint, "height"], [checkByte, "rotation"], [checkBoolean, "snap"], [checkColour, "lightColour"], [checkUint, "lightIntensity"]],
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
      checksTokenAdd: checkers = [[checkID, ""], [checkString, "path"], [checkToken, "token"]],
      checkTokenAdd = (data: any) => checker(data, "TokenAdd", checksTokenAdd),
      checksLayerFolder: checkers = [[checkString, "name"], [checkBoolean, "hidden"], [checkArray, "children"]],
      checksLayerTokens: checkers = [[checkString, "name"], [checkBoolean, "hidden"], [checkUint, "mask"], [checkArray, "tokens"], [checkArray, "walls"]],
      checksLayerGrid: checkers = [[checkBoolean, "hidden"], [checkUint, "mask"]],
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
      checksMapData: checkers = [[checkMapDetails, ""], [checkColour, "lightColour"], [checkUint, "lightX"], [checkUint, "lightY"], [checkArray, "children"], [checkLayerFolder, ""], [checkObject, "data"]],
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
      checksPluginSetting: checkers = [[checkObject, ""], [checkString, "name"], [checkObject, "data"]],
      checkPluginSetting = (data: any) => checker(data, "PluginSetting", checksPluginSetting),
      checkBroadcast = (data: any) => {
	checkObject(data, "Broadcast");
	if (data["type"] === undefined) {
		throwError("invalid Broadcast object, missing 'type' key");
	}
	return data;
      };
