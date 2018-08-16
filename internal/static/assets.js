"use strict";
window.addEventListener("load", function() {
	var tags = {}, assets = {}, neg = -1,
	    writeAssetLine = function(asset) {
		return createHTML(
			"li",
			{},
			[
				asset.Name,
				createHTML(
					"span",
					{
						"class": "rename",

						"onclick": function() {
							alert("RENAME")
						}
					},
					"✍"
				),
				createHTML(
					"span",
					{
						"class": "delete",

						"onclick": function() {
							alert("DELETE")
						}
					},
					"⌫"
				)
			]
		)
	    },
	    writeTags = function(prefix) {
		return Object.values(tags).filter(t => t.Name.substr(0, prefix.length) === prefix && t.Name.substr(prefix.length).indexOf('/') < 0).sort((a, b) => a.Name < b.Name ? -1 : 1).map(t => createHTML(
			"li",
			{
				"class": "tag",
			},
			[
				createHTML(
					"label",
					{
						"for": "tag_" + t.Name
					},
					t.Name.substr(prefix.length),
				)
			].concat(
				t.ID < 0 ? [] : [
					createHTML(
						"span",
						{
							"class": "rename",

							"onclick": function() {
								alert("RENAME")
							}
						},
						"✍"
					),
					createHTML(
						"span",
						{
							"class": "delete",

							"onclick": function() {
								alert("DELETE")
							}
						},
						"⌫"
					)
				]
			).concat([
				createHTML(
					"input",
					{
						"type": "checkbox",
						"id": "tag_" + t.Name
					},
				),
				createHTML(
					"ul",
					{},
					writeTags(t.Name+"/").concat(t.Assets.sort((a, b) => assets[a].Name < assets[b].Name ? -1 : 1).map(a => writeAssetLine(a)))
				)
			])
		));
	    },
	    buildList = function() {
		clearElement(document.body);
		[
			createHTML(
				"label",
				{
					"class": "button",

					"onclick": function() {
						var tag = prompt("Tag Name?", "");
						if (tag !== null && tag !== "") {
							var lTag = tag.toLowerCase();
							if (Object.values(tags).filter(t => t.Name.toLowerCase() === lTag && t.ID >= 0).length == 0) {
								rpc.request("AddTag", tag, function(tag) {
									tags[tag.ID] = tag;
									createPsuedoTags();
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
					"action": "/assets",
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
				writeTags("").concat(Object.values(assets).filter(a => a.Tags.length === 0).sort((a, b) => assets[a].Uploaded > assets[b].Uploaded ? -1 : assets[a].Uploaded === assets[b].Uploaded ? 0 : 1).map(a => writeAssetLine(a))),
			)
		].forEach(e => document.body.appendChild(e));
	    },
	    createPsuedoTags = function() {
		Object.values(tags).filter(t => t.ID < 0).forEach(t => delete tags[t.ID]);
		Object.values(tags).forEach(t => {
			var tName = t.Name, i;
			while ((i = tName.lastIndexOf('/')) >= 0) {
				tName = tName.substr(0, i);
				var lName = tName.toLowerCase();
				if (Object.values(tags).filter(t => t.Name.toLowerCase() === lName).length === 0) {
					tags[neg] = {
						"ID": neg,
						"Name": tName,
						"Assets": [],
					}
					neg--;
				} else {
					return;
				}
			}
		})
	    },
	    rpc = new RPC("/assets", function() {
		var wg = new waitGroup(buildList);
		wg.add(2);
		rpc.request("ListTags", null, function(data) {
			tags = data;
			createPsuedoTags();
			wg.done();
		});
		rpc.request("ListAssets", null, function(data) {
			assets = data;
			wg.done();
		});
	});
});
