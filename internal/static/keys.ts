import type {Children} from './lib/dom.js';
import {keyEvent} from './lib/events.js';
import {JSONSetting} from './lib/settings.js';

const keys = new JSONSetting<Record<string, string>>("keys", {}, (v: any): v is Record<string, string> => {
	for (const k in v) {
		if (typeof v[k] !== "string") {
			return false;
		}
	}
	return true;
      }),
      names: Record<string, [Children, (key: string) => void]> = {};

export const registerKeyEvent = (id: string, name: Children, defaultKey: string, onkeydown?: (e: KeyboardEvent) => void, onkeyup?: (e: KeyboardEvent) => void, once = false) => {
	const fns = keyEvent(keys.value[id] ??= defaultKey, onkeydown, onkeyup, once);
	names[id] = [name, fns[2]];
	return fns;
},
setKey = (id: string, key: string = "") => {
	names[id]?.[1](key);
	keys.value[id] = key;
	keys.set(keys.value);
},
getKey = (id: string) => keys.value[id],
getKeyName = (id: string) => names[id][0],
getKeyIDs = () => Object.keys(names);
