import type {Uint} from '../types.js';
import {HTTPRequest} from '../lib/conn.js';
import {SortNode} from '../lib/ordered.js';
import {clearElement} from '../lib/dom.js';
import {createHTML, button, div, h2, img, style, table, tbody, thead, th, tr, td} from '../lib/html.js';
import {globals, SVGToken} from '../map.js';
import {mapLoadReceive, isAdmin} from '../shared.js';
import {addPlugin} from '../plugins.js';
import {language} from '../language.js';

type assetSize = {
	id: Uint;
	size: Uint;
	node: HTMLTableRowElement;
}

if (isAdmin()) {
	document.head.appendChild(style({"type": "text/css"}, "#statistics-table img{width: 100px;height: 100px}#statistics-table th:not(:nth-child(2)):hover{cursor: pointer}"));

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
	      tb = new SortNode<assetSize>(tbody()),
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
					if (!globals.tokens) {
						output.innerText = lang["NO_MAP"];
						return;
					}
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
					for (const t in globals.tokens) {
						const tk = globals.tokens[t].token;
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
									node: tr([
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
									node: tr([
										td(id + ""),
										td(img({"src": `/images/${id}`})),
										sizeTD
									])
								      };
								(HTTPRequest(`/images/${id}`, {"method": "head", "response": "xh"}) as Promise<XMLHttpRequest>).then(xh => {
									const size = parseInt(xh.getResponseHeader("Content-Length") || "0");
									o.size = size;
									sizeTD.innerText = formatNumber.format(size);
									totalSize += size;
									total.innerText = formatNumber.format(totalSize);
									tb.sort();
								});
								tb.push(o);
							}
						}
					}
					createHTML(clearElement(output), [
						h2(`${lang["MAP"]}: ${mapID}`),
						createHTML(total, `${lang["TOTAL_SIZE"]}: ${formatNumber.format(totalSize)}`),
						table({"id": "statistics-table"}, [
							head,
							tb.node
						])
					]);

				}}, lang["GENERATE_STATISTICS"]),
				output
			]), true, 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"%3E%3Crect x="12" y="60" width="20" height="39" rx="3" fill="%23f00" /%3E%3Crect x="42" y="40" width="20" height="59" rx="3" fill="%230f0" /%3E%3Crect x="72" y="20" width="20" height="79" rx="3" fill="%2300f" /%3E%3Cpath d="M4,4 V96 H96" stroke="%23888" fill="none" stroke-width="8" stroke-linecap="round" /%3E%3C/svg%3E']
		}
	});
}
