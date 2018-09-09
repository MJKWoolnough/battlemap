offer((async function() {
	const {createHTML} = await include("html.js"),
	      enterKey = function(e) {
		if (e.keyCode === 13) {
			this.nextSibling.click();
		}
	      },
	      showError = function(elm, e) {
		if (elm.nextSibling !== null) {
			if (elm.nextSibling.getAttribute("class") === "error") {
				if (e !== null) {
					elm.nextSibling.textContent = e.message;
				} else {
					elm.parentNode.removeChild(elm.nextSibling);
				}
			} else if (e !== null) {
				elm.parentNode.insertBefore(createHTML("span", {"class": "error"}, e.message), elm.nextSibling);
			}
		} else if (e !== null) {
			elm.parentNode.appendChild(createHTML("span", {"class": "error"}, e.message));
		}
	      };
	return Object.freeze({enterKey, showError});
}()));
