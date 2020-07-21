import {undoLimit} from './settings.js';

type Fn = () => Fn;

const undoList: Fn[] = [],
      redoList: Fn[] = [];

export const clearUndo = () => {
	undoList.splice(0, undoList.length);
	redoList.splice(0, redoList.length);
},
addUndo = (fn: Fn) => {
	const undo = fn();
	if (undoLimit.value === 0) {
		clearUndo();
		return;
	}
	redoList.splice(0, redoList.length);
	while (undoLimit.value !== -1 && undoList.length >= undoLimit.value) {
		undoList.shift();
	}
	undoList.push(undo);
},
undo = () => {
	const fn = undoList.pop();
	if (fn) {
		redoList.push(fn());
	}
},
redo = () => {
	const fn = redoList.pop();
	if (fn) {
		undoList.push(fn());
	}
};
