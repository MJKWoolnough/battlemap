import type {Subscription} from './lib/inter.js';
import type {Colour} from './colours.js';

export type Int = number;
export type Uint = number;
export type Byte = number;

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
	waitLayerPositionChange: () => Subscription<LayerMove>;
	waitLayerRename:         () => Subscription<LayerRename>;
	waitLayerSelect:         () => Subscription<string>;
}>

export type RPCWaits = {
	waitCurrentUserMap:          () => Subscription<Uint>;
	waitCurrentUserMapData:      () => Subscription<MapData>;
	waitMapDataSet:              () => Subscription<KeyData>;
	waitMapDataRemove:           () => Subscription<string>;
	waitCharacterDataChange:     () => Subscription<CharacterDataChange>;
	waitMapChange:               () => Subscription<MapDetails>;
	waitMapStartChange:          () => Subscription<MapStart>;
	waitLayerAdd:                () => Subscription<string>;
	waitLayerFolderAdd:          () => Subscription<string>;
	waitLayerMove:               () => Subscription<LayerMove>;
	waitLayerRename:             () => Subscription<LayerRename>;
	waitLayerRemove:             () => Subscription<string>;
	waitGridDistanceChange:      () => Subscription<Uint>;
	waitGridDiagonalChange:      () => Subscription<boolean>;
	waitMapLightChange:          () => Subscription<Colour>;
	waitLayerShow:               () => Subscription<string>;
	waitLayerHide:               () => Subscription<string>;
	waitMaskAdd:                 () => Subscription<Mask>;
	waitMaskRemove:              () => Subscription<Uint>;
	waitMaskSet:                 () => Subscription<MaskSet>;
	waitTokenAdd:                () => Subscription<TokenAdd>;
	waitTokenRemove:             () => Subscription<Uint>;
	waitTokenMoveLayerPos:       () => Subscription<TokenMoveLayerPos>;
	waitTokenSet:                () => Subscription<TokenSet>;
	waitLayerShift:              () => Subscription<LayerShift>;
	waitTokenLightChange:        () => Subscription<LightChange>;
	waitWallAdded:               () => Subscription<WallPath>;
	waitWallRemoved:             () => Subscription<Uint>;
	waitWallModified:            () => Subscription<Wall>;
	waitMusicPackAdd:            () => Subscription<IDName>;
	waitMusicPackRename:         () => Subscription<IDName>;
	waitMusicPackRemove:         () => Subscription<Uint>;
	waitMusicPackCopy:           () => Subscription<IDName & {newID: Uint}>;
	waitMusicPackVolume:         () => Subscription<MusicPackVolume>;
	waitMusicPackPlay:           () => Subscription<MusicPackPlay>;
	waitMusicPackStop:           () => Subscription<Uint>;
	waitMusicPackStopAll:        () => Subscription<void>;
	waitMusicPackTrackAdd:       () => Subscription<MusicPackTrackAdd>;
	waitMusicPackTrackRemove:    () => Subscription<MusicPackTrackRemove>;
	waitMusicPackTrackVolume:    () => Subscription<MusicPackTrackVolume>;
	waitMusicPackTrackRepeat:    () => Subscription<MusicPackTrackRepeat>;
	waitPluginChange:            () => Subscription<void>;
	waitPluginSetting:           () => Subscription<PluginDataChange>;
	waitSignalMeasure:           () => Subscription<[Uint, Uint, Uint, Uint, ...Uint[]] | null>;
	waitSignalPosition:          () => Subscription<[Uint, Uint]>;
	waitSignalMovePosition:      () => Subscription<[Uint, Uint]>;
	waitBroadcastWindow:         () => Subscription<BroadcastWindow>;
	waitBroadcast:               () => Subscription<Broadcast>;
}

export type InternalWaits = RPCWaits & {
	images:     FolderWaits,
	audio:      FolderWaits,
	characters: FolderWaits,
	maps:       FolderWaits,
}

export type RPC = RPCWaits & {
	images:     FolderRPC,
	audio:      FolderRPC,
	characters: FolderRPC,
	maps:       FolderRPC,

	ready:       () => Promise<void>;
	currentTime: () => Promise<Uint>;

	setCurrentMap: (id: Uint) => Promise<void>;
	getUserMap:    ()         => Promise<Uint>;
	setUserMap:    (id: Uint) => Promise<void>;
	getMapData:    (id: Uint) => Promise<MapData>;

	newMap:           (map: NewMap)                => Promise<IDName>;
	setMapDetails:    (map: GridDetails)           => Promise<void>;
	setMapStart:      (start: MapStart)            => Promise<void>;
	setGridDistance:  (distance: Uint)             => Promise<void>;
	setGridDiagonal:  (diagonal: boolean)          => Promise<void>;
	setLightColour:   (c: Colour)                  => Promise<void>;
	setMapKeyData:    (key: string, value: any)    => Promise<void>;
	removeMapKeyData: (key: string)                => Promise<void>;

	signalMeasure:      (pos: [Uint, Uint, Uint, Uint, ...Uint[]] | null) => Promise<void>;
	signalPosition:     (pos: [Uint, Uint])                    => Promise<void>;
	signalMovePosition: (pos: [Uint, Uint])                    => Promise<void>;

	addLayer:         (name: string)                                                         => Promise<string>;
	addLayerFolder:   (path: string)                                                         => Promise<string>;
	renameLayer:      (path: string, name: string)                                           => Promise<LayerRename>;
	moveLayer:        (from: string, to: string, position: Uint)                             => Promise<void>;
	showLayer:        (path: string)                                                         => Promise<void>;
	hideLayer:        (path: string)                                                         => Promise<void>;
	removeLayer:      (path: string)                                                         => Promise<void>;
	addToMask:        (mask: Mask)                                                           => Promise<void>;
	removeFromMask:   (mask: Uint)                                                           => Promise<void>;
	setMask:          (baseOpaque: boolean, masks: Mask[])                                   => Promise<void>;
	addToken:         (path: string, token: Token)                                           => Promise<Uint>;
	removeToken:      (id: Uint)                                                             => Promise<void>;
	setToken:         (t: TokenSet)                                                          => Promise<void>;
	setTokenLayerPos: (id: Uint, to: string, newPos: Uint)                                   => Promise<void>;
	shiftLayer:       (path: string, dx: Int, dy: Int)                                       => Promise<void>;
	setTokenLight:    (id: Uint, lightColour: Colour, lightIntensity: Uint)                  => Promise<void>;
	addWall:          (path: string, wall: Wall)                                             => Promise<Uint>;
	removeWall:       (id: Uint)                                                             => Promise<void>;
	modifyWall:       (w: Wall)                                                              => Promise<void>;

	musicPackList:        ()                                             => Promise<MusicPack[]>;
	musicPackAdd:         (name: string)                                 => Promise<IDName>;
	musicPackRename:      (id: Uint, name: string)                       => Promise<string>;
	musicPackRemove:      (id: Uint)                                     => Promise<void>;
	musicPackCopy:        (id: Uint, name: string)                       => Promise<IDName>;
	musicPackSetVolume:   (musicPack: Uint, volume: Uint)                => Promise<void>;
	musicPackPlay:        (musicPack: Uint, playTime: Uint)              => Promise<Uint>;
	musicPackStop:        (musicPack: Uint)                              => Promise<void>;
	musicPackStopAll:     ()                                             => Promise<void>;
	musicPackTrackAdd:    (musicPack: Uint, tracks: Uint[])              => Promise<void>;
	musicPackTrackRemove: (musicPack: Uint, track: Uint)                 => Promise<void>;
	musicPackTrackVolume: (musicPack: Uint, track: Uint, volume: Uint)   => Promise<void>;
	musicPackTrackRepeat: (musicPack: Uint, track: Uint, repeat: Int)    => Promise<void>;

	characterCreate:     (path: string, data: Record<string, KeystoreData>)                    => Promise<IDPath>;
	characterModify:     (id: Uint, setting: Record<string, KeystoreData>, removing: string[]) => Promise<void>;
	characterGet:        (id: Uint)                                                            => Promise<Record<string, KeystoreData>>;

	tokenModify: (id: Uint, added: Record<string, KeystoreData>, removed: string[]) => Promise<void>;

	listPlugins:   ()                                          => Promise<Record<string, Plugin>>;
	enablePlugin:  (plugin: string)                            => Promise<void>;
	disablePlugin: (plugin: string)                            => Promise<void>;
	pluginSetting: (id: string, setting: Record<string, KeystoreData>, removing: string[]) => Promise<void>;

	broadcastWindow: (module: string, id: Uint, contents: string) => Promise<void>;
	broadcast:       (data: Broadcast)                            => Promise<void>;
};

export type MapData = LayerFolder & MapDetails & MaskSet & {
	startX: Uint;
	startY: Uint;
	gridDistance: Uint;
	gridDiagonal: boolean;
	lightColour: Colour;
	data: Record<string, any>;
};

export type IDName = {
	id:   Uint;
	name: string;
}

export type FromTo = {
	from: string;
	to:   string;
}

export type WidthHeight = {
	width: Uint;
	height: Uint;
}

export type FolderItems = {
	folders: Record<string, FolderItems>;
	items:  Record<string, Uint>;
}

export type MapDetails = GridDetails & WidthHeight;

type NewMap = MapDetails & {
	name: string;
}

export type GridDetails = {
	gridType: Byte;
	gridSize: Uint;
	gridStroke: Uint;
	gridColour: Colour;
}

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
	fill:        Colour
	stroke:      Colour;
	strokeWidth: Uint;
	isEllipse?:  boolean;
}

export type TokenDrawing = TokenShape & {
	points: Coords[];
}

export type Coords = {
	x: Int;
	y: Int;
}

export type TokenSet = Partial<TokenShared> & Partial<TokenDrawing> & ID & {
	src?:             Uint;
	patternWidth?:    Uint;
	patternHeight?:   Uint;
	flip?:            boolean;
	flop?:            boolean;
	tokenData?:       Record<string, KeystoreData>;
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
};

export type LayerTokens = IDName & {
	hidden: boolean;
	mask: Uint;
	tokens: Token[];
	walls: Wall[];
}

export type LayerFolder = FolderItems & IDName & {
	hidden: boolean;
	children: (LayerTokens | LayerFolder)[];
}

export type LayerMove = FromTo & {
	position: Uint;
}

type BroadcastWindow = ID & {
	module: string;
	contents: string;
};

export type Broadcast = {
	type: any;
	data: any;
};

export type LayerRename = {
	path: string;
	name: string;
}

type ID = {
	id: Uint;
}

type TokenAdd = {
	path: string;
	token: Token;
}

type TokenMoveLayerPos = ID & {
	to: string;
	newPos: Uint;
}

type LayerShift = {
	path: string;
	dx: Int;
	dy: Int;
}

export type KeystoreData<T = any> = {
	user: boolean;
	data: T;
}

type CharacterDataChange = ID & {
	setting: Record<string, KeystoreData>;
	removing: string[];
}

type WallData = {
	x1: Int;
	y1: Int;
	x2: Int;
	y2: Int;
	colour: Colour;
	scattering: Byte;
}

export type Wall = WallData & ID;

export type WallPath = {
	path: string;
	wall: Wall;
}

type TokenLight = {
	lightColour: Colour;
	lightIntensity: Uint;
}

type LightChange = ID & TokenLight;

export type Plugin = {
	enabled: boolean;
	data: Record<string, KeystoreData>;
}

type PluginDataChange = {
	id: string;
	setting: Record<string, KeystoreData>;
	removing: string[];
}

type KeyData = {
	key: string;
	data: any;
}

export type MusicTrack = ID & {
	volume: Uint;
	repeat: Int;
}

export type MusicPack = IDName & {
	tracks: MusicTrack[];
	volume: Uint;
	playTime: Uint;
}

type MusicPackVolume = ID & {
	volume: Uint;
}

type MusicPackPlay = ID & {
	playTime: Uint;
}

type MusicPackTrackAdd = ID & {
	tracks: Uint[];
}

type MusicPackTrackRemove = ID & {
	track: Uint;
}

type MusicPackTrackVolume = ID & {
	track: Uint;
	volume: Uint;
}

type MusicPackTrackRepeat = ID & {
	track: Uint;
	repeat: Int;
}

type IDPath = ID & {
	path: string;
}

type MapStart = [Uint, Uint];

type Copy = {
	oldID: Uint;
	newID: Uint;
	path: string;
}

export type Mask = [0|1, Uint, Uint, Uint, Uint] | [2|3, Uint, Uint, Uint, Uint] | [4|5, Uint, Uint, Uint, Uint, Uint, Uint, ...Uint[]];

export type MaskSet = {
	baseOpaque: boolean;
	masks: Mask[];
}
