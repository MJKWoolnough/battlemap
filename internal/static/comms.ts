import {LayerRPC, MapData, RPC, Uint} from './types.js';
import {SVGLayer, SVGToken, SVGShape} from './map.js';
import {Pipe, Requester} from './lib/inter.js';
import {ShellElement} from './windows.js';
import Undo from './undo.js';

export const {send: mapLoadSend, receive: mapLoadReceive} = new Pipe<Uint>(),
{send: mapLayersSend, receive: mapLayersReceive} = new Pipe<LayerRPC>(),
{request: requestSelected, responder: respondWithSelected} = new Requester<{
	layer: SVGLayer | null;
	layerPath: string;
	token: SVGToken | SVGShape | null;
	outline: SVGGElement;
	deselectToken: () => void;
}>(),
{request: requestMapUndo, responder: respondWithMapUndo} = new Requester<Undo>(),
{request: requestMapData, responder: respondWithMapData} = new Requester<MapData>(),
{request: requestSVGRoot, responder: respondWithSVGRoot} = new Requester<SVGSVGElement>(),
{request: requestShell, responder: respondWithShell} = new Requester<ShellElement>(),
{request: requestRPC, responder: respondWithRPC} = new Requester<RPC>();
