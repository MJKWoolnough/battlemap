import {Int, Uint, LayerRPC} from './types.js';
import {ShellElement} from './lib/windows.js';
import {Pipe, Requester} from './lib/inter.js';

const pipeBind = <T>() => {
	const p = new Pipe<T>();
	return {"send": (data: T) => p.send(data), "receive": (fn: (data: T) => void) => p.receive(fn)};
      },
      requesterBind = <T, U extends any[] = any[]>() => {
	const r = new Requester<T, U>();
	return {"request": (...data: U) => r.request(...data), "responder": (fn: ((...data: U) => T) | T) => r.responder(fn)};
      };

export const enterKey = function(this: Node, e: KeyboardEvent): void {
	if (e.keyCode === 13) {
		for (let e = this.nextSibling; e != null; e = e.nextSibling) {
			if (e instanceof HTMLButtonElement) {
				e.click();
				break;
			}
		}
	}
},
{send: rpcInitSend, receive: rpcInitReceive} = pipeBind<void>(),
{send: mapLoadSend, receive: mapLoadReceive} = pipeBind<Uint>(),
{send: mapLayersSend, receive: mapLayersReceive} = pipeBind<LayerRPC>(),
{send: mapLoadedSend, receive: mapLoadedReceive} = pipeBind<boolean>(),
{send: tokenSelected, receive: tokenSelectedReceive} = pipeBind<void>(),
{request: requestShell, responder: respondWithShell} = requesterBind<ShellElement>(),
{request: requestAudioAssetName, responder: respondWithAudioAssetName} = requesterBind<() => void, [Uint, (name: string) => void]>(),
isInt = (v: any, min = -Infinity, max = Infinity): v is Int => typeof v === "number" && (v|0) === v && v >= min && v <= max,
isUint = (v: any, max = Infinity): v is Uint => isInt(v, 0, max),
queue = (() => {
	let p = Promise.resolve();
	return (fn: () => Promise<any>) => p = p.finally(fn);
})();
