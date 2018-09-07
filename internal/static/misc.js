offer((function() {
	const enterKey = function(e) {
		if (e.keyCode === 13) {
			this.nextSibling.click();
		}
	      },
	      showError = function(elm, e) {
		if (elm.nextSibling !== null) {
			if (elm.nextSibling.getAttribute("class") === "error") {
				elm.nextSibling.textContent = e.message;
			} else {
				elm.parentNode.insertBefore(createHTML(
					"span",
					{
						"class": "error"
					},
					e.message
				), elm.nextSibling);
			}
		} else {
			elm.parentNode.appendChild(createHTML(
				"span",
				{
					"class": "error"
				},
				e.message
			));
		}
	      };
	return Object.freeze({enterKey, showError});
}());
