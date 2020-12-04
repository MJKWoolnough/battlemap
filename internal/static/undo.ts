import {Int} from './types.js';
import {undoLimit} from './settings.js';

type Fn = () => Fn;

type undoData = {
	undos: Fn[];
	redos: Fn[];
	limit: Int;
}

const undos: Fn[] = [],
      redos: Fn[] = [];

export default {
	"add": (undo: Fn) => {
		redos.splice(0, redos.length);
		if (undoLimit.value === 0) {
			undos.splice(0, undos.length);
			return;
		}
		while (undoLimit.value !== -1 && undos.length >= undoLimit.value) {
			undos.shift();
		}
		undos.push(undo);
	},
	"clear": () => {
		undos.splice(0, undos.length);
		redos.splice(0, redos.length);
	},
	"undo": () => {
		const fn = undos.pop();
		if (fn) {
			redos.push(fn());
		}
	},
	"redo": () => {
		const fn = redos.pop();
		if (fn) {
			undos.push(fn());
		}
	}
}
