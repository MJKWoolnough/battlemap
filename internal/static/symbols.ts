import type {Props} from './lib/dom.js';
import {createSVG, svg, title, use} from './lib/svg.js';
import {setAndReturn} from './shared.js';

const symbols = svg({"style": "width: 0"}),
      symbolMap = new Map<string, (props?: Props) => SVGSVGElement>();

export const addSymbol = (id: string, s: SVGSymbolElement) => {
	createSVG(symbols, createSVG(s, {id}));
	return setAndReturn(symbolMap, id, (props: Props = {}) => svg(props, [
		typeof props["title"] === "string" ? title(props["title"]) : [],
		use({"href": `#${id}`})
	]));
},
getSymbol = (id: string) => symbolMap.get(id),
addFilter = (f: SVGFilterElement) => symbols.appendChild(f);

export default symbols;
