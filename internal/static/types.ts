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
	waitCharacterDataChange:     () => Subscription<KeystoreDataChange>;
	waitCharacterDataRemove:     () => Subscription<KeystoreDataRemove>;
	waitTokenDataChange:         () => Subscription<KeystoreDataChange>;
	waitTokenDataRemove:         () => Subscription<KeystoreDataRemove>;
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
	waitTokenRemove:             () => Subscription<TokenPos>;
	waitTokenMoveLayer:          () => Subscription<TokenMoveLayer>;
	waitTokenMovePos:            () => Subscription<TokenMovePos>;
	waitTokenSetToken:           () => Subscription<Uint>;        //check type
	waitTokenSetImage:           () => Subscription<TokenPos>;
	waitTokenSetPattern:         () => Subscription<TokenPos>;
	waitTokenChange:             () => Subscription<TokenChange>;
	waitTokenFlip:               () => Subscription<TokenFlip>;
	waitTokenFlop:               () => Subscription<TokenFlop>;
	waitTokenSnap:               () => Subscription<TokenSnap>;
	waitTokenSourceChange:       () => Subscription<TokenSource>;
	waitTokenSetData:            () => Subscription<TokenID>;
	waitTokenUnsetData:          () => Subscription<TokenPos>;
	waitLayerShift:              () => Subscription<LayerShift>;
	waitLightShift:              () => Subscription<Coords>;
	waitWallAdded:               () => Subscription<Wall>;
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

	addLayer:        (name: string)                                                                       => Promise<string>;
	addLayerFolder:  (path: string)                                                                       => Promise<string>;
	renameLayer:     (path: string, name: string)                                                         => Promise<LayerRename>;
	moveLayer:       (from: string, to: string, position: Uint)                                           => Promise<void>;
	showLayer:       (path: string)                                                                       => Promise<void>;
	hideLayer:       (path: string)                                                                       => Promise<void>;
	addMask:         (path: string, mask: Uint)                                                           => Promise<void>;
	removeMask:      (path: string)                                                                       => Promise<void>;
	removeLayer:     (path: string)                                                                       => Promise<void>;
	addToken:        (path: string, token: Token)                                                         => Promise<Uint>;
	removeToken:     (path: string, pos: Uint)                                                            => Promise<void>;
	setToken:        (path: string, pos: Uint, x: Int, y: Int, width: Uint, height: Uint, rotation: Uint) => Promise<void>;
	flipToken:       (path: string, pos: Uint, flip: boolean)                                             => Promise<void>;
	flopToken:       (path: string, pos: Uint, flop: boolean)                                             => Promise<void>;
	setTokenSnap:    (path: string, pos: Uint, snap: boolean)                                             => Promise<void>;
	setTokenPattern: (path: string, pos: Uint)                                                            => Promise<void>;
	setTokenImage:   (path: string, pos: Uint)                                                            => Promise<void>;
	setTokenSource:  (path: string, pos: Uint, source: string)                                            => Promise<void>;
	setTokenLayer:   (from: string, pos: Uint, to: string)                                                => Promise<void>;
	setTokenPos:     (path: string, pos: Uint, newPos: Uint)                                              => Promise<void>;
	shiftLayer:      (path: string, dx: Int, dy: Int)                                                     => Promise<void>;
	shiftLight:      (x: Uint, y: Uint)                                                                   => Promise<void>;
	addWall:         (x1: Uint, y1: Uint, x2: Uint, y2: Uint, colour: Colour)                             => Promise<void>;
	removeWall:      (pos: Uint)                                                                          => Promise<void>;

	characterCreate:     (name: string)                                 => Promise<IDName>;
	characterSet:        (id: Uint, data: Record<string, KeystoreData>) => Promise<void>;
	characterGet:        (id: Uint)                                     => Promise<Record<string, KeystoreData>>;
	characterRemoveKeys: (id: Uint, keys: string[])                     => Promise<void>;

	tokenCreate:     (path: string, pos: Uint)                      => Promise<Uint>;
	tokenSet:        (id: Uint, data: Record<string, KeystoreData>) => Promise<void>;
	tokenGet:        (id: Uint)                                     => Promise<Record<string, KeystoreData>>;
	tokenRemoveKeys: (id: Uint, keys: string[])                     => Promise<void>;
	tokenDelete:     (path: string, pos: Uint)                      => Promise<void>;
	tokenClone:      (id: Uint)                                     => Promise<Uint>;

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

export type Colour = {
	r: Byte;
	g: Byte;
	b: Byte;
	a: Byte;
};

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

type TokenShared = {
	x:           Int;
	y:           Int;
	width:       Uint;
	height:      Uint;
	rotation:    Byte;
	tokenType?:  Uint;
	snap:        boolean;
}

export type TokenImage = TokenShared & {
	src:           Uint;
	patternWidth:  Uint;
	patternHeight: Uint;
	flip:        boolean;
	flop:        boolean;
	tokenData:     Uint;
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
}

export type LayerFolder = FolderItems & {
	id: Uint;
	name: string;
	hidden: boolean;
	children: (LayerTokens | LayerFolder)[];
	walls: Wall[];
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

type TokenPos = {
	path: string;
	pos: Uint;
}

type TokenAdd = TokenPos & Token;

type TokenChange = TokenPos & {
	x: Int;
	y: Int;
	width: Uint;
	height: Uint;
	rotation: Byte;
}

type TokenMovePos = TokenPos & {
	newPos: Uint;
}

type TokenMoveLayer = FromTo & {
	pos: Uint;
}

type TokenFlip = TokenPos & {
	flip: boolean;
}

type TokenFlop = TokenPos & {
	flop: boolean;
}

type TokenSnap = TokenPos & {
	snap: boolean;
}

type TokenSource = TokenPos & {
	src: string;
}

type TokenID = TokenPos & {
	id: Uint;
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

type KeystoreDataChange = {
	id: Uint;
	data: Record<string, KeystoreData>;
}

type KeystoreDataRemove = {
	id: Uint;
	keys: string[];
}

export type Wall = {
	x1: Int;
	y1: Int;
	x2: Int;
	y2: Int;
	colour: Colour;
}
