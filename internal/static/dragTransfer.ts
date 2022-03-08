import type {Byte, IDName, WidthHeight} from './types.js';
import type {Colour} from './colours.js';

export type FolderDragItem = IDName & WidthHeight;

interface Transfer<T> {
	transfer(): T | undefined;
}

interface CheckedDragEvent extends DragEvent {
	dataTransfer: DataTransfer;
}

interface CheckedDT<T> extends DragTransfer<T> {
	get(e: DragEvent): T;
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
	set(e: DragEvent, key: string, icon?: HTMLDivElement, xOffset = -5, yOffset = -5) {
		e.dataTransfer?.setData(this.#format, key);
		if (icon) {
			e.dataTransfer?.setDragImage(icon, xOffset, yOffset);
		}
	}
	deregister(key: string) {
		this.#data.delete(key);
	}
	is (e: DragEvent): this is CheckedDT<T> {
		return e.dataTransfer?.types.includes(this.#format) ?? false;
	}
	static has(e: DragEvent, ...keys: (DragTransfer | string)[]): e is CheckedDragEvent {
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
