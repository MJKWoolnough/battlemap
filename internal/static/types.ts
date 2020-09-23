import {Subscription} from './lib/inter.js';

// export type Int = number & { __int__: void };
export type Int = number;
export type Uint = number;
export type Byte = number;

export type FolderRPC = {
	waitAdded:         () => Subscription<IDName[]>;
	waitMoved:         () => Subscription<FromTo>;
	waitRemoved:       () => Subscription<string>;
	waitLinked:        () => Subscription<IDName>;
	waitFolderAdded:   () => Subscription<string>;
	waitFolderMoved:   () => Subscription<FromTo>;
	waitFolderRemoved: () => Subscription<string>;

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

	newLayer:       (path: string)                                      => Promise<string>;
	setVisibility:  (path: string, visible: boolean)                    => Promise<void>;
	setLayer:       (path: string)                                      => void;
	setLayerMask:   (path: string)                                      => void;
	moveLayer:      (from: string, to: string, pos: Uint, oldPos: Uint) => Promise<void>;
	renameLayer:    (path: string, name: string)                        => Promise<string>;
	getMapDetails:  ()                                                  => MapDetails;
	setMapDetails:  (details: MapDetails)                               => Promise<void>;
	getLightColour: ()                                                  => Colour;
	setLightColour: (c: Colour)                                         => Promise<void>;
}

export type RPC = {
	waitLogin:                   () => Promise<Uint>;
	waitCurrentUserMap:          () => Subscription<Uint>;
	waitCurrentUserMapData:      () => Subscription<MapData>;
	waitCharacterDataChange:     () => Subscription<CharacterDataChange>;
	waitTokenDataChange:         () => Subscription<TokenDataChange>;
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
	waitTokenMoveLayer:          () => Subscription<TokenMoveLayer>;
	waitTokenMovePos:            () => Subscription<TokenMovePos>;
	waitTokenSetToken:           () => Subscription<Uint>;        //check type
	waitTokenSetImage:           () => Subscription<Uint>;
	waitTokenSetPattern:         () => Subscription<Uint>;
	waitTokenChange:             () => Subscription<TokenChange>;
	waitTokenFlip:               () => Subscription<TokenFlip>;
	waitTokenFlop:               () => Subscription<TokenFlop>;
	waitTokenSnap:               () => Subscription<TokenSnap>;
	waitTokenSourceChange:       () => Subscription<TokenSource>;
	waitLayerShift:              () => Subscription<LayerShift>;
	waitLightShift:              () => Subscription<Coords>;
	waitTokenLightChange:        () => Subscription<LightChange>;
	waitWallAdded:               () => Subscription<WallPath>;
	waitWallRemoved:             () => Subscription<Uint>;
	waitBroadcast:               () => Subscription<Broadcast>;

	images:     FolderRPC,
	audio:      FolderRPC,
	characters: FolderRPC,
	maps:       FolderRPC,

	connID: () => Promise<Uint>;

	setCurrentMap: (id: Uint) => Promise<void>;
	getUserMap:    ()         => Promise<Uint>;
	setUserMap:    (id: Uint) => Promise<void>;
	getMapData:    (id: Uint) => Promise<MapData>;

	newMap:         (map: NewMap)      => Promise<IDName>;
	setMapDetails:  (map: GridDetails) => Promise<void>;
	setLightColour: (c: Colour)        => Promise<void>;

	addLayer:        (name: string)                                                         => Promise<string>;
	addLayerFolder:  (path: string)                                                         => Promise<string>;
	renameLayer:     (path: string, name: string)                                           => Promise<LayerRename>;
	moveLayer:       (from: string, to: string, position: Uint)                             => Promise<void>;
	showLayer:       (path: string)                                                         => Promise<void>;
	hideLayer:       (path: string)                                                         => Promise<void>;
	addMask:         (path: string, mask: Uint)                                             => Promise<void>;
	removeMask:      (path: string)                                                         => Promise<void>;
	removeLayer:     (path: string)                                                         => Promise<void>;
	addToken:        (path: string, token: Token)                                           => Promise<Uint>;
	removeToken:     (id: Uint)                                                             => Promise<void>;
	setToken:        (id: Uint, x: Int, y: Int, width: Uint, height: Uint, rotation: Uint)  => Promise<void>;
	flipToken:       (id: Uint, flip: boolean)                                              => Promise<void>;
	flopToken:       (id: Uint, flop: boolean)                                              => Promise<void>;
	setTokenSnap:    (id: Uint, snap: boolean)                                              => Promise<void>;
	setTokenPattern: (id: Uint)                                                             => Promise<void>;
	setTokenImage:   (id: Uint)                                                             => Promise<void>;
	setTokenSource:  (id: Uint, source: string)                                             => Promise<void>;
	setTokenLayer:   (id: Uint, to: string)                                                 => Promise<void>;
	setTokenPos:     (id: Uint, newPos: Uint)                                               => Promise<void>;
	shiftLayer:      (path: string, dx: Int, dy: Int)                                       => Promise<void>;
	shiftLight:      (x: Uint, y: Uint)                                                     => Promise<void>;
	setTokenLight:   (id: Uint, lightColour: Colour, lightIntensity: Uint)                  => Promise<void>;
	addWall:         (path: string, x1: Uint, y1: Uint, x2: Uint, y2: Uint, colour: Colour) => Promise<void>;
	removeWall:      (id: Uint)                                                             => Promise<void>;

	characterCreate:     (name: string)                                                        => Promise<IDName>;
	characterModify:     (id: Uint, setting: Record<string, KeystoreData>, removing: string[]) => Promise<void>;
	characterGet:        (id: Uint)                                                            => Promise<Record<string, KeystoreData>>;

	tokenModify: (id: Uint, added: Record<string, KeystoreData>, removed: string[]) => Promise<void>;

	listPlugins: () => Promise<Record<string, Plugin>>;

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
	gridSize:  Uint;
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

type LayerRename = {
	path: string;
	name: string;
}

type ID = {
	id: Uint;
}

type TokenAdd = Token & {
	path: string;
};

type TokenChange = ID & {
	x: Int;
	y: Int;
	width: Uint;
	height: Uint;
	rotation: Byte;
}

type TokenMovePos = ID & {
	newPos: Uint;
}

type TokenMoveLayer = ID & {
	to: string;
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

export type KeystoreData = {
	user: boolean;
	data: any;
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

type WallPath = Wall & {
	path: string;
}

type TokenLight = {
	lightColour: Colour;
	lightIntensity: Uint;
}

type LightChange = ID & TokenLight;

type Plugin = {
	enabled: boolean;
	data: Record<string, any>;
}
