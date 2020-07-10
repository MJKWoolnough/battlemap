import {Int, KeystoreData, RPC} from './types.js';

let rpc: RPC;

export const characterData = new Map<Int, Record<string, KeystoreData>>(),
tokenData = new Map<Int, Record<string, KeystoreData>>();

export default function (arpc: RPC) {
	rpc = arpc;
	rpc.waitCharacterDataChange().then(d => {
		const char = characterData.get(d.id);
		if (char) {
			Object.assign(char, d.data);
		}
	});
	rpc.waitCharacterDataRemove().then(d => {
		const char = characterData.get(d.id);
		if (char) {
			d.keys.forEach(k => delete char[k]);
		}
	});
	rpc.waitTokenDataChange().then(d => {
		const tk = tokenData.get(d.id);
		if (tk) {
			Object.assign(tk, d.data);
		}
	});
	rpc.waitTokenDataRemove().then(d => {
		const tk = tokenData.get(d.id);
		if (tk) {
			d.keys.forEach(k => delete tk[k]);
		}
	});
};
