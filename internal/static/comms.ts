import {LayerRPC, MapData, RPC, Uint} from './types.js';
import {SVGLayer, SVGToken, SVGShape} from './map.js';
import {Pipe, Requester} from './lib/inter.js';
import {ShellElement} from './windows.js';
import Undo from './undo.js';

export const {send: mapLoadSend, receive: mapLoadReceive} = new Pipe<Uint>(),
{send: mapLayersSend, receive: mapLayersReceive} = new Pipe<LayerRPC>(),
{request: requestShell, responder: respondWithShell} = new Requester<ShellElement>();
