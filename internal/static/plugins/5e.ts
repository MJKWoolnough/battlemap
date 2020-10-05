import {addPlugin} from '../plugins.js';
import {item} from '../lib/context.js';
import {globals, SVGToken} from '../map.js';

addPlugin("5e", {
	"tokenContext": {
		"priority": 0,
		"fn": () => {
			const {selected: {token}} = globals;
			if (!token || !(token instanceof SVGToken)) {
				return [];
			}
			if (token.tokenData["initiative-id"]) {
				return [
					item("Change Initiative", () => {}),
					item("Remove Initiative", () => {})
				];
			}
			return [item("Add Initiative", () => {})];
		}
	}
});
