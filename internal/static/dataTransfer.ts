import type {Byte, IDName, WidthHeight} from './types.js';
import type {Colour} from './colours.js';

export type FolderDragItem = IDName & WidthHeight;

interface Transfer<T> {
	transfer(): T | undefined;
}

interface CheckedDT<T, E extends DragEvent> extends DragTransfer<T> {
	get(e: E): T;
}

export class DragTransfer<T = any> {
	#data = new Map<string, Transfer<T>>();
	#nextID = 0;
	#format: string;
	constructor(format: string) {
		this.#format = format;
	}
	register(t: Transfer<T>) {
		const key = this.#nextID++ + "";
		this.#data.set(key, t);
		return key;
	}
	get(e: DragEvent): T | undefined {
		return this.#data.get(e.dataTransfer?.getData(this.#format) ?? "")?.transfer();
	}
	set(e: DragEvent, key: string) {
		e.dataTransfer?.setData(this.#format, key);
	}
	deregister(key: string) {
		this.#data.delete(key);
	}
	is <CheckedDragEvent extends DragEvent>(e: CheckedDragEvent): this is CheckedDT<T, CheckedDragEvent> {
		return e.dataTransfer?.types.includes(this.#format) ?? false;
	}
	static has(e: DragEvent, ...keys: (DragTransfer | string)[]) {
		for (const key of keys) {
			if (e.dataTransfer?.types.includes(typeof key === "string" ? key : key.#format)) {
				return true;
			}
		}
		return false;
	}
}

export const audioAsset = new DragTransfer<FolderDragItem>("audioasset"),
character = new DragTransfer<FolderDragItem>("character"),
colour = new DragTransfer<Colour>("colour"),
imageAsset = new DragTransfer<FolderDragItem>("imageasset"),
map = new DragTransfer<FolderDragItem>("map"),
musicPack = new DragTransfer<IDName>("musicpack"),
scattering = new DragTransfer<Byte>("scattering");
