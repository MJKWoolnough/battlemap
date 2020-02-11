import {Subscription} from './lib/inter.js';

export {LayerType} from './lib/layers.js';

// export type Int = number & { __int__: void };
export type Int = number;

export type AssetRPC = {
	waitAssetAdded:    () => Subscription<IDName[]>;
	waitAssetMoved:    () => Subscription<FromTo>;
	waitAssetRemoved:  () => Subscription<string>;
	waitAssetLinked:   () => Subscription<IDName>;
	waitFolderAdded:   () => Subscription<string>;
	waitFolderMoved:   () => Subscription<FromTo>;
	waitFolderRemoved: () => Subscription<string>;

	getAssets:    ()                         => Promise<Folder>;
	createFolder: (path: string)             => Promise<string>;
	moveAsset:    (from: string, to: string) => Promise<string>;
	moveFolder:   (from: string, to: string) => Promise<string>;
	removeAsset:  (path: string)             => Promise<void>;
	removeFolder: (path: string)             => Promise<void>;
	linkAsset:    (id: Int, name: string)    => Promise<string>;
}

export type RPC = {
	waitLogin:           () => Promise<Int>;
	waitCurrentUserMap:  () => Promise<Int>;

	waitMapAdd:             () => Subscription<Map>;
	waitMapChange:          () => Subscription<Int>;
	waitMapRename:          () => Subscription<Map>;
	waitMapOrderChange:     () => Subscription<Map[]>;

	images: AssetRPC,
	audio:  AssetRPC,

	waitCharacterAdd:       () => Subscription<Record<string, string>>;
	waitCharacterChange:    () => Subscription<Record<string, string>>;
	waitCharacterRemove:    () => Subscription<Int>;
	waitTokenChange:        () => Subscription<Token>;
	waitMaskChange:         () => Subscription<Int>;

	connID: () => Promise<Int>;

	getMapList:    ()        => Promise<Map[]>;
	setCurrentMap: (id: Int) => Promise<void>;
	getUserMap:    ()        => Promise<Int>;
	setUserMap:    (id: Int) => Promise<void>;

	newMap:        (map: MapDetails)        => Promise<Int>;
	renameMap:     (id: Int, name: string)  => Promise<void>;
	getMapDetails: (id: Int)                => Promise<MapDetails>;
	setMapDetails: (map: MapDetails)        => Promise<void>;
	moveMap:       (id: Int, position: Int) => Promise<void>;
	removeMap:     (id: Int)                => Promise<void>;

	addLayer:        (name: string)                     => Promise<Int>;
	renameLayer:     (id: Int, name: string)            => Promise<void>;
	moveLayer:       (id: Int, position: Int)           => Promise<void>;
	showLayer:       (id: Int)                          => Promise<void>;
	hideLayer:       (id: Int)                          => Promise<void>;
	addMask:         (id: Int, mask: Int)               => Promise<void>;
	removeMask:      (id: Int)                          => Promise<void>;
	removeLayer:     (id: Int)                          => Promise<void>;
	addToken:        (token: Token, layerID: Int)       => Promise<Int>;
	removeToken:     (id: Int)                          => Promise<void>;
	moveToken:       (id: Int, x: Int, y: Int)          => Promise<void>;
	resizeToken:     (id: Int, width: Int, height: Int) => Promise<void>;
	rotateToken:     (id: Int, rotation: Int)           => Promise<void>;
	flipToken:       (id: Int, flip: boolean)           => Promise<void>;
	flopToken:       (id: Int, flop: boolean)           => Promise<void>;
	setTokenPattern: (id: Int)                          => Promise<void>;
	setTokenImage:   (id: Int)                          => Promise<void>;
	setTokenSource:  (id: Int, source: string)          => Promise<void>;
	setTokenLayer:   (id: Int, layer: Int)              => Promise<void>;
	setTokenTop:     (id: Int)                          => Promise<void>;
	setTokenBottom:  (id: Int)                          => Promise<void>;
	setInitiative:   (initiative: Int[])                => Promise<void>;

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

export type Folder = {
	folders: Record<string, Folder>;
	assets:  Record<string, Int>;
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
