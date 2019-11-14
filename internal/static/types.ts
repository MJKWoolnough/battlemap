import {Subscription} from './lib/inter.js';

// export type Int = number & { __int__: void };
export type Int = number;

export type RPC = {
	waitLogin:           () => Promise<Int>;
	waitCurrentUserMap:  () => Promise<Int>;

	waitMapAdd:          () => Subscription<Map>;
	waitMapChange:       () => Subscription<Int>;
	waitMapRename:       () => Subscription<Map>;
	waitMapOrderChange:  () => Subscription<Map[]>;
	waitAssetAdd:        () => Subscription<Asset[]>;
	waitAssetChange:     () => Subscription<Asset>;
	waitAssetRemove:     () => Subscription<Int>;
	waitTagAdd:          () => Subscription<Tag[]>;
	waitTagRemove:       () => Subscription<Int>;
	waitTagChange:       () => Subscription<Tag[]>;
	waitCharacterAdd:    () => Subscription<Record<string, string>>;
	waitCharacterChange: () => Subscription<Record<string, string>>;
	waitCharacterRemove: () => Subscription<Int>;
	waitTokenChange:     () => Subscription<Token>;
	waitMaskChange:      () => Subscription<Int>;

	connID: () => Promise<Int>;

	deleteAsset:         (id: Int)               => Promise<Int>;
	renameAsset:         (id: Int, name: string) => Promise<string>;
	addTagsToAsset:      (id: Int, tags: Int[])  => Promise<boolean>;
	removeTagsFromAsset: (id: Int, tags: Int[])  => Promise<boolean>;
	getAssets:           ()                      => Promise<Record<Int, Asset>>;

	addTag:    (name: string)          => Promise<Int>;
	deleteTag: (id: Int)               => Promise<Int>;
	renameTag: (id: Int, name: string) => Promise<string>;
	getTags:   ()                      => Promise<Record<Int, Tag>>;

	getCurrentMap: ()        => Promise<Int>;
	setCurrentMap: (id: Int) => Promise<void>;
	getUserMap:    ()        => Promise<Int>;
	setUserMap:    (id: Int) => Promise<void>;

	newMap:              (map: NewMap)                                                           => Promise<Int>;
	renameMap:           (id: Int, name: string)                                                 => Promise<void>;
	changeMapDimensions: (id: Int, width: Int, height: Int)                                      => Promise<void>;
	changeGrid:          (id: Int, squaresWidth: Int, squaresColour: Colour, squaresStroke: Int) => Promise<void>;
	moveMap:             (id: Int, position: Int)                                                => Promise<void>;

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

export type Tag = {
	id:     Int;
	name:   string;
	assets: Int[];
};

export type Asset = {
	id:   Int;
	name: string;
	type: string;
	tags: Int[];
};

export type Colour = {
	r: Int;
	g: Int;
	b: Int;
	a: Int;
};

export type NewMap = {
	width:         Int;
	height:        Int;
	squaresWidth:  Int;
	squaresColour: Colour;
	squaresStroke: Int;
	name:          string;
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
