import type {Int} from './types.js';
import {Pipe} from './lib/inter.js';

class Setting<T> {
	name: string;
	value: T;
	#pipe = new Pipe<T>();
	constructor(name: string, value: T) {
		this.name = name;
		this.value = value;
	}
	set(v: T, s: string | null) {
		this.value = v;
		if (s === null) {
			window.localStorage.removeItem(this.name);
		} else {
			window.localStorage.setItem(this.name, s);
		}
		this.#pipe.send(v);
		return this;
	}
	remove() {
		window.localStorage.removeItem(this.name);
		return this;
	}
	wait(fn: (value: T) => void) {
		fn(this.value);
		this.#pipe.receive(fn);
		return this;
	}
}

export class BoolSetting extends Setting<boolean> {
	constructor(name: string) {
		super(name, window.localStorage.getItem(name) !== null);
	}
	set(b: boolean) {
		return super.set(b, b ? "" : null);
	}
}

export class IntSetting extends Setting<Int> {
	constructor(name: string, starting = "0") {
		super(name, parseInt(window.localStorage.getItem(name) || starting));
	}
	set(i: Int) {
		return super.set(i, i + "");
	}
}

export class StringSetting extends Setting<string> {
	constructor(name: string, starting = "") {
		super(name, window.localStorage.getItem(name) ?? starting);
	}
	set(s: string) {
		return super.set(s, s);
	}
}

export class JSONSetting<T> extends Setting<T> {
	constructor(name: string, starting: T, validator: (v: any) => v is T) {
		super(name, starting);
		const s = window.localStorage.getItem(name);
		if (s) {
			try {
				const v = JSON.parse(s);
				if (validator(v)) {
					this.value = v;
				}
			} catch {}
		}
	}
	set(v: T) {
		return super.set(v, JSON.stringify(v));
	}
}
