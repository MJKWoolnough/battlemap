import {Subscription} from './lib/inter.js';

// export type Int = number & { __int__: void };
export type Int = number;
export type Uint = number;
export type Byte = number;

type FolderWaits = {
	waitAdded:         () => Subscription<IDName[]>;
	waitMoved:         () => Subscription<FromTo>;
	waitRemoved:       () => Subscription<string>;
	waitLinked:        () => Subscription<IDName>;
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
	link:         (id: Uint, name: string)   => Promise<string>;
}

export type LayerRPC = FolderRPC & {
	waitLayerSetVisible:     () => Subscription<string>;
	waitLayerSetInvisible:   () => Subscription<string>;
	waitLayerPositionChange: () => Subscription<LayerMove>;
	waitLayerRename:         () => Subscription<LayerRename>;
}

type RPCWaits = {
	waitCurrentUserMap:          () => Subscription<Uint>;
	waitCurrentUserMapData:      () => Subscription<MapData>;
	waitMapDataSet:              () => Subscription<KeyData>;
	waitMapDataRemove:           () => Subscription<string>;
	waitCharacterDataChange:     () => Subscription<CharacterDataChange>;
	waitMapChange:               () => Subscription<MapDetails>;
	waitLayerAdd:                () => Subscription<string>;
	waitLayerFolderAdd:          () => Subscription<string>;
	waitLayerMove:               () => Subscription<LayerMove>;
	waitLayerRename:             () => Subscription<LayerRename>;
	waitLayerRemove:             () => Subscription<string>;
	waitMapLightChange:          () => Subscription<Colour>;
	waitLayerShow:               () => Subscription<string>;
	waitLayerHide:               () => Subscription<string>;
	waitLayerMaskAdd:            () => Subscription<Uint>;        //check type
	waitLayerMaskChange:         () => Subscription<Uint>;        //check type
	waitLayerMaskRemove:         () => Subscription<Uint>;        //check type
	waitTokenAdd:                () => Subscription<TokenAdd>;
	waitTokenRemove:             () => Subscription<Uint>;
	waitTokenMoveLayerPos:       () => Subscription<TokenMoveLayerPos>;
	waitTokenSet:                () => Subscription<TokenSet>;
	waitLayerShift:              () => Subscription<LayerShift>;
	waitLightShift:              () => Subscription<Coords>;
	waitTokenLightChange:        () => Subscription<LightChange>;
	waitWallAdded:               () => Subscription<WallPath>;
	waitWallRemoved:             () => Subscription<Uint>;
	waitMusicPackAdd:            () => Subscription<string>;
	waitMusicPackRename:         () => Subscription<FromTo>;
	waitMusicPackRemove:         () => Subscription<string>;
	waitMusicPackCopy:           () => Subscription<FromTo>;
	waitMusicPackVolume:         () => Subscription<MusicPackVolume>;
	waitMusicPackPlay:           () => Subscription<MusicPackPlay>;
	waitMusicPackStop:           () => Subscription<string>;
	waitMusicPackStopAll:        () => Subscription<void>;
	waitMusicPackTrackAdd:       () => Subscription<MusicPackTrackAdd>;
	waitMusicPackTrackRemove:    () => Subscription<MusicPackTrackRemove>;
	waitMusicPackTrackVolume:    () => Subscription<MusicPackTrackVolume>;
	waitMusicPackTrackRepeat:    () => Subscription<MusicPackTrackRepeat>;
	waitPluginChange:            () => Subscription<void>;
	waitPluginSetting:           () => Subscription<PluginSetting>;
	waitSignalPosition:          () => Subscription<[Uint, Uint]>;
	waitSignalMovePosition:      () => Subscription<[Uint, Uint]>;
	waitBroadcast:               () => Subscription<Broadcast>;
}

export type InternalWaits = RPCWaits & {
	images:     FolderWaits,
	audio:      FolderWaits,
	characters: FolderWaits,
	maps:       FolderWaits,
}

export type RPC = RPCWaits & {
	waitLogin: () => Promise<Uint>;

	images:     FolderRPC,
	audio:      FolderRPC,
	characters: FolderRPC,
	maps:       FolderRPC,

	connID: () => Promise<Uint>;
	ready:  () => Promise<void>;

	setCurrentMap: (id: Uint) => Promise<void>;
	getUserMap:    ()         => Promise<Uint>;
	setUserMap:    (id: Uint) => Promise<void>;
	getMapData:    (id: Uint) => Promise<MapData>;

	newMap:           (map: NewMap)             => Promise<IDName>;
	setMapDetails:    (map: GridDetails)        => Promise<void>;
	setLightColour:   (c: Colour)               => Promise<void>;
	setMapKeyData:    (key: string, value: any) => Promise<void>;
	removeMapKeyData: (key: string)             => Promise<void>;

	signalPosition:     (pos: [Uint, Uint]) => Promise<void>;
	signalMovePosition: (pos: [Uint, Uint]) => Promise<void>;

	addLayer:         (name: string)                                                         => Promise<string>;
	addLayerFolder:   (path: string)                                                         => Promise<string>;
	renameLayer:      (path: string, name: string)                                           => Promise<LayerRename>;
	moveLayer:        (from: string, to: string, position: Uint)                             => Promise<void>;
	showLayer:        (path: string)                                                         => Promise<void>;
	hideLayer:        (path: string)                                                         => Promise<void>;
	addMask:          (path: string, mask: Uint)                                             => Promise<void>;
	removeMask:       (path: string)                                                         => Promise<void>;
	removeLayer:      (path: string)                                                         => Promise<void>;
	addToken:         (path: string, token: Token)                                           => Promise<Uint>;
	removeToken:      (id: Uint)                                                             => Promise<void>;
	setToken:         (t: TokenSet)                                                          => Promise<void>;
	setTokenLayerPos: (id: Uint, to: string, newPos: Uint)                                   => Promise<void>;
	shiftLayer:       (path: string, dx: Int, dy: Int)                                       => Promise<void>;
	shiftLight:       (x: Uint, y: Uint)                                                     => Promise<void>;
	setTokenLight:    (id: Uint, lightColour: Colour, lightIntensity: Uint)                  => Promise<void>;
	addWall:          (path: string, x1: Uint, y1: Uint, x2: Uint, y2: Uint, colour: Colour) => Promise<Uint>;
	removeWall:       (id: Uint)                                                             => Promise<void>;

	musicPackList:        ()                                             => Promise<Record<string, MusicPack>>;
	musicPackAdd:         (name: string)                                 => Promise<string>;
	musicPackRename:      (from: string, to: string)                     => Promise<string>;
	musicPackRemove:      (name: string)                                 => Promise<void>;
	musicPackCopy:        (from: string, to: string)                     => Promise<string>;
	musicPackSetVolume:   (musicPack: string, volume: Uint)              => Promise<void>;
	musicPackPlay:        (musicPack: string, playTime: Uint)            => Promise<Uint>;
	musicPackStop:        (musicPack: string)                            => Promise<void>;
	musicPackStopAll:     ()                                             => Promise<void>;
	musicPackTrackAdd:    (musicPack: string, tracks: Uint[])            => Promise<void>;
	musicPackTrackRemove: (musicPack: string, track: Uint)               => Promise<void>;
	musicPackTrackVolume: (musicPack: string, track: Uint, volume: Uint) => Promise<void>;
	musicPackTrackRepeat: (musicPack: string, track: Uint, repeat: Int)  => Promise<void>;

	characterCreate:     (path: string, data: Record<string, KeystoreData>)                    => Promise<IDPath>;
	characterModify:     (id: Uint, setting: Record<string, KeystoreData>, removing: string[]) => Promise<void>;
	characterGet:        (id: Uint)                                                            => Promise<Record<string, KeystoreData>>;

	tokenModify: (id: Uint, added: Record<string, KeystoreData>, removed: string[]) => Promise<void>;

	listPlugins:   ()                                          => Promise<Record<string, Plugin>>;
	enablePlugin:  (plugin: string)                            => Promise<void>;
	disablePlugin: (plugin: string)                            => Promise<void>;
	pluginSetting: (plugin: string, data: Record<string, any>) => Promise<void>;

	loggedIn:          ()                                         => Promise<boolean>;
	loginRequirements: ()                                         => Promise<string>;
	login:             (data: object)                             => Promise<string>;
	changePassword:    (oldPassword: string, newPassword: string) => Promise<string>;
	logout:            ()                                         => Promise<void>;

	broadcast:         (data: Broadcast) => Promise<void>;
};

export type MapData = LayerFolder & MapDetails & {
	lightColour: Colour;
	lightX: Uint;
	lightY: Uint;
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

export type FolderItems = {
	folders: Record<string, FolderItems>;
	items:  Record<string, Uint>;
}

export type Colour = Readonly<{
	r: Byte;
	g: Byte;
	b: Byte;
	a: Byte;
}>;

export type MapDetails = GridDetails & {
	width: Uint;
	height: Uint;
}

type NewMap = MapDetails & {
	name: string;
}

export type GridDetails = {
	gridType: Uint;
	gridSize: Uint;
	gridStroke: Uint;
	gridColour: Colour;
}

export type Token = TokenImage | TokenShape | TokenDrawing;

type TokenShared = TokenLight & {
	id:         Uint;
	x:          Int;
	y:          Int;
	width:      Uint;
	height:     Uint;
	rotation:   Byte;
	tokenType?: Uint;
	snap:       boolean;
}

export type TokenImage = TokenShared & {
	src:           Uint;
	patternWidth:  Uint;
	patternHeight: Uint;
	flip:        boolean;
	flop:        boolean;
	tokenData:   Record<string, KeystoreData>;
}

export type TokenShape = TokenShared & {
	fill:        Colour
	stroke:      Colour;
	strokeWidth: Uint;
}

export type TokenDrawing = TokenShape & {
	points: Coords[];
}

export type Coords = {
	x: Int;
	y: Int;
}

export type TokenSet = Partial<TokenShared> & Partial<TokenDrawing> & {
	id:               Uint;
	src?:             Uint;
	patternWidth?:    Uint;
	patternHeight?:   Uint;
	flip?:            boolean;
	flop?:            boolean;
	tokenData?:       Record<string, KeystoreData>;
	removeTokenData?: string[];
}

export type LayerTokens = {
	id: Uint;
	name: string;
	hidden: boolean;
	mask: Uint;
	tokens: Token[];
	walls: Wall[];
}

export type LayerFolder = FolderItems & {
	id: Uint;
	name: string;
	hidden: boolean;
	children: (LayerTokens | LayerFolder)[];
}

export type LayerMove = FromTo & {
	position: Uint;
}

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
};

type TokenChange = ID & {
	x: Int;
	y: Int;
	width: Uint;
	height: Uint;
	rotation: Byte;
}

export type TokenMoveLayerPos = ID & {
	to: string;
	newPos: Uint;
}

type TokenFlip = ID & {
	flip: boolean;
}

type TokenFlop = ID & {
	flop: boolean;
}

type TokenSnap = ID & {
	snap: boolean;
}

type TokenSource = ID & {
	src: string;
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

type CharacterDataChange = {
	id: Uint;
	setting: Record<string, KeystoreData>;
	removing: string[];
}

type TokenDataChange = {
	id: Uint;
	setting: Record<string, KeystoreData>;
	removing: string[];
}

type KeystoreDataRemove = {
	id: Uint;
	keys: string[];
}

export type WallData = {
	x1: Int;
	y1: Int;
	x2: Int;
	y2: Int;
	colour: Colour;
}

export type Wall = WallData & ID;

export type WallPath = Wall & {
	path: string;
}

type TokenLight = {
	lightColour: Colour;
	lightIntensity: Uint;
}

type LightChange = ID & TokenLight;

export type Plugin = {
	enabled: boolean;
	data: Record<string, any>;
}

type PluginSetting = {
	file: string;
	data: Record<string, any>;
}

type KeyData = {
	key: string;
	data: any;
}

export type MusicTrack = {
	id: Uint;
	volume: Uint;
	repeat: Int;
}

export type MusicPack = {
	tracks: MusicTrack[];
	volume: Uint;
	playTime: Uint;
}

type MusicPackVolume = {
	musicPack: string;
	volume: Uint;
}

type MusicPackPlay = {
	musicPack: string;
	playTime: Uint;
}

type MusicPackTrackAdd = {
	musicPack: string;
	tracks: Uint[];
}

type MusicPackTrackRemove = {
	musicPack: string;
	track: Uint;
}

type MusicPackTrackVolume = {
	musicPack: string;
	track: Uint;
	volume: Uint;
}

type MusicPackTrackRepeat = {
	musicPack: string;
	track: Uint;
	repeat: Int;
}

type IDPath = ID & {
	path: string;
}

export type SVGAnimateBeginElement = SVGAnimateElement & {
	beginElement: Function;
}
