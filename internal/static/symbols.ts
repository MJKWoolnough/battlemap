import {Props} from './lib/dom.js';
import {svg, use} from './lib/svg.js';

const symbols = svg({"style": "display: none"}),
      symbolMap = new Map<string, (props?: Props) => SVGSVGElement>();

export const addSymbol = (id: string, s: SVGSymbolElement) => {
	s.setAttribute("id", id)
	symbols.appendChild(s);
	const fn = (props: Props = {}) => svg(props, use({"href": `#${id}`}));
	symbolMap.set(id, fn)
	return fn;
},
getSymbol = (id: string) => symbolMap.get(id);

export default symbols;

