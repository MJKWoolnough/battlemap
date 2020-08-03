import {LayerRPC, Uint} from './types.js';
import {Pipe} from './lib/inter.js';

export const {send: mapLoadSend, receive: mapLoadReceive} = new Pipe<Uint>(),
{send: mapLayersSend, receive: mapLayersReceive} = new Pipe<LayerRPC>();
