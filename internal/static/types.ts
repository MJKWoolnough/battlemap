import type {TypeGuard, TypeGuardOf} from './lib/typeguard.js';
import {And, Arr, Bool, Int, Obj, Opt, Or, Part, Rec, Recur, Req, Str, Tuple, Unknown, Val, asTypeGuard} from './lib/typeguard.js';
import {isColour} from './colours.js';

const mapDataCheckers: ((data: Record<string, any>) => void)[] = [],
      tokenDataCheckers: ((data: Record<string, KeystoreData>) => void)[] = [],
      characterDataCheckers: ((data: Record<string, KeystoreData>) => void)[] = [],
      isKeyDataT = <T>(primary: TypeGuard<T>, checkers: ((data: T) => void)[]) => asTypeGuard((v: unknown): v is T => {
	if (!primary(v)) {
		return false;
	}

	for (const mdc of checkers) {
		mdc(v);
	}

	return true;
      });

export const isInt = Int(),
isUint = Int(0),
isByte = Int(0, 255),
isBool = Bool(),
isStr = Str(),
isUnknown = Unknown(),
addMapDataChecker = (fn: (data: Record<string, any>) => void) => mapDataCheckers.push(fn),
addCharacterDataChecker = (fn: (data: Record<string, KeystoreData>) => void) => characterDataCheckers.push(fn),
addTokenDataChecker = (fn: (data: Record<string, KeystoreData>) => void) => tokenDataCheckers.push(fn),
isKeystoreData = Req(Obj({
	user: isBool,
	data: isUnknown
})),
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
isArrIDName = Arr(isIDName),
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
	snap: isBool,
	tokenData: isKeyDataT(Rec(isStr, isKeystoreData), tokenDataCheckers)
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
	lightColour: isColour,
	data: isKeyDataT(Rec(isStr, isUnknown), mapDataCheckers)
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
	tokenData: isKeyDataT(Rec(isStr, isKeystoreData), characterDataCheckers)
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
	type: isUnknown,
	data: isUnknown
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
	removing: Arr(isStr)
}),
isCharacterDataChange = And(isID, isKeystoreDataChange),
isPluginDataChange = And(isKeystoreDataChange, Obj({
	id: isStr
})),
isKeyData = Obj({
	key: isStr,
	data: isUnknown
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

export type Int = number;

export type Uint = number;

export type Byte = number;

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
