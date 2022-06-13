import {JSONSetting} from './lib/settings.js';

const keys = new JSONSetting<Record<string, string>>("keys", {}, (v: any): v is Record<string, string> => {
	for (const k in v) {
		if (typeof v[k] !== "string") {
			return false;
		}
	}
	return true;
      }),
      names: Record<string, string> = {};

export const registerKey = (id: string, name: string, defaultKey = "") => {
	names[id] = name;
	return keys.value[id] ?? (keys.value[id] = defaultKey);
},
setKey = (id: string, key: string) => {
	keys.set(Object.assign(keys.value, {[id]: key}));
},
getKey = (id: string) => keys.value[id],
getKeyName = (id: string) => names[id],
getKeyIDs = () => Object.keys(names);
