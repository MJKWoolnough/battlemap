import {Int} from './types.js';
import {Pipe} from './lib/inter.js';

const pipes = new Map<Setting<any>, Pipe<any>>();

class Setting<T> {
	name: string;
	value: T;
	constructor(name: string, value: T) {
		this.name = name;
		this.value = value;
		pipes.set(this, new Pipe<T>());
	}
	set(v: T, s: string) {
		this.value = v;
		window.localStorage.setItem(this.name, s);
		pipes.get(this)?.send(v);
	}
	remove() {
		window.localStorage.removeItem(this.name);
	}
	wait(fn: (value: T) => void) {
		pipes.get(this)?.receive(fn);
	}
}

export class BoolSetting extends Setting<boolean> {
	constructor(name: string) {
		super(name, window.localStorage.getItem(name) !== null);
	}
	set(b: boolean) {
		this.value = b;
		if (b) {
			window.localStorage.setItem(this.name, "");
		} else {
			window.localStorage.removeItem(this.name);
		}
		pipes.get(this)?.send(b);
	}
}

export class IntSetting extends Setting<Int> {
	constructor(name: string, starting = "0") {
		super(name, parseInt(window.localStorage.getItem(name) || starting));
	}
	set(i: Int) {
		super.set(i, i.toString());
	}
}

export class StringSetting extends Setting<string> {
	constructor(name: string, starting = "") {
		super(name, window.localStorage.getItem(name) ?? starting);
	}
	set(s: string) {
		super.set(s, s);
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
		super.set(v, JSON.stringify(v));
	}
}
