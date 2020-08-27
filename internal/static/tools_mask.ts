import {svg, defs, mask, rect, path, use} from './lib/svg.js';

export default Object.freeze({
	"name": "Layer Mask",
	"icon": svg({"viewBox": "0 0 60 50"}, [
		defs(path({"id": "e", "d": "M32,20 q9,-10 18,0 q-9,-3 -18,0"})),
		mask({"id": "m"}, [
			rect({"width": 100, "height": 100, "fill": "#fff"}),
			path({"d": "M10,20 q9,-10 18,0 q-9,-3 -18,0"}),
			use({"href": "#e"}),
			use({"x": 22, "href": "#e"}),
			path({"d": "M20,35 q10,5 20,0 q-10,10 -20,0"}),
		]),
		path({"d": "M0,0 Q30,15 60,0 Q30,100 0,0", "stroke": "none", "style": "fill: currentColor", "mask": "url(#m)"})
	])
});
