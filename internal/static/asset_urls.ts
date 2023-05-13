import type {Uint} from './types.js';

export const imageIDtoURL = (id: Uint) => `/images/${id}`,
audioIDtoURL = (id: Uint) => `/audio/${id}`;
