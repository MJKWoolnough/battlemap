import {Int} from './types.js';
import {Pipe} from './lib/inter.js';

const pipes = new Map<Setting<any>, Pipe<any>>();

class Setting<T> {
	name: string;
	constructor(name: string) {
		this.name = name;
		pipes.set(this, new Pipe<T>());
	}
	remove() {
		window.localStorage.removeItem(this.name);
	}
	wait(fn: (value: T) => void) {
		pipes.get(this)!.receive(fn);
	}
}

export class BoolSetting extends Setting<boolean> {
	value: boolean;
	constructor(name: string) {
		super(name);
		this.value = window.localStorage.getItem(name) !== null;
	}
	set(b: boolean) {
		this.value = b;
		if (b) {
			window.localStorage.setItem(this.name, "");
		} else {
			window.localStorage.removeItem(this.name);
		}
		pipes.get(this)!.send(b);
		return b;
	}
}

export class IntSetting extends Setting<Int> {
	value: Int;
	constructor(name: string, starting = "0") {
		super(name);
		this.value = parseInt(window.localStorage.getItem(name) || starting);
	}
	set(i: Int) {
		this.value = i;
		window.localStorage.setItem(this.name, i.toString());
		pipes.get(this)!.send(i);
	}
}

export class StringSetting extends Setting<string> {
	value: string;
	constructor(name: string, starting = "") {
		super(name);
		this.value = window.localStorage.getItem(name) ?? starting;
	}
	set(s: string) {
		this.value = s;
		window.localStorage.setItem(this.name, s);
		pipes.get(this)!.send(s);
	}
}

export class JSONSetting<T> extends Setting<T> {
	value: T;
	constructor(name: string, starting: T, validator: (v: any) => v is T) {
		super(name);
		this.value = starting;
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
		this.value = v;
		window.localStorage.setItem(this.name, JSON.stringify(v));
		pipes.get(this)!.send(v);
	}
}
