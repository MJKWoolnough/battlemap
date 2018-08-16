"use strict";
window.addEventListener("load", function() {
	var tags = {}, assets = {}, tagsOrdered = [],
	    buildList = function() {
		tagsOrdered = Object.values(tags).sort((a, b) => a.Name < b.Name ? -1 : 1);
		clearElement(document.body);
		[
			createHTML(
				"button",
				{
					"class": "button",

					"onclick": function() {
						var tag = prompt("Tag Name?", "");
						if (tag !== null && tag !== "") {
							var lTag = tag.toLowerCase();
							if (tagsOrdered.filter(t => t.Name.toLowerCase() === tag).length == 0) {
								rpc.request("AddTag", tag, function(tag) {
									tags[tag.ID] = tag;
									buildList();
								});
							} else {
								alert("Tag already exists!");
							}
						}
					}
				},
				"Add Tag"
			),
			createHTML(
				"form",
				{
					"action": "?",
					"enctype": "multipart/form-data",
					"method": "post",
				},
				[
					createHTML(
						"label",
						{
							"class": "button",
							"for": "asset",
						},
						"Upload Asset"
					),
					createHTML(
						"input",
						{
							"id": "asset",
							"multiple": "multiple",
							"name": "asset",
							"style": "display: none",
							"type": "file",

							"onchange": function(e) {
								this.parentNode.submit();
							}
						}
					)
				]
			),
			createHTML(
				"ul", 
				{},
				tagsOrdered.map(t => createHTML("li", {}, t.Name))
			)
		].forEach(e => document.body.appendChild(e));
	    },
	    rpc = new RPC("/assets", function() {
		var wg = new waitGroup(buildList);
		wg.add(2);
		rpc.request("ListTags", null, function(data) {
			tags = data;
			wg.done();
		});
		rpc.request("ListAssets", null, function(data) {
			tags = data;
			wg.done();
		});
	});
});
