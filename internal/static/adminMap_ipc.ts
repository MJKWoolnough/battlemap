import {LayerRPC, Uint} from './types.js';
import {SVGLayer, SVGToken, SVGShape} from './map.js';
import {Pipe, Requester} from './lib/inter.js';

export const {send: mapLoadSend, receive: mapLoadReceive} = new Pipe<Uint>(),
{send: mapLayersSend, receive: mapLayersReceive} = new Pipe<LayerRPC>(),
{request: requestSelected, responder: respondWithSelected} = new Requester<{
	layer: SVGLayer | null;
	layerPath: string;
	token: SVGToken | SVGShape | null;
}>();
