import {HTTPRequest} from './lib/conn.js';
import {createHTML, button} from './lib/html.js';
import {RPC} from './types.js';

export default function (rpc: RPC, base: HTMLElement, loggedIn: boolean) {
	createHTML(base, [
		loggedIn ? button({"onclick": () => HTTPRequest("login/logout").then(() => window.location.reload())}, "Logout") : button({"onclick": () => HTTPRequest("login/login").then(() => window.location.reload())}, "Login")
	]);
};
