import {Subscription} from './lib/inter.js';

// export type Int = number & { __int__: void };
export type Int = number;

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
	link:         (id: Int, name: string)    => Promise<string>;
}

export type LayerRPC = FolderRPC & {
	waitLayerSetVisible:     () => Subscription<string>;
	waitLayerSetInvisible:   () => Subscription<string>;
	waitLayerPositionChange: () => Subscription<LayerMove>;
	waitLayerRename:         () => Subscription<LayerRename>;

	newLayer:         (path: string) => Promise<string>;
	setVisibility:    (path: string, visible: boolean) => Promise<void>;
	setLayer:         (path: string) => void;
	setLayerMask:     (path: string) => void;
	moveLayer:        (from: string, to: string, pos: Int) => Promise<void>;
	renameLayer:      (path: string, name: string) => Promise<string>;
	getMapDetails:    () => MapDetails;
	setMapDetails:    (details: MapDetails) => Promise<void>;
	getLightColour:   () => Colour;
	setLightColour:   (c: Colour) => Promise<void>;
}

export type RPC = {
	waitLogin:                   () => Promise<Int>;
	waitCurrentUserMap:          () => Subscription<Int>;
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
	waitMapInitiative:           () => Subscription<IDName[]>;   //check type
	waitLayerShow:               () => Subscription<string>;
	waitLayerHide:               () => Subscription<string>;
	waitLayerMaskAdd:            () => Subscription<Int>;        //check type
	waitLayerMaskChange:         () => Subscription<Int>;        //check type
	waitLayerMaskRemove:         () => Subscription<Int>;        //check type
	waitTokenAdd:                () => Subscription<TokenAdd>;
	waitTokenRemove:             () => Subscription<TokenPos>;
	waitTokenMoveLayer:          () => Subscription<TokenMoveLayer>;
	waitTokenMovePos:            () => Subscription<TokenMovePos>;
	waitTokenSetToken:           () => Subscription<Int>;        //check type
	waitTokenSetImage:           () => Subscription<TokenPos>;   //check type
	waitTokenSetPattern:         () => Subscription<TokenPos>;   //check type
	waitTokenChange:             () => Subscription<TokenChange>;
	waitTokenFlip:               () => Subscription<TokenFlip>;
	waitTokenFlop:               () => Subscription<TokenFlop>;
	waitTokenSnap:               () => Subscription<TokenSnap>;
	waitTokenSourceChange:       () => Subscription<TokenSource>;
	waitTokenSetData:            () => Subscription<TokenID>;
	waitTokenUnsetData:          () => Subscription<TokenPos>;

	images:     FolderRPC,
	audio:      FolderRPC,
	characters: FolderRPC,
	maps:       FolderRPC,

	connID: () => Promise<Int>;

	setCurrentMap: (id: Int) => Promise<void>;
	getUserMap:    ()        => Promise<Int>;
	setUserMap:    (id: Int) => Promise<void>;
	getMapData:    (id: Int) => Promise<MapData>;

	newMap:         (map: NewMap)      => Promise<IDName>;
	setMapDetails:  (map: GridDetails) => Promise<void>;
	setLightColour: (c: Colour)        => Promise<void>;

	addLayer:        (name: string)                                                                   => Promise<string>;
	addLayerFolder:  (path: string)                                                                   => Promise<string>;
	renameLayer:     (path: string, name: string)                                                     => Promise<LayerRename>;
	moveLayer:       (from: string, to: string, position: Int)                                        => Promise<void>;
	showLayer:       (path: string)                                                                   => Promise<void>;
	hideLayer:       (path: string)                                                                   => Promise<void>;
	addMask:         (path: string, mask: Int)                                                        => Promise<void>;
	removeMask:      (path: string)                                                                   => Promise<void>;
	removeLayer:     (path: string)                                                                   => Promise<void>;
	addToken:        (path: string, token: Token)                                                     => Promise<void>;
	removeToken:     (path: string, pos: Int)                                                         => Promise<void>;
	setToken:        (path: string, pos: Int, x: Int, y: Int, width: Int, height: Int, rotation: Int) => Promise<void>;
	flipToken:       (path: string, pos: Int, flip: boolean)                                          => Promise<void>;
	flopToken:       (path: string, pos: Int, flop: boolean)                                          => Promise<void>;
	setTokenSnap:    (path: string, pos: Int, snap: boolean)                                          => Promise<void>;
	setTokenPattern: (path: string, pos: Int)                                                         => Promise<void>;
	setTokenImage:   (path: string, pos: Int)                                                         => Promise<void>;
	setTokenSource:  (path: string, pos: Int, source: string)                                         => Promise<void>;
	setTokenLayer:   (from: string, pos: Int, to: string)                                             => Promise<void>;
	setTokenPos:     (path: string, pos: Int, newPos: Int)                                            => Promise<void>;
	setInitiative:   (initiative: Int[])                                                              => Promise<void>;

	characterCreate:     (name: string)                                => Promise<IDName>;
	characterSet:        (id: Int, data: Record<string, KeystoreData>) => Promise<void>;
	characterGet:        (id: Int, keys: string[])                     => Promise<Record<string, KeystoreData>>;
	characterGetAll:     (id: Int)                                     => Promise<Record<string, KeystoreData>>;
	characterRemoveKeys: (id: Int, keys: string[])                     => Promise<void>;

	tokenCreate:     (path: string, pos: Int)                      => Promise<Int>;
	tokenSet:        (id: Int, data: Record<string, KeystoreData>) => Promise<void>;
	tokenGet:        (id: Int, keys: string[])                     => Promise<Record<string, KeystoreData>>;
	tokenGetAll:     (id: Int)                                     => Promise<Record<string, KeystoreData>>;
	tokenRemoveKeys: (id: Int, keys: string[])                     => Promise<void>;
	tokenDelete:     (path: string, pos: Int)                      => Promise<void>;
	tokenClone:      (id: Int)                                     => Promise<Int>;

	loggedIn:          ()                                         => Promise<boolean>;
	loginRequirements: ()                                         => Promise<string>;
	login:             (data: object)                             => Promise<string>;
	changePassword:    (oldPassword: string, newPassword: string) => Promise<string>;
	logout:            ()                                         => Promise<void>;

	close: () => void;
};

export type MapData = LayerFolder & MapDetails & {
	lightColour: Colour;
};

export type IDName = {
	id:   Int;
	name: string;
}

export type FromTo = {
	from: string;
	to:   string;
}

export type FolderItems = {
	folders: Record<string, FolderItems>;
	items:  Record<string, Int>;
}

export type Colour = {
	r: Int;
	g: Int;
	b: Int;
	a: Int;
};

export type MapDetails = GridDetails & {
	width: Int;
	height: Int;
}

export type NewMap = MapDetails & {
	name: string;
}

export type GridDetails = {
	gridSize:  Int;
	gridStroke: Int;
	gridColour: Colour;
}

export type Token = {
	src:           Int;
	stroke:        Colour;
	strokeWidth:   Int;
	x:             Int;
	y:             Int;
	width:         Int;
	height:        Int;
	patternWidth:  Int;
	patternHeight: Int;
	rotation:      Int;
	flip:          boolean;
	flop:          boolean;
	tokenData:     Int;
	tokenType:     Int;
	snap:          boolean;
};

export type LayerTokens = {
	id: Int;
	name: string;
	hidden: boolean;
	mask: Int;
	tokens: Token[];
}

export type LayerFolder = FolderItems & {
	id: Int;
	name: string;
	hidden: boolean;
	children: (LayerTokens | LayerFolder)[];
}

export type LayerMove = FromTo & {
	position: Int;
}

type LayerRename = {
	path: string;
	name: string;
}

type TokenPos = {
	path: string;
	pos: Int;
}

type TokenAdd = TokenPos & Token;

type TokenChange = TokenPos & {
	x: Int;
	y: Int;
	width: Int;
	height: Int;
	rotation: Int;
}

type TokenMovePos = TokenPos & {
	newPos: Int;
}

type TokenMoveLayer = FromTo & {
	pos: Int;
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
	id: Int;
}

export type KeystoreData = {
	user: boolean;
	data: any;
};

export type KeystoreDataChange = {
	id: Int;
	data: Record<string, KeystoreData>;
}

type KeystoreDataRemove = {
	id: Int;
	keys: string[];
}
