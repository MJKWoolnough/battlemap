import {Int} from './types.js';
import {undoLimit} from './settings.js';

type Fn = () => Fn;

type undoData = {
	undos: Fn[];
	redos: Fn[];
	limit: Int;
}

const fns = new WeakMap<Undo, undoData>();

export default class Undo {
	constructor(limit?: Int) {
		fns.set(this, {
			"undos": [],
			"redos": [],
			"limit": limit ?? undoLimit.value
		});
	}
	add(undo: Fn) {
		const {undos, redos, limit} = fns.get(this)!;
		redos.splice(0, redos.length);
		if (limit === 0) {
			undos.splice(0, undos.length);
			return;
		}
		while (limit !== -1 && undos.length >= limit) {
			undos.shift();
		}
		undos.push(undo);
	}
	clear() {
		const {undos, redos} = fns.get(this)!;
		undos.splice(0, undos.length);
		redos.splice(0, redos.length);
	}
	undo() {
		const {undos, redos} = fns.get(this)!,
		      fn = undos.pop();
		if (fn) {
			redos.push(fn());
		}
	}
	redo() {
		const {undos, redos} = fns.get(this)!,
		      fn = redos.pop();
		if (fn) {
			undos.push(fn());
		}
	}
}
