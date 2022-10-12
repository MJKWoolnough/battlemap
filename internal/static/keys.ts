import type {Bind} from './lib/dom.js';
import {JSONSetting} from './lib/settings.js';

const keys = new JSONSetting<Record<string, string>>("keys", {}, (v: any): v is Record<string, string> => {
	for (const k in v) {
		if (typeof v[k] !== "string") {
			return false;
		}
	}
	return true;
      }),
      names: Record<string, string | Bind> = {};

export const registerKey = (id: string, name: string | Bind, defaultKey: string) => {
	names[id] = name;
	return keys.value[id] ??= defaultKey;
},
setKey = (id: string, key: string = "") => {
	keys.value[id] = key;
	keys.set(keys.value);
},
getKey = (id: string) => keys.value[id],
getKeyName = (id: string) => names[id],
getKeyIDs = () => Object.keys(names);
