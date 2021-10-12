import type {Uint} from './types.js';

export type CancelFn = (run?: true) => void;

type KeyFn = (e: KeyboardEvent) => void;

type MouseFn = (e: MouseEvent) => void;

let nextKeyID = 0,
    nextMouseID = 0;

const held = new Set<string>(),
      downs = new Map<string, Map<Uint, [KeyFn, boolean]>>(),
      ups = new Map<string, Map<Uint, [KeyFn, boolean]>>(),
      ke = (event: "down" | "up", key: string) => new KeyboardEvent(`key${event}`, {
	key,
	"ctrlKey": held.has("Control"),
	"shiftKey": held.has("Shift"),
	"altKey": held.has("Alt"),
	"metaKey": held.has("OS")
      }),
      me = (event: "down" | "up", button: 0 | 1 | 2) => new MouseEvent(`mouse${event}`, {
	button,
	"ctrlKey": held.has("Control"),
	"shiftKey": held.has("Shift"),
	"altKey": held.has("Alt"),
	"metaKey": held.has("OS")
      }),
      buttons = [false, false, false],
      mouseDown = [
	      new Map<Uint, [MouseFn, boolean]>(),
	      new Map<Uint, [MouseFn, boolean]>(),
	      new Map<Uint, [MouseFn, boolean]>()
      ],
      mouseUp = [
	      new Map<Uint, [MouseFn, boolean]>(),
	      new Map<Uint, [MouseFn, boolean]>(),
	      new Map<Uint, [MouseFn, boolean]>()
      ];

window.addEventListener("keydown", (e: KeyboardEvent) => {
	const {key, target} = e;
	if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) {
		return;
	}
	const events = downs.get(key);
	if (events) {
		for (const [id, [event, once]] of events) {
			event(e);
			if (once) {
				events.delete(id);
			}
		}
	}
	held.add(key);
});

window.addEventListener("keyup", (e: KeyboardEvent) => {
	const {key} = e;
	if (!held.has(key)) {
		return;
	}
	const events = ups.get(key);
	if (events) {
		for (const [id, [event, once]] of events) {
			event(e);
			if (once) {
				events.delete(id);
			}
		}
	}
	held.delete(key);
});

window.addEventListener("mousedown", (e: MouseEvent) => {
	const {button} = e;
	if (button !== 0 && button !== 1 && button !== 2) {
		return;
	}
	for (const [id, [event, once]] of mouseDown[button]) {
		event(e);
		if (once) {
			mouseDown[button].delete(id);
		}
	}
	buttons[button] = true;
});

window.addEventListener("mouseup", (e: MouseEvent) => {
	const {button} = e;
	if (button !== 0 && button !== 1 && button !== 2) {
		return;
	}
	for (const [id, [event, once]] of mouseUp[button]) {
		event(e);
		if (once) {
			mouseUp[button].delete(id);
		}
	}
	buttons[button] = false;
});

window.addEventListener("blur", () => {
	for (const key of held) {
		const events = ups.get(key);
		if (events && events.size) {
			const e = ke("up", key);
			for (const [id, [event, once]] of events) {
				event(e);
				if (once) {
					events.delete(id);
				}
			}
		}
		held.delete(key);
	}
	for (let button = 0; button < 3; button++) {
		if (buttons[button] && mouseUp[button].size) {
			const e = me("up", button as 0 | 1 | 2);
			for (const [id, [event, once]] of mouseUp[button]) {
				event(e);
				if (once) {
					mouseUp[button].delete(id);
				}
			}
		}
	}
});

export const keyEvent = (key: string, onkeydown?: KeyFn, onkeyup?: KeyFn, now = false, once = false) => {
	const id = nextKeyID++;
	if (onkeydown) {
		if (now && held.has(key)) {
			onkeydown(ke("down", key));
		}
		if (!now || !once) {
			let m = downs.get(key);
			if (!m) {
				downs.set(key, m = new Map());
			}
			m.set(id, [onkeydown, once]);
		}
	}
	if (onkeyup) {
		let m = ups.get(key);
		if (!m) {
			ups.set(key, m = new Map());
		}
		m.set(id, [onkeyup, once]);
	}
	return (run?: true) => {
		if (run && held.has(key)) {
			ups.get(key)?.get(id)?.[0](ke("up", key));
		}
		downs.get(key)?.delete(id);
		ups.get(key)?.delete(id);
	};
},
mouseEvent = (button: 0 | 1 | 2, onmousedown?: MouseFn, onmouseup?: MouseFn, now = false, once = false) => {
	const id = nextMouseID++;
	if (onmousedown) {
		if (now && buttons[button]) {
			onmousedown(me("down", button));
		}
		if (!now || !once) {
			mouseDown[button].set(id, [onmousedown, once]);
		}
	}
	if (onmouseup) {
		mouseUp[button].set(id, [onmouseup, once]);
	}
	return (run?: true) => {
		if (run && buttons[button]) {
			mouseUp[button].get(id)?.[0](me("up", button));
		}
		mouseDown[button].delete(id);
		mouseUp[button].delete(id);
	};
};
