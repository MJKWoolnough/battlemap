import type {Uint} from '../types.js';
import {HTTPRequest} from '../lib/conn.js';
import {amendNode, clearNode} from '../lib/dom.js';
import {button, div, h2, img, table, tbody, td, th, thead, tr} from '../lib/html.js';
import {NodeArray, node} from '../lib/nodes.js';
import {ns as svgNS} from '../lib/svg.js';
import {mapLoadReceive} from '../adminMap.js';
import {language} from '../language.js';
import {SVGToken, tokens} from '../map_tokens.js';
import {addPlugin} from '../plugins.js';
import {isAdmin} from '../rpc.js';
import {addCSS} from '../shared.js';

type assetSize = {
	id: Uint;
	size: Uint;
	[node]: HTMLTableRowElement;
}

if (isAdmin) {
	addCSS("#statistics-table img{width: 100px;height: 100px}#statistics-table th:not(:nth-child(2)):hover{cursor: pointer}");

	const defaultLanguage = {
		"GENERATE_STATISTICS": "Generate Statistics",
		"ID": "ID",
		"IMAGE": "Image",
		"MAP": "Map ID",
		"MENU_TITLE": "Statistics",
		"NO_MAP": "No map loaded",
		"SIZE": "Size",
		"TOTAL_SIZE": "Total Size",
	      },
	      langs: Record<string, typeof defaultLanguage> = {
		"en-GB": defaultLanguage
	      },
	      lang = langs[language.value] ?? defaultLanguage,
	      sortID = (a: assetSize, b: assetSize) => a.id - b.id,
	      sortSize = (a: assetSize, b: assetSize) => b.size - a.size,
	      output = div(),
	      tb = new NodeArray<assetSize>(tbody()),
	      head = thead(tr([
		th({"onclick": () => tb.sort(sortID)}, lang["ID"]),
		th(lang["IMAGE"]),
		th({"onclick": () => tb.sort(sortSize)}, lang["SIZE"]),
	      ])),
	      formatNumber = new Intl.NumberFormat(language.value, {"style": "unit", "unit": "byte", "unitDisplay": "narrow"});
	let mapID = 0;
	mapLoadReceive(id => mapID = id);
	addPlugin("stats", {
		"menuItem": {
			"priority": 0,
			"fn": [lang["MENU_TITLE"], div([
				button({"onclick": () => {
					tb.splice(0, tb.length);
					const entries = performance?.getEntries() ?? [],
					      done = new Set<Uint>(),
					      sizes = new Map<Uint, Uint>(),
					      preAddress = window.location.origin + "/images/",
					      total = div();
					for (const e of entries) {
						if (e instanceof PerformanceResourceTiming && e.name.startsWith(preAddress)) {
							const id = parseInt(e.name.slice(preAddress.length));
							if (id && !sizes.has(id)) {
								sizes.set(id, e.decodedBodySize);
							}
						}
					}
					let totalSize = 0;
					for (const [_, {token: tk}] of tokens) {
						if (tk instanceof SVGToken) {
							const id = tk.src;
							if (done.has(id)) {
								continue;
							}
							done.add(id);
							if (sizes.has(id)) {
								const size = sizes.get(id)!;
								totalSize += size;
								tb.push({
									id,
									size,
									[node]: tr([
										td(id + ""),
										td(img({"src": `/images/${id}`})),
										td(formatNumber.format(size))
									])
								});
							} else {
								const sizeTD = td(),
								      o = {
									id,
									size: 0,
									[node]: tr([
										td(id + ""),
										td(img({"src": `/images/${id}`})),
										sizeTD
									])
								      };
								HTTPRequest(`/images/${id}`, {"method": "head", "response": "xh"}).then(xh => {
									const size = parseInt(xh.getResponseHeader("Content-Length") || "0");
									clearNode(sizeTD, formatNumber.format(o.size = size));
									clearNode(total, formatNumber.format(totalSize += size));
									tb.sort();
								});
								tb.push(o);
							}
						}
					}
					clearNode(output, [
						h2(`${lang["MAP"]}: ${mapID}`),
						amendNode(total, `${lang["TOTAL_SIZE"]}: ${formatNumber.format(totalSize)}`),
						table({"id": "statistics-table"}, [
							head,
							tb[node]
						])
					]);

				}}, lang["GENERATE_STATISTICS"]),
				output
			]), true, `data:image/svg+xml,%3Csvg xmlns="${svgNS}" viewBox="0 0 100 100"%3E%3Crect x="12" y="60" width="20" height="39" rx="3" fill="%23f00" /%3E%3Crect x="42" y="40" width="20" height="59" rx="3" fill="%230f0" /%3E%3Crect x="72" y="20" width="20" height="79" rx="3" fill="%2300f" /%3E%3Cpath d="M4,4 V96 H96" stroke="%23888" fill="none" stroke-width="8" stroke-linecap="round" /%3E%3C/svg%3E`]
		}
	});
}
