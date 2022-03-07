import type {Byte, IDName, WidthHeight} from './types.js';
import type {Colour} from './colours.js';

export type FolderDragItem = IDName & WidthHeight;

interface Transfer<T> {
	transfer(): T | undefined;
}

interface CheckedDT<T, D extends DataTransfer | null> extends DragTransfer<T> {
	get(d: D): T;
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
	get(d: DataTransfer | null): T | undefined {
		return this.#data.get(d?.getData(this.#format) ?? "")?.transfer();
	}
	set(d: DataTransfer | null, key: string) {
		d?.setData(this.#format, key);
	}
	deregister(key: string) {
		this.#data.delete(key);
	}
	is <CheckedDataTransfer extends DataTransfer | null>(d: CheckedDataTransfer): this is CheckedDT<T, CheckedDataTransfer> {
		return d?.types.includes(this.#format) ?? false;
	}
	static has(d: DataTransfer | null, ...keys: (DragTransfer | string)[]) {
		for (const key of keys) {
			if (d?.types.includes(typeof key === "string" ? key : key.#format)) {
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
