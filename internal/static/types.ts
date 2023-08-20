import type {Subscription} from './lib/inter.js';
import type {TypeGuard, TypeGuardOf} from './lib/typeguard.js';
import {And, Any, Arr, Bool, Int, Obj, Opt, Or, Part, Rec, Recur, Str, Tuple, Val} from './lib/typeguard.js';
import {isColour} from './colours.js';

export type Int = number;
export type Uint = number;
export type Byte = number;
type Colour = TypeGuardOf<typeof isColour>;

export const isInt = Int(),
      isUint = Int(0),
      isByte = Int(0, 255),
      isBool = Bool(),
      isStr = Str();

type FolderWaits = {
	waitAdded:         () => Subscription<IDName[]>;
	waitMoved:         () => Subscription<FromTo>;
	waitRemoved:       () => Subscription<string>;
	waitCopied:        () => Subscription<Copy>;
	waitFolderAdded:   () => Subscription<string>;
	waitFolderMoved:   () => Subscription<FromTo>;
	waitFolderRemoved: () => Subscription<string>;
}

export type FolderRPC = FolderWaits & {
	list:         ()                         => Promise<FolderItems>;
	createFolder: (path: string)             => Promise<string>;
	move:         (from: string, to: string) => Promise<string>;
	moveFolder:   (from: string, to: string) => Promise<string>;
	remove:       (path: string)             => Promise<void>;
	removeFolder: (path: string)             => Promise<void>;
	copy:         (id: Uint, path: string)   => Promise<IDPath>;
}

export type LayerRPC = Readonly<FolderRPC & {
	waitLayerSetVisible:     () => Subscription<string>;
	waitLayerSetInvisible:   () => Subscription<string>;
	waitLayerSetLock:        () => Subscription<string>;
	waitLayerSetUnlock   :   () => Subscription<string>;
	waitLayerPositionChange: () => Subscription<LayerMove>;
	waitLayerRename:         () => Subscription<LayerRename>;
	waitLayerSelect:         () => Subscription<string>;
}>;

export type RPCWaits = {
	waitCurrentUserMap:       () => Subscription<Uint>;
	waitCurrentUserMapData:   () => Subscription<MapData>;
	waitMapDataSet:           () => Subscription<KeyData>;
	waitMapDataRemove:        () => Subscription<string>;
	waitCharacterDataChange:  () => Subscription<CharacterDataChange>;
	waitMapChange:            () => Subscription<MapDetails>;
	waitMapStartChange:       () => Subscription<MapStart>;
	waitLayerAdd:             () => Subscription<string>;
	waitLayerFolderAdd:       () => Subscription<string>;
	waitLayerMove:            () => Subscription<LayerMove>;
	waitLayerRename:          () => Subscription<LayerRename>;
	waitLayerRemove:          () => Subscription<string>;
	waitGridDistanceChange:   () => Subscription<Uint>;
	waitGridDiagonalChange:   () => Subscription<boolean>;
	waitMapLightChange:       () => Subscription<Colour>;
	waitLayerShow:            () => Subscription<string>;
	waitLayerHide:            () => Subscription<string>;
	waitLayerLock:            () => Subscription<string>;
	waitLayerUnlock:          () => Subscription<string>;
	waitMaskAdd:              () => Subscription<Mask>;
	waitMaskRemove:           () => Subscription<Uint>;
	waitMaskSet:              () => Subscription<MaskSet>;
	waitTokenAdd:             () => Subscription<TokenAdd>;
	waitTokenRemove:          () => Subscription<Uint>;
	waitTokenMoveLayerPos:    () => Subscription<TokenMoveLayerPos>;
	waitTokenSet:             () => Subscription<TokenSet>;
	waitTokenSetMulti:        () => Subscription<TokenSet[]>;
	waitLayerShift:           () => Subscription<LayerShift>;
	waitWallAdded:            () => Subscription<WallPath>;
	waitWallRemoved:          () => Subscription<Uint>;
	waitWallModified:         () => Subscription<Wall>;
	waitWallMoved:            () => Subscription<IDPath>;
	waitMusicPackAdd:         () => Subscription<IDName>;
	waitMusicPackRename:      () => Subscription<IDName>;
	waitMusicPackRemove:      () => Subscription<Uint>;
	waitMusicPackCopy:        () => Subscription<IDName & {newID: Uint}>;
	waitMusicPackVolume:      () => Subscription<MusicPackVolume>;
	waitMusicPackPlay:        () => Subscription<MusicPackPlay>;
	waitMusicPackStop:        () => Subscription<Uint>;
	waitMusicPackStopAll:     () => Subscription<void>;
	waitMusicPackTrackAdd:    () => Subscription<MusicPackTrackAdd>;
	waitMusicPackTrackRemove: () => Subscription<MusicPackTrackRemove>;
	waitMusicPackTrackVolume: () => Subscription<MusicPackTrackVolume>;
	waitMusicPackTrackRepeat: () => Subscription<MusicPackTrackRepeat>;
	waitPluginChange:         () => Subscription<void>;
	waitPluginSetting:        () => Subscription<PluginDataChange>;
	waitSignalMeasure:        () => Subscription<[Uint, Uint, Uint, Uint, ...Uint[]] | null>;
	waitSignalPosition:       () => Subscription<[Uint, Uint]>;
	waitSignalMovePosition:   () => Subscription<[Uint, Uint]>;
	waitBroadcastWindow:      () => Subscription<BroadcastWindow>;
	waitBroadcast:            () => Subscription<Broadcast>;
}

export type InternalWaits = RPCWaits & {
	images:     FolderWaits;
	audio:      FolderWaits;
	characters: FolderWaits;
	maps:       FolderWaits;
}

export type RPC = RPCWaits & {
	images:     FolderRPC;
	audio:      FolderRPC;
	characters: FolderRPC;
	maps:       FolderRPC;

	ready:       () => Promise<void>;

	setCurrentMap: (id: Uint) => Promise<void>;
	getUserMap:    ()         => Promise<Uint>;
	setUserMap:    (id: Uint) => Promise<void>;
	getMapData:    (id: Uint) => Promise<MapData>;

	newMap:           (map: NewMap)             => Promise<IDName>;
	setMapDetails:    (map: GridDetails)        => Promise<void>;
	setMapStart:      (start: MapStart)         => Promise<void>;
	setGridDistance:  (distance: Uint)          => Promise<void>;
	setGridDiagonal:  (diagonal: boolean)       => Promise<void>;
	setLightColour:   (c: Colour)               => Promise<void>;
	setMapKeyData:    (key: string, value: any) => Promise<void>;
	removeMapKeyData: (key: string)             => Promise<void>;

	signalMeasure:      (pos: [Uint, Uint, Uint, Uint, ...Uint[]] | null) => Promise<void>;
	signalPosition:     (pos: [Uint, Uint])                               => Promise<void>;
	signalMovePosition: (pos: [Uint, Uint])                               => Promise<void>;

	addLayer:         (name: string)                             => Promise<string>;
	addLayerFolder:   (path: string)                             => Promise<string>;
	renameLayer:      (path: string, name: string)               => Promise<LayerRename>;
	moveLayer:        (from: string, to: string, position: Uint) => Promise<void>;
	showLayer:        (path: string)                             => Promise<void>;
	hideLayer:        (path: string)                             => Promise<void>;
	lockLayer:        (path: string)                             => Promise<void>;
	unlockLayer:      (path: string)                             => Promise<void>;
	removeLayer:      (path: string)                             => Promise<void>;
	addToMask:        (mask: Mask)                               => Promise<void>;
	removeFromMask:   (mask: Uint)                               => Promise<void>;
	setMask:          (baseOpaque: boolean, masks: Mask[])       => Promise<void>;
	addToken:         (path: string, token: Token, pos?: Uint)   => Promise<Uint>;
	removeToken:      (id: Uint)                                 => Promise<void>;
	setToken:         (t: TokenSet)                              => Promise<void>;
	setTokenMulti:    (t: TokenSet[])                            => Promise<void>;
	setTokenLayerPos: (id: Uint, to: string, newPos: Uint)       => Promise<void>;
	shiftLayer:       (path: string, dx: Int, dy: Int)           => Promise<void>;
	addWall:          (path: string, wall: Wall)                 => Promise<Uint>;
	removeWall:       (id: Uint)                                 => Promise<void>;
	modifyWall:       (w: Wall)                                  => Promise<void>;
	moveWall:         (id: Uint, path: string)                   => Promise<void>;

	musicPackList:        ()                                           => Promise<MusicPack[]>;
	musicPackAdd:         (name: string)                               => Promise<IDName>;
	musicPackRename:      (id: Uint, name: string)                     => Promise<string>;
	musicPackRemove:      (id: Uint)                                   => Promise<void>;
	musicPackCopy:        (id: Uint, name: string)                     => Promise<IDName>;
	musicPackSetVolume:   (musicPack: Uint, volume: Uint)              => Promise<void>;
	musicPackPlay:        (musicPack: Uint, playTime: Uint)            => Promise<Uint>;
	musicPackStop:        (musicPack: Uint)                            => Promise<void>;
	musicPackStopAll:     ()                                           => Promise<void>;
	musicPackTrackAdd:    (musicPack: Uint, tracks: Uint[])            => Promise<void>;
	musicPackTrackRemove: (musicPack: Uint, track: Uint)               => Promise<void>;
	musicPackTrackVolume: (musicPack: Uint, track: Uint, volume: Uint) => Promise<void>;
	musicPackTrackRepeat: (musicPack: Uint, track: Uint, repeat: Int)  => Promise<void>;

	characterCreate:     (path: string, data: Record<string, KeystoreData>)                    => Promise<IDPath>;
	characterModify:     (id: Uint, setting: Record<string, KeystoreData>, removing: string[]) => Promise<void>;
	characterGet:        (id: Uint)                                                            => Promise<Record<string, KeystoreData>>;

	listPlugins:   ()                                                                      => Promise<Record<string, Plugin>>;
	enablePlugin:  (plugin: string)                                                        => Promise<void>;
	disablePlugin: (plugin: string)                                                        => Promise<void>;
	pluginSetting: (id: string, setting: Record<string, KeystoreData>, removing: string[]) => Promise<void>;

	broadcastWindow: (module: string, id: Uint, contents: string) => Promise<void>;
	broadcast:       (data: Broadcast)                            => Promise<void>;
}

export const isKeystoreData = Obj({
	user: isBool,
	data: Any()
}),
isKeystore = Rec(isStr, isKeystoreData),
isPlugin = Obj({
	enabled: isBool,
	data: Rec(isStr, isKeystoreData)
}),
isID = Obj({
	id: isUint
}),
isIDName = Obj({
	id: isUint,
	name: isStr
}),
isWidthHeight = Obj({
	width: isUint,
	height: isUint
}),
isTokenLight = Obj({
	lightColours: Arr(Arr(isColour)),
	lightStages: Arr(isUint),
	lightTimings: Arr(isUint)
}),
isTokenShared = And(isTokenLight, isID, isWidthHeight, Obj({
	x: isInt,
	y: isInt,
	rotation: isByte,
	tokenType: Opt(isUint),
	tokenData: Rec(isStr, isKeystoreData)
})),
isTokenImage = And(isTokenShared, Obj({
	src: isUint,
	patternWidth: isUint,
	patternHeight: isUint,
	flip: isBool,
	flop: isBool
})),
isTokenShape = And(isTokenShared, Obj({
	fill: isColour,
	stroke: isColour,
	strokeWidth: isUint,
	isEllipse: Opt(isBool)
})),
isCoords = Obj({
	x: isInt,
	y: isInt
}),
isTokenDrawing = And(isTokenShape, Obj({
	points: Arr(isCoords)
})),
isToken = Or(isTokenImage, isTokenShape, isTokenDrawing),
isWallData = Obj({
	x1: isInt,
	y1: isInt,
	x2: isInt,
	y2: isInt,
	colour: isColour,
	scattering: isByte
}),
isWall = And(isID, isWallData),
isLayerTokens = And(isIDName, Obj({
	hidden: isBool,
	locked: isBool,
	tokens: Arr(isToken),
	walls: Arr(isWall)
})),
isFolderItems: TypeGuard<FolderItems> = Obj({
	folder: Rec(isStr, Recur(() => isFolderItems)),
	items: Rec(isStr, isUint)
}),
isLayerFolder: TypeGuard<LayerFolder> = And(isFolderItems, isIDName, Obj({
	hidden: isBool,
	locked: isBool,
	children: Arr(Or(isLayerTokens, Recur(() => isLayerFolder)))
})),
isMask = Or(Tuple(Or(Val(0), Val(1), Val(2), Val(3)), isUint, isUint, isUint, isUint), Tuple(Or(Val(4), Val(5)), isUint, isUint, isUint, isUint, isUint, isUint, ...isUint)),
isMaskSet = Obj({
	baseOpaque: isBool,
	masks: Arr(isMask)
}),
isGridDetails = Obj({
	gridType: isByte,
	gridSize: isUint,
	gridStroke: isUint,
	gridColour: isColour
}),
isMapDetails = And(isGridDetails, isWidthHeight),
isMapData = And(isLayerFolder, isMapDetails, isMaskSet, Obj({
	startX: isUint,
	startY: isUint,
	gridDistance: isUint,
	gridDiagonal: isBool,
	lightColor: isColour,
	data: Rec(isStr, Any())
})),
isFromTo = Obj({
	from: isStr,
	to: isStr
}),
isNewMap = And(isMapDetails, Obj({
	name: isStr
})),
isTokenSet = And(Part(isTokenImage), Part(isTokenDrawing), isID, Obj({
	removeTokenData: Opt(Arr(isStr))
})),
isCharacterToken = And(isTokenLight, isWidthHeight, Obj({
	src: isUint,
	patternWidth: isUint,
	patternHeight: isUint,
	rotation: isByte,
	flip: isBool,
	blop: isBool,
	snap: isBool,
	tokenData: Rec(isStr, isKeystoreData)
})),
isWallPath = Obj({
	path: isStr,
	wall: isWall
}),
isLayerMove = And(isFromTo, Obj({
	position: isUint
})),
isBroadcastWindow = And(isID, Obj({
	module: isStr,
	contents: isStr
})),
isBroadcast = Obj({
	type: Any(),
	data: Any()
}),
isLayerRename = Obj({
	path: isStr,
	name: isStr
}),
isTokenAdd = Obj({
	path: isStr,
	token: isToken,
	pos: Opt(isUint)
}),
isTokenMoveLayerPos = And(isID, Obj({
	to: isStr,
	newPos: isUint
})),
isLayerShift = Obj({
	path: isStr,
	dx: isInt,
	dy: isInt
}),
isKeystoreDataChange = Obj({
	setting: Rec(isStr, isKeystoreData),
	remove: Arr(isStr)
}),
isCharacterDataChange = And(isID, isKeystoreDataChange),
isPluginDataChange = And(isKeystoreDataChange, Obj({
	id: isStr
})),
isKeyData = Obj({
	key: isStr,
	data: Any()
}),
isMusicTrack = And(isID, Obj({
	volume: isUint,
	repeat: isInt
})),
isMusicPack = And(isIDName, Obj({
	tracks: Arr(isMusicTrack),
	volume: isUint,
	playTime: isUint
})),
isMusicPackVolume = And(isID, Obj({
	volume: isUint
})),
isMusicPackPlay = And(isID, Obj({
	playTime: isUint
})),
isMusicPackTrackAdd = And(isID, Obj({
	tracks: Arr(isUint)
})),
isMusicPackTrackRemove = And(isID, Obj({
	track: isUint
})),
isMusicPackTrackVolume = And(isID, Obj({
	track: isUint,
	volume: isUint
})),
isMusicPackTrackRepeat = And(isID, Obj({
	track: isUint,
	repeat: isInt
})),
isIDPath = And(isID, Obj({
	path: isStr
})),
isMapStart = Tuple(isUint, isUint),
isCopy = Obj({
	oldID: isUint,
	newID: isUint,
	path: isStr
});

export type Copy = TypeGuardOf<typeof isCopy>;

export type Keystore = TypeGuardOf<typeof isKeystore>;

export type KeystoreData<T = any> = {
	user: boolean;
	data: T;
}

export type Plugin = TypeGuardOf<typeof isPlugin>;

export type ID = TypeGuardOf<typeof isID>;

export type IDName = TypeGuardOf<typeof isIDName>;

export type WidthHeight = TypeGuardOf<typeof isWidthHeight>;

export type TokenLight = TypeGuardOf<typeof isTokenLight>;

export type TokenImage = TypeGuardOf<typeof isTokenImage>;

export type TokenShape = TypeGuardOf<typeof isTokenShape>;

export type Coords = TypeGuardOf<typeof isCoords>;

export type TokenDrawing = TypeGuardOf<typeof isTokenDrawing>;

export type Token = TypeGuardOf<typeof isToken>;

export type Wall = TypeGuardOf<typeof isWall>;

export type LayerTokens = TypeGuardOf<typeof isLayerTokens>;

export type FolderItems = {
	folders: Record<string, FolderItems>;
	items:  Record<string, Uint>;
}

export type LayerFolder = FolderItems & IDName & {
	hidden: boolean;
	locked: boolean;
	children: (LayerTokens | LayerFolder)[];
}
export type Mask = TypeGuardOf<typeof isMask>;

export type MaskSet = TypeGuardOf<typeof isMaskSet>;

export type GridDetails = TypeGuardOf<typeof isGridDetails>;

export type MapDetails = TypeGuardOf<typeof isMapDetails>;

export type MapData = TypeGuardOf<typeof isMapData>;

export type FromTo = TypeGuardOf<typeof isFromTo>;

export type NewMap = TypeGuardOf<typeof isNewMap>;

export type TokenSet = TypeGuardOf<typeof isTokenSet>;

export type CharacterToken = TypeGuardOf<typeof isCharacterToken>;

export type WallPath = TypeGuardOf<typeof isWallPath>;

export type LayerMove = TypeGuardOf<typeof isLayerMove>;

export type BroadcastWindow = TypeGuardOf<typeof isBroadcastWindow>;

export type Broadcast = TypeGuardOf<typeof isBroadcast>;

export type LayerRename = TypeGuardOf<typeof isLayerRename>;

export type TokenAdd = TypeGuardOf<typeof isTokenAdd>;

export type TokenMoveLayerPos = TypeGuardOf<typeof isTokenMoveLayerPos>;

export type LayerShift = TypeGuardOf<typeof isLayerShift>;

export type KeystoreDataChange = TypeGuardOf<typeof isKeystoreDataChange>;

export type CharacterDataChange = TypeGuardOf<typeof isCharacterDataChange>;

export type PluginDataChange = TypeGuardOf<typeof isPluginDataChange>;

export type KeyData = TypeGuardOf<typeof isKeyData>;

export type MusicTrack = TypeGuardOf<typeof isMusicTrack>;

export type MusicPack = TypeGuardOf<typeof isMusicPack>;

export type MusicPackVolume = TypeGuardOf<typeof isMusicPackTrackVolume>;

export type MusicPackPlay = TypeGuardOf<typeof isMusicPackPlay>;

export type MusicPackTrackAdd = TypeGuardOf<typeof isMusicPackTrackAdd>;

export type MusicPackTrackRemove = TypeGuardOf<typeof isMusicPackTrackRemove>;

export type MusicPackTrackVolume = TypeGuardOf<typeof isMusicPackTrackVolume>;

export type MusicPackTrackRepeat = TypeGuardOf<typeof isMusicPackTrackRepeat>;

export type IDPath = TypeGuardOf<typeof isIDPath>;

export type MapStart = TypeGuardOf<typeof isMapStart>;
