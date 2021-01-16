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
handleError = (e: Error | string) => {
	console.log(e);
	requestShell().alert("Error", e instanceof Error ? e.message : typeof e  === "object" ? JSON.stringify(e) : e);
},
{send: rpcInitSend, receive: rpcInitReceive} = pipeBind<void>(),
{send: mapLoadSend, receive: mapLoadReceive} = pipeBind<Uint>(),
{send: mapLayersSend, receive: mapLayersReceive} = pipeBind<LayerRPC>(),
{send: mapLoadedSend, receive: mapLoadedReceive} = pipeBind<boolean>(),
{send: tokenSelected, receive: tokenSelectedReceive} = pipeBind<void>(),
{request: requestShell, responder: respondWithShell} = requesterBind<ShellElement>(),
{request: requestAudioAssetName, responder: respondWithAudioAssetName} = requesterBind<() => void, [Uint, (name: string) => void]>(),
point2Line = (px: Int, py: Int, x1: Int, y1: Int, x2: Int, y2: Int) => {
	if (x1 === x2) {
		if (py >= y1 && py <= y2) {
			return Math.abs(px - x1);
		}
		return Math.hypot(px - x1, Math.min(Math.abs(py - y1), Math.abs(py - y2)));
	} else if (y1 === y2) {
		if (px >= x1 && px <= x2) {
			return Math.abs(py - y1);
		}
		return Math.hypot(Math.min(Math.abs(px - x1), Math.abs(px - x2)), py - y1);
	}
	const m = (y2 - y1) / (x2 - x1),
	      n = (x1 - x2) / (y2 - y1),
	      c = y1 - m * x1,
	      d = py - px * n;
	let cx = (d - c) / (m - n);
	if (cx < x1) {
		cx = x1;
	} else if (cx > x2) {
		cx = x2;
	}
	return Math.hypot(px - cx, py - m * cx - c);
},
isInt = (v: any, min = -Infinity, max = Infinity): v is Int => typeof v === "number" && (v|0) === v && v >= min && v <= max,
isUint = (v: any, max = Infinity): v is Uint => isInt(v, 0, max),
queue = (() => {
	let p = Promise.resolve();
	return (fn: () => Promise<any>) => p = p.finally(fn);
})();
