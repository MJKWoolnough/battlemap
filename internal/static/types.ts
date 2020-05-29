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
	waitLayerSetVisible:   () => Subscription<string>;
	waitLayerSetInvisible: () => Subscription<string>;

	newLayer:         (path: string) => Promise<string>;
	setVisibility:    (path: string, visible: boolean) => Promise<void>;
	setLayer:         (path: string) => void;
	setLayerMask:     (path: string) => void;
	moveLayer:        (from: string, to: string, pos: Int) => Promise<void>;
	renameLayer:      (path: string, name: string) => Promise<string>;
	getMapDetails:    () => GridDetails;
	setMapDetails:    (details: GridDetails) => Promise<void>;
	getLightColour:   () => Colour;
	setLightColour:   (c: Colour) => Promise<void>;
}

export type RPC = {
	waitLogin:             () => Promise<Int>;
	waitCurrentUserMap:    () => Subscription<Int>;
	waitCharacterChange:   () => Subscription<Int>;
	waitMapChange:         () => Subscription<MapDetails>; //check type
	waitLayerAdd:          () => Subscription<string>;
	waitLayerFolderAdd:    () => Subscription<string>;
	waitLayerMove:         () => Subscription<LayerMove>;
	waitLayerRename:       () => Subscription<FromTo>;     //check type
	waitLayerRemove:       () => Subscription<string>;
	waitMapLightChange:    () => Subscription<Colour>;     //check type
	waitMapInitiative:     () => Subscription<IDName[]>;   //check type
	waitLayerShow:         () => Subscription<string>;
	waitLayerHide:         () => Subscription<string>;
	waitLayerMaskAdd:      () => Subscription<Int>;        //check type
	waitLayerMaskChange:   () => Subscription<Int>;        //check type
	waitLayerMaskRemove:   () => Subscription<Int>;        //check type
	waitLayerTokenOrder:   () => Subscription<Int[]>;      //check type
	waitTokenAdd:          () => Subscription<TokenAdd>;
	waitTokenRemove:       () => Subscription<TokenPos>;
	waitTokenMoveLayer:    () => Subscription<Int>;        //check type
	waitTokenMovePos:      () => Subscription<Int>;        //check type
	waitTokenSetToken:     () => Subscription<Int>;        //check type
	waitTokenSetImage:     () => Subscription<TokenPos>;   //check type
	waitTokenSetPattern:   () => Subscription<TokenPos>;   //check type
	waitTokenChange:       () => Subscription<TokenChange>;
	waitTokenFlip:         () => Subscription<TokenFlip>;
	waitTokenFlop:         () => Subscription<TokenFlop>;
	waitTokenSnap:         () => Subscription<TokenSnap>;
	waitTokenSourceChange: () => Subscription<TokenSource>;

	images:     FolderRPC,
	audio:      FolderRPC,
	characters: FolderRPC,
	maps:       FolderRPC,

	connID: () => Promise<Int>;

	setCurrentMap: (id: Int) => Promise<void>;
	getUserMap:    ()        => Promise<Int>;
	setUserMap:    (id: Int) => Promise<void>;

	newMap:         (map: MapDetails)  => Promise<IDName>;
	setMapDetails:  (map: GridDetails) => Promise<void>;
	setLightColour: (c: Colour)        => Promise<void>;

	addLayer:        (name: string)                                                                   => Promise<string>;
	addLayerFolder:  (path: string)                                                                   => Promise<string>;
	renameLayer:     (path: string, name: string)                                                     => Promise<string>;
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
	setTokenLayer:   (from: string, fromPos: Int, to: string, toPos: Int)                             => Promise<void>;
	setTokenPos:     (path: string, pos: Int, newPos: Int)                                            => Promise<void>;
	setInitiative:   (initiative: Int[])                                                              => Promise<void>;

	characterCreate: ()                                      => Promise<Int>;
	characterSet:    (id: Int, data: Record<string, string>) => Promise<void>;
	characterGet:    (id: Int, keys: string[])               => Promise<Record<string, string>>;
	characterRemove: (id: Int, keys: string[])               => Promise<void>;
	characterDelete: (id: Int)                               => Promise<void>;

	tokenCreate: () => Promise<Int>;
	tokenSet:    (id: Int, data: Record<string, string>) => Promise<void>;
	tokenGet:    (id: Int, keys: string[])               => Promise<Record<string, string>>;
	tokenRemove: (id: Int, keys: string[])               => Promise<void>;
	tokenDelete: (id: Int)                               => Promise<void>;

	loggedIn:          ()                                         => Promise<boolean>;
	loginRequirements: ()                                         => Promise<string>;
	login:             (data: object)                             => Promise<string>;
	changePassword:    (oldPassword: string, newPassword: string) => Promise<string>;
	logout:            ()                                         => Promise<void>;

	close: () => void;
};

export type Map = {
	id:   Int;
	name: string;
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

export type MapDetails = GridDetails & IDName

export type GridDetails = {
	width:  Int;
	height: Int;
	square: Int;
	colour: Colour;
	stroke: Int;
}

export type Token = {
	source:      string;
	stroke:      Colour;
	strokeWidth: Int;
	x:           Int;
	y:           Int;
	width:       Int;
	height:      Int;
	rotation:    Int;
	flip:        boolean;
	flop:        boolean;
	tokenData:   Int;
	tokenType:   Int;
};

export type Layer = {
	id: Int;
	name: string;
	hidden: boolean;
	mask: string;
}

export type LayerFolder = FolderItems & {
	id: Int;
	name: string;
	hidden: boolean;
	children: (Layer | LayerFolder)[];
}

export type LayerMove = FromTo & {
	position: Int;
}

type TokenPos = {
	path: string;
	pos: Int;
}

export type TokenAdd = TokenPos & {
	source: string;
	x: Int;
	y: Int;
	width: Int;
	height: Int;
}

export type TokenChange = TokenPos & {
	x: Int;
	y: Int;
	width: Int;
	height: Int;
	rotation: Int;
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
	source: string;
}
