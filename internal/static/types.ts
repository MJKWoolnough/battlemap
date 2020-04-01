import {Subscription} from './lib/inter.js';

// export type Int = number & { __int__: void };
export type Int = number;

export interface ParentPath {
	getPath(): string;
}

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
	waitLayerSetVisible:   () => Subscription<Int>;
	waitLayerSetInvisible: () => Subscription<Int>;
	waitLayerAddMask:      () => Subscription<Int>;
	waitLayerRemoveMask:   () => Subscription<Int>;

	newLayer:         (path: string) => Promise<string>;
	setVisibility:    (path: string, visible: boolean) => Promise<void>;
	setLayer:         (path: string) => void;
	setLayerMask:     (path: string) => void;
	moveLayer:        (from: string, to: string, pos: Int) => Promise<void>;
}

export type RPC = {
	waitLogin:             () => Promise<Int>;
	waitCurrentUserMap:    () => Subscription<Int>;
	waitCharacterChange:   () => Subscription<Int>;
	waitMapChange:         () => Subscription<MapDetails>; //check type
	waitLayerAdd:          () => Subscription<Layer>;      //check type
	waitLayerRename:       () => Subscription<FromTo>;     //check type
	waitLayerRemove:       () => Subscription<Int[]>;      //check type
	waitLayerOrderChange:  () => Subscription<Int[]>;      //check type
	waitMapLightChange:    () => Subscription<Colour>;     //check type
	waitMapInitiative:     () => Subscription<IDName[]>;   //check type
	waitLayerShow:         () => Subscription<Int>;        //check type
	waitLayerHide:         () => Subscription<Int>;        //check type
	waitLayerMaskAdd:      () => Subscription<Int>;        //check type
	waitLayerMaskChange:   () => Subscription<Int>;        //check type
	waitLayerMaskRemove:   () => Subscription<Int>;        //check type
	waitLayerTokenOrder:   () => Subscription<Int[]>;      //check type
	waitTokenAdd:          () => Subscription<Int>;        //check type
	waitTokenRemove:       () => Subscription<Int>;        //check type
	waitTokenMove:         () => Subscription<Int>;        //check type
	waitTokenResize:       () => Subscription<Int>;        //check type
	waitTokenRotate:       () => Subscription<Int>;        //check type
	waitTokenSetToken:     () => Subscription<Int>;        //check type
	waitTokenSetImage:     () => Subscription<Int>;        //check type
	waitTokenSetPattern:   () => Subscription<Int>;        //check type

	images:     FolderRPC,
	audio:      FolderRPC,
	characters: FolderRPC,
	maps:       FolderRPC,

	connID: () => Promise<Int>;

	waitTokenChange:        () => Subscription<Token>;
	waitMaskChange:         () => Subscription<Int>;

	setCurrentMap: (id: Int) => Promise<void>;
	getUserMap:    ()        => Promise<Int>;
	setUserMap:    (id: Int) => Promise<void>;

	newMap:        (map: MapDetails)        => Promise<IDName>;
	getMapDetails: (id: Int)                => Promise<MapDetails>;
	setMapDetails: (map: MapDetails)        => Promise<void>;

	addLayer:        (name: string)                                    => Promise<string>;
	addLayerFolder:  (path: string)                                    => Promise<string>;
	renameLayer:     (from: string, to: string)                        => Promise<void>;
	moveLayer:       (from: string, to: string, position: Int)         => Promise<void>;
	showLayer:       (path: string)                                    => Promise<void>;
	hideLayer:       (path: string)                                    => Promise<void>;
	addMask:         (path: string, mask: Int)                         => Promise<void>;
	removeMask:      (path: string)                                    => Promise<void>;
	removeLayer:     (path: string)                                    => Promise<void>;
	addToken:        (path: string, token: Token)                      => Promise<void>;
	removeToken:     (path: string, pos: Int)                          => Promise<void>;
	moveToken:       (path: string, pos: Int, x: Int, y: Int)          => Promise<void>;
	resizeToken:     (path: string, pos: Int, width: Int, height: Int) => Promise<void>;
	rotateToken:     (path: string, pos: Int, rotation: Int)           => Promise<void>;
	flipToken:       (path: string, pos: Int, flip: boolean)           => Promise<void>;
	flopToken:       (path: string, pos: Int, flop: boolean)           => Promise<void>;
	setTokenPattern: (path: string, pos: Int)                          => Promise<void>;
	setTokenImage:   (path: string, pos: Int)                          => Promise<void>;
	setTokenSource:  (path: string, pos: Int, source: string)          => Promise<void>;
	setTokenLayer:   (path: string, pos: Int, layer: Int[])            => Promise<void>;
	setTokenTop:     (path: string, pos: Int)                          => Promise<void>;
	setTokenBottom:  (path: string, pos: Int)                          => Promise<void>;
	setInitiative:   (initiative: Int[])                               => Promise<void>;

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

export type MapDetails = {
	id:     Int;
	name:   string;
	width:  Int;
	height: Int;
	square: Int;
	colour: Colour;
	stroke: Int;
};

export type Token = {
	source:      string;
	stroke:      Colour;
	strokeWidth: Int;
	id:          Int;
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
	mask: Int;
}

export type LayerFolder = FolderItems & {
	id: Int;
	name: string;
	hidden: boolean;
	children: (Layer | LayerFolder)[];
}
