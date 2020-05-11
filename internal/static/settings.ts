import {HTTPRequest} from './lib/conn.js';
import {createHTML, button, br} from './lib/html.js';
import {RPC} from './types.js';

export default function (rpc: RPC, base: HTMLElement, loggedIn: boolean) {
	const htmlElement = document.getElementsByTagName("html")[0];
	if (window.localStorage.getItem("invert") !== null) {
		htmlElement.classList.add("invert");
	}
	createHTML(base, [
		loggedIn ? button({"onclick": () => HTTPRequest("login/logout").then(() => window.location.reload())}, "Logout") : button({"onclick": () => HTTPRequest("login/login").then(() => window.location.reload())}, "Login"),
		br(),
		button({"onclick": function(this: HTMLButtonElement) {
			if (htmlElement.classList.toggle("invert")) {
				window.localStorage.setItem("invert", "");
				this.innerText = "Light Mode";
			} else {
				window.localStorage.removeItem("invert");
				this.innerText = "Dark Mode";
			}
		}}, htmlElement.classList.contains("invert") ? "Light Mode" : "Dark Mode")
	]);
};
