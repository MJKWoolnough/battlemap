import type {Subscription} from './lib/inter.js';
import type {TypeGuardOf} from './lib/typeguard.js';
import {Any, Int, Str, Obj} from './lib/typeguard.js';
import {isColour} from './colours.js';

export type Int = number;
export type Uint = number;
export type Byte = number;
type Colour = TypeGuardOf<typeof isColour>;

const isInt = Int(),
      isUint = Int(0),
      isByte = Int(0, 255);

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

export type MapData = LayerFolder & MapDetails & MaskSet & {
	startX: Uint;
	startY: Uint;
	gridDistance: Uint;
	gridDiagonal: boolean;
	lightColour: Colour;
	data: Record<string, any>;
}

export const isIDName = Obj({
	id: isUint,
	name: Str()
});

export type IDName = TypeGuardOf<typeof isIDName>;

export const isFromTo = Obj({
	from: Str(),
	to: Str()
});

export type FromTo = TypeGuardOf<typeof isFromTo>;

export const isWidthHeight = Obj({
	width: isUint,
	height: isUint,
});

export type WidthHeight = TypeGuardOf<typeof isWidthHeight>;

export type FolderItems = {
	folders: Record<string, FolderItems>;
	items:  Record<string, Uint>;
}

export type MapDetails = GridDetails & WidthHeight;

type NewMap = MapDetails & {
	name: string;
}

export const isGridDetails = Obj({
	gridType: isByte,
	gridSize: isUint,
	gridStroke: isUint,
	gridColour: isColour
});

export type GridDetails = TypeGuardOf<typeof isGridDetails>;

export type Token = TokenImage | TokenShape | TokenDrawing;

type TokenShared = TokenLight & ID & WidthHeight & {
	x:          Int;
	y:          Int;
	rotation:   Byte;
	tokenType?: Uint;
	snap:       boolean;
	tokenData:  Record<string, KeystoreData>;
}

export type TokenImage = TokenShared & {
	src:           Uint;
	patternWidth:  Uint;
	patternHeight: Uint;
	flip:        boolean;
	flop:        boolean;
}

export type TokenShape = TokenShared & {
	fill:        Colour;
	stroke:      Colour;
	strokeWidth: Uint;
	isEllipse?:  boolean;
}

export type TokenDrawing = TokenShape & {
	points: Coords[];
}

export const isCoords = Obj({
	x: isInt,
	y: isInt
});

export type Coords = TypeGuardOf<typeof isCoords>;

export type TokenSet = Partial<TokenImage> & Partial<TokenDrawing> & ID & {
	removeTokenData?: string[];
}

export type CharacterToken = TokenLight & WidthHeight & {
	src: Uint;
	patternWidth: Uint;
	patternHeight: Uint;
	rotation: Byte;
	flip: boolean;
	flop: boolean;
	snap: boolean;
	tokenData: Record<string, KeystoreData>;
}

export type LayerTokens = IDName & {
	hidden: boolean;
	locked: boolean;
	tokens: Token[];
	walls: Wall[];
}

export type LayerFolder = FolderItems & IDName & {
	hidden: boolean;
	locked: boolean;
	children: (LayerTokens | LayerFolder)[];
}

export type LayerMove = FromTo & {
	position: Uint;
}

export type BroadcastWindow = ID & {
	module: string;
	contents: string;
}

export const isBroadcast = Obj({
	type: Any(),
	data: Any()
});

export type Broadcast = TypeGuardOf<typeof isBroadcast>;

export const isLayerRename = Obj({
	path: Str(),
	name: Str()
});

export type LayerRename = TypeGuardOf<typeof isLayerRename>;

export const isID = Obj({
	id: isUint
});

export type ID = TypeGuardOf<typeof isID>;

export type TokenAdd = {
	path: string;
	token: Token;
	pos?: Uint;
}

export type TokenMoveLayerPos = ID & {
	to: string;
	newPos: Uint;
}

export const isLayerShift = Obj({
	path: Str(),
	dx: isInt,
	dy: isInt
});

export type LayerShift = TypeGuardOf<typeof isLayerShift>;

export type KeystoreData<T = any> = {
	user: boolean;
	data: T;
}

export type KeystoreDataChange = {
	setting: Record<string, KeystoreData>;
	removing: string[];
}

export type CharacterDataChange = ID & KeystoreDataChange;

export const isWallData = Obj({
	x1: isInt,
	y1: isInt,
	x2: isInt,
	y2: isInt,
	colour: isColour,
	scattering: isByte
});

type WallData = TypeGuardOf<typeof isWallData>;

export type Wall = WallData & ID;

export type WallPath = {
	path: string;
	wall: Wall;
}

export type TokenLight = {
	lightColours: Colour[][];
	lightStages: Uint[];
	lightTimings: Uint[];
}

export type Plugin = {
	enabled: boolean;
	data: Record<string, KeystoreData>;
}

export type PluginDataChange = KeystoreDataChange & {
	id: string;
}

export const isKeyData = Obj({
	key: Str(),
	data: Any()
});

export type KeyData = TypeGuardOf<typeof isKeyData>;

export type MusicTrack = ID & {
	volume: Uint;
	repeat: Int;
}

export type MusicPack = IDName & {
	tracks: MusicTrack[];
	volume: Uint;
	playTime: Uint;
}

export type MusicPackVolume = ID & {
	volume: Uint;
}

export type MusicPackPlay = ID & {
	playTime: Uint;
}

export type MusicPackTrackAdd = ID & {
	tracks: Uint[];
}

export type MusicPackTrackRemove = ID & {
	track: Uint;
}

export type MusicPackTrackVolume = ID & {
	track: Uint;
	volume: Uint;
}

export type MusicPackTrackRepeat = ID & {
	track: Uint;
	repeat: Int;
}

export type IDPath = ID & {
	path: string;
}

export type MapStart = [Uint, Uint];

export const isCopy = Obj({
	oldID: isUint,
	newID: isUint,
	path: Str()
});

export type Copy = TypeGuardOf<typeof isCopy>;

export type Mask = [0|1, Uint, Uint, Uint, Uint] | [2|3, Uint, Uint, Uint, Uint] | [4|5, Uint, Uint, Uint, Uint, Uint, Uint, ...Uint[]];

export type MaskSet = {
	baseOpaque: boolean;
	masks: Mask[];
}
