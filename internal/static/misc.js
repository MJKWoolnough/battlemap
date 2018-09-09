offer((async function() {
	const {createHTML} = await include("html.js"),
	      enterKey = function(e) {
		if (e.keyCode === 13) {
			this.nextSibling.click();
		}
	      },
	      showError = function(elm, e) {
		if (elm.nextSibling !== null) {
			if (elm.nextSibling.classlist.contains("error")){
				elm.nextSibling.textContent = e.message;
			} else {
				elm.parentNode.insertBefore(createHTML("span", {"class": "error"}, e.message), elm.nextSibling);
			}
		} else {
			elm.parentNode.appendChild(createHTML("span", {"class": "error"}, e.message));
		}
	      },
	      clearError = function(elm) {
		if (elm.nextSibling !== null && elm.nextSibling.classList.contains("error")) {
			elm.parentNode.removeChild(elm.nextSibling);
		}
	      };
	return Object.freeze({enterKey, showError});
}()));
