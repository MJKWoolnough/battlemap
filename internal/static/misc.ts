import {createHTML} from './lib/html.js';

export const enterKey = function(this: Node, e: KeyboardEvent): void {
	if (e.keyCode === 13) {
		(this.nextSibling! as HTMLElement).click();
	}
}, showError = (elm: Node, e: Error | string): void => {
	const msg =  e instanceof Error ? e.message : e;
	if (elm.nextSibling !== null) {
		if ((elm.nextSibling as HTMLElement).classList.contains("error")) {
			elm.nextSibling.textContent = msg;
		} else if (elm.parentNode !== null) {
			elm.parentNode.insertBefore(createHTML("span", {"class": "error"}, msg), elm.nextSibling);
		}
	} else if (elm.parentNode !== null) {
		elm.parentNode.appendChild(createHTML("span", {"class": "error"}, msg));
	}
}, clearError = (elm: Node): void => {
	if (elm.parentNode !== null && elm.nextSibling !== null && (elm.nextSibling as HTMLElement).classList.contains("error")) {
		elm.parentNode.removeChild(elm.nextSibling);
	}
};
