import {HTTPRequest} from './lib/conn.js';
import {Pipe} from './lib/inter.js';
import {createHTML, button, br, h1, input, label} from './lib/html.js';
import {Int, RPC} from './types.js';
import {ShellElement} from './windows.js';
import {settings as pluginSettings} from './plugins.js';

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


export const autosnap = new BoolSetting("autosnap"),
hideMenu = new BoolSetting("menuHide"),
scrollAmount = new IntSetting("scrollAmount"),
undoLimit = new IntSetting("undoLimit", "100"),
invert = new BoolSetting("invert");

export default function (rpc: RPC, shell: ShellElement, base: HTMLElement, loggedIn: boolean) {
	createHTML(base, [
		h1("Authentication"),
		loggedIn ? button({"onclick": () => HTTPRequest("login/logout").then(() => window.location.reload())}, "Logout") : button({"onclick": () => HTTPRequest("login/login").then(() => window.location.reload())}, "Login"),
		br(),
		h1("Theme"),
		button({"onclick": function(this: HTMLButtonElement) {
			this.innerText = invert.set(!invert.value) ? "Light Mode" : "Dark Mode"
		}}, invert.value ? "Light Mode" : "Dark Mode"),
		h1("Map Settings"),
		loggedIn ? [
			input({"type": "checkbox", "id": "autosnap", "checked": autosnap.value, "onchange": function(this: HTMLInputElement) {
				autosnap.set(this.checked);
			}}),
			label({"for": "autosnap"}, "Autosnap: "),
			br()
		] : [],
		label({"for": "scrollAmount"}, "Scroll (zero is square width): "),
		input({"id": "scrollAmount", "type": "number", "value": scrollAmount.value, "step": 1, "onchange": function(this: HTMLInputElement) {
			scrollAmount.set(parseInt(this.value));
		}}),
		br(),
		label({"for": "undoLimit"}, "Undo Limit (-1 for infinite, 0 to disable): "),
		input({"id": "undoLimit", "type": "number", "value": undoLimit.value, "step": 1, "min": "-1", "onchange": function(this: HTMLInputElement) {
			undoLimit.set(parseInt(this.value));
		}}),
		br(),
		label({"for": "menuHide"}, "Hide Menu Button?: "),
		input({"id": "menuHide", "type": "checkbox", "checked": hideMenu.value, "onchange": function(this: HTMLInputElement) {
			hideMenu.set(this.checked);
		}}),
		pluginSettings(),
		h1("Reset"),
		button({"onclick": () => shell.confirm("Are you sure?", "Are you sure that you wish to clear all settings? This cannot be undone").then(v => {
			if (!v) {
				return;
			}
			window.localStorage.clear();
			window.location.reload();
		})}, "Clear All Settings")
	]);
};
