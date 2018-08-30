"use strict";
offer((function() {
	const createElements = function(namespace) {
		const childrenArr = function(elem, children) {
			if (typeof children === "string") {
				elem.textContent = children;
			} else if (children) {
				if (children.hasOwnProperty("length")) {
					Array.from(children).forEach(c => childrenArr(elem, c));
				} else if(children instanceof Node) {
					elem.appendChild(children);
				}
			}
		      };
		return function(element, properties, children) {
			const elem = typeof element === "string" ? document.createElementNS(namespace, element) : element;
			if (typeof properties === "string") {
				[properties, children] = [children, properties];
			}
			if (typeof properties === "object") {
				Object.keys(properties).forEach(k => {
					let prop = properties[k];
					if (prop !== undefined) {
						if (k.substr(0, 2) === "on" && typeof prop === "function") {
							elem.addEventListener(k.substr(2), prop.bind(elem));
						} else {
							elem.setAttribute(k, prop)
						}
					}
				});
			}
			childrenArr(elem, children);
			return elem;
		};
	      },
	      createHTML = createElements(document.getElementsByTagName("html")[0].namespaceURI),
	      formatText = function(text) {
		const df = document.createDocumentFragment();
		text.split("\n").forEach((t, n) => {
			if (n > 0) {
				df.appendChild(creatHTML("br"));
			}
			df.appendChild(document.createTextNode(child));
		});
		return df;
	      },
	      clearElement = function(elem) {
		while (elem.hasChildNodes()) {
			elem.removeChild(elem.lastChild);
		}
	      },
	      Layers = function(container) {
		const layers = [],
		      closer = function(closerFn) {
			clearElement(container);
			const elm = layers.pop();
			if (elm !== undefined) {
				container.appendChild(elm);
			}
			if (closerFn instanceof Function) {
				closerFn();
			}
			if (layers.length === 0) {
				window.removeEventListener("keypress", keyPress);
				return;
			}
		      },
		      keyPress = function(e) {
			e = e || window.event;
			if (e.keyCode === 27) {
				closer();
			}
		      };
		this.addLayer = closerFn => {
			if (layers.length === 0) {
				window.addEventListener("keypress", keyPress);
			}
			if (container.hasChildNodes()) {
				const df = document.createDocumentFragment();
				while (container.hasChildNodes()) {
					df.appendChild(container.firstChild);
				}
				layers.push(df);
			}
			return container.appendChild(createHTML(
				"div",
				{},
				createHTML(
					"span",
					{
						"class": "closer",

						"onclick": closer.bind(null, closerFn)
					},
					"X"
				)
			));
		};
		this.removeLayer = closer
	      };
	return Object.freeze({createElements, createHTML, formatText, clearElement, Layers});
}()));
