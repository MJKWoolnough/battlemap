import {createHTML, button} from './lib/html.js';
import {RPC} from './types.js';

export default function (rpc: RPC, base: HTMLElement, loggedIn: boolean) {
	createHTML(base, [
		button({"onclick": () => rpc.logout().then(() => window.location.reload())}, "Logout")
	]);
};
