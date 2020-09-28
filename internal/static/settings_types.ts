import {Int} from './types.js';
import {Pipe} from './lib/inter.js';

const boolPipes = new Map<BoolSetting, Pipe<boolean>>(),
      intPipes = new Map<IntSetting, Pipe<Int>>(),
      stringPipes = new Map<StringSetting, Pipe<string>>()

export class BoolSetting {
	name: string;
	value: boolean;
	constructor(name: string) {
		this.name = name;
		this.value = window.localStorage.getItem(name) !== null;
		boolPipes.set(this, new Pipe<boolean>());
	}
	set(b: boolean) {
		this.value = b;
		if (b) {
			window.localStorage.setItem(this.name, "");
		} else {
			window.localStorage.removeItem(this.name);
		}
		boolPipes.get(this)!.send(b);
		return b;
	}
	remove() {
		window.localStorage.removeItem(this.name);
	}
	wait(fn: (value: boolean) => void) {
		boolPipes.get(this)!.receive(fn);
	}
}

export class IntSetting {
	name: string;
	value: Int;
	constructor(name: string, starting = "0") {
		this.name = name;
		this.value = parseInt(window.localStorage.getItem(name) || starting);
		intPipes.set(this, new Pipe<Int>());
	}
	set(i: Int) {
		this.value = i;
		window.localStorage.setItem(this.name, i.toString());
		intPipes.get(this)!.send(i);
	}
	remove() {
		window.localStorage.removeItem(this.name);
	}
	wait(fn: (value: Int) => void) {
		intPipes.get(this)!.receive(fn);
	}
}

export class StringSetting {
	name: string;
	value: string;
	constructor(name: string, starting = "") {
		this.name = name;
		this.value = window.localStorage.getItem(name) ?? starting;
		stringPipes.set(this, new Pipe<string>());
	}
	set(s: string) {
		this.value = s;
		window.localStorage.setItem(this.name, s);
		stringPipes.get(this)!.send(s);
	}
	remove() {
		window.localStorage.removeItem(this.name);
	}
	wait(fn: (value: string) => void) {
		stringPipes.get(this)!.receive(fn);
	}
}
