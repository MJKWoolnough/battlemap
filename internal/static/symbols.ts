import type {Props} from './lib/dom.js';
import {svg, title, use} from './lib/svg.js';

const symbols = svg({"style": "width: 0"}),
      symbolMap = new Map<string, (props?: Props) => SVGSVGElement>();

export const addSymbol = (id: string, s: SVGSymbolElement) => {
	s.setAttribute("id", id)
	symbols.appendChild(s);
	const fn = (props: Props = {}) => svg(props, [
		typeof props["title"] === "string" ? title(props["title"]) : [],
		use({"href": `#${id}`})
	]);
	symbolMap.set(id, fn)
	return fn;
},
getSymbol = (id: string) => symbolMap.get(id),
addFilter = (f: SVGFilterElement) => symbols.appendChild(f);

export default symbols;
