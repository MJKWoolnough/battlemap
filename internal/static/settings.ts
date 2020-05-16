import {HTTPRequest} from './lib/conn.js';
import {createHTML, button, br, h1, input, label} from './lib/html.js';
import {Int, RPC} from './types.js';

class BoolSetting {
	name: string;
	value: boolean;
	constructor(name: string) {
		this.name = name;
		this.value = window.localStorage.getItem(name) !== null;
	}
	set(b: boolean) {
		this.value = b;
		if (b) {
			window.localStorage.setItem(this.name, "");
		} else {
			window.localStorage.removeItem(this.name);
		}
		return b;
	}
}

class IntSetting {
	name: string;
	value: Int;
	constructor(name: string) {
		this.name = name;
		this.value = parseInt(window.localStorage.getItem("name") || "0");
	}
	set(i: Int) {
		this.value = i;
		window.localStorage.setItem("name", i.toString());
	}
}

const invert = new BoolSetting("invert");

export const autosnap = new BoolSetting("autosnap"),
scrollAmount = new IntSetting("scrollAmount");

export default function (rpc: RPC, base: HTMLElement, loggedIn: boolean) {
	const htmlElement = document.getElementsByTagName("html")[0];
	if (invert.value) {
		htmlElement.classList.add("invert");
	}
	createHTML(base, [
		h1("Authentication"),
		loggedIn ? button({"onclick": () => HTTPRequest("login/logout").then(() => window.location.reload())}, "Logout") : button({"onclick": () => HTTPRequest("login/login").then(() => window.location.reload())}, "Login"),
		br(),
		h1("Theme"),
		button({"onclick": function(this: HTMLButtonElement) {
			this.innerText = invert.set(htmlElement.classList.toggle("invert")) ? "Light Mode" : "Dark Mode"
		}}, invert.value ? "Light Mode" : "Dark Mode"),
		h1("Map Settings"),
		loggedIn ? [
			input({"type": "checkbox", "id": "autosnap", "checked": window.localStorage.getItem("autosnap"), "onchange": function(this: HTMLInputElement) {
				autosnap.set(this.checked);
			}}),
			label({"for": "autosnap"}, "Autosnap: "),
			br()
		] : [],
		label({"for": "scrollAmount"}, "Scroll (zero is square width): "),
		input({"id": "scrollAmount", "type": "number", "value": scrollAmount.value, "step": 1, "onchange": function(this: HTMLInputElement) {
			scrollAmount.set(parseInt(this.value));
			scrollAmount.value;
		}}),
		h1("Other"),
		button({"onclick": () => {
			window.localStorage.clear();
			window.location.reload();
		}}, "Clear All Settings (Cannot be undone)")
	]);
};
