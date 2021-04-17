import type {Int, Uint} from '../types.js';
import type {WindowElement} from '../windows.js';
import {clearElement, createHTML} from '../lib/dom.js';
import {a, br, button, div, h1, h2, h3, input, label, table, tbody, td, th, thead, tr} from '../lib/html.js';
import {addPlugin} from '../plugins.js';
import mainLang, {language} from '../language.js';
import {enterKey, isInt, isUint} from '../shared.js';
import {shell} from '../windows.js';
import {JSONSetting} from '../settings_types.js';
import {getSymbol} from '../symbols.js';

type roll = {
	prof: 0 | 0.5 | 1 | 2;
	mod: Int;
	adv: boolean;
}

type Attribute = "STR" | "DEX" | "CON" | "INT" | "WIS" | "CHA";

type Speed = "walk" | "fly" | "burrow" | "swim" | "climb";

type BeyondData = {
	name: string;
	gender: string;
	class: string;
	race: string;
	level: Uint;
	ac: [Uint, Uint];
	attrs: Record<Attribute, Uint>;
	saves: Partial<Record<Attribute | "DEATH", roll>>;
	skills: Partial<Record<keyof typeof skills, roll>>;
	passives: Partial<Record<"insight" | "investigation" | "perception", roll>>;
	maxHP: Uint;
	hitDice: [Uint, Uint][];
	speed: Partial<Record<Speed, Uint>>;
	languages: string[];
}

let beyondWindow: WindowElement | null = null;

const defaultLanguage = {
	"BEYOND_ID": "Beyond ID",
	"BEYOND_INVALID_ID": "Invalid ID",
	"BEYOND_INVALID_ID_LONG": "Unable to determine Beyond ID, please re-enter",
	"BEYOND_LOAD": "Load Beyond Data",
	"ERROR_INVALID_FILE": "Invalid Beyond JSON file",
	"DELETE": "Remove Character Data",
	"DOWNLOAD": "Download Beyond Data",
	"GUI_ATTRIBUTES": "Attributes",
	"GUI_HITDICE": "Hit Dice",
	"GUI_HP": "HP",
	"GUI_LANGUAGES": "Languages",
	"GUI_SAVING_THROWS": "Saving Throws",
	"GUI_SKILLS": "Skills",
	"SKILL_acrobatics": "Acrobatics",
	"SKILL_animal-handling": "Animal Handling",
	"SKILL_arcana": "Arcana",
	"SKILL_athletics": "Athletics",
	"SKILL_deception": "Deception",
	"SKILL_history": "History",
	"SKILL_insight": "Insight",
	"SKILL_intimidation": "Intimidation",
	"SKILL_investigation": "Investigation",
	"SKILL_medicine": "Medicine",
	"SKILL_nature": "Nature",
	"SKILL_perception": "Perception",
	"SKILL_performance": "Performance",
	"SKILL_persuasion": "Persuasion",
	"SKILL_religion": "Religion",
	"SKILL_sleight-of-hand": "Sleight of Hand",
	"SKILL_stealth": "Stealth",
	"PLUGIN_NAME": "Beyond",
	"UPLOAD": "Upload Beyond Data"
      },
      langs: Record<string, typeof defaultLanguage> = {
	"en-GB": defaultLanguage
      },
      lang = langs[language.value] ?? defaultLanguage,
      speeds: Readonly<Speed[]> = Object.freeze([
	"walk",
	"fly",
	"burrow",
	"swim",
	"climb"
      ]),
      attributes: Readonly<Attribute[]> = Object.freeze([
	"STR",
	"DEX",
	"CON",
	"INT",
	"WIS",
	"CHA"
      ]),
      bonusAttrs2Attrs: Readonly<Record<string, Attribute>> = {
	"strength-score": "STR",
	"dexterity-score": "DEX",
	"constitution-score": "CON",
	"intelligence-score": "INT",
	"wisdom-score": "WIS",
	"charisma-score": "CHA",
      },
      saves2Attrs: Readonly<Record<string, Attribute>> = {
	"strength-saving-throws": "STR",
	"dexterity-saving-throws": "DEX",
	"constitution-saving-throws": "CON",
	"intelligence-saving-throws": "INT",
	"wisdom-saving-throws": "WIS",
	"charisma-saving-throws": "CHA",
      },
      skills = Object.freeze({
	"acrobatics": 1,
	"animal-handling": 4,
	"arcana": 3,
	"athletics": 0,
	"deception": 5,
	"history": 3,
	"initiative": 1,
	"insight": 4,
	"intimidation": 5,
	"investigation": 3,
	"medicine": 4,
	"nature": 3,
	"perception": 5,
	"performance": 5,
	"persuasion": 5,
	"religion": 3,
	"sleight-of-hand": 1,
	"stealth": 1
      }),
      hitDice = [6, 8, 10, 12],
      remove = getSymbol("remove")!,
      icon = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 950 950"%3E%3Crect width="100%25" height="100%25" fill="%23000" /%3E%3Cpath d="M30,35 l78,81 v276 h-106 l107,137 v302 l-78,81 h553 c104,0 194,-18 257,-56 c63,-38 93,-92 93,-165 v-50 c-1,-42 -17,-80 -49,-112 c-33,-32 -77,-56 -134,-72 c23,-6 44,-15 63,-27 c20,-12 35,-24 48,-39 s23,-30 30,-47 c8,-15 11,-30 11,-45 v-29 c0,-35 -8,-68 -24,-96 c-17,-29 -39,-54 -69,-74 c-30,-21 -72,-36 -114 -48 c-42,-11 -89,-17 -140,-17 z M333,163 h141 c41,0 74,6 99,18 c26,12 38,25 38,68 v29 c0,26 -9,45 -29,60 c-20,15 -45,23 -78,23 h-171 z M333,558 h179 c33,0 62,8 89,23 c26,15 39,35 39,60 v42 c0,18 -3,33 -11,44 c-8,11 -17,20 -29,27 c-12,6 -26,11 -42,14 c-17,2 -33,3 -50,3 h-176 z" fill="%23f00" stroke="%23000" /%3E%3C/svg%3E',
      isRoll = (r: any): r is roll => typeof r === "object" && (r["prof"] === 0 || r["prof"] === 0.5 || r["prof"] === 1 || r["prof"] === 2) && isInt(r["mod"]) && typeof r["adv"] === "boolean",
      beyondData = new JSONSetting<BeyondData | null>("plugin-beyond", null, (data: BeyondData | null): data is BeyondData => {
	if (!data || typeof data !== "object" || typeof data["name"] !== "string" || typeof data["gender"] !== "string" || typeof data["class"] !== "string" || typeof data["race"] !== "string" || !isUint(data["level"], 20) || !(data["ac"] instanceof Array) || !isUint(data["ac"][0]) || !isUint(data["ac"][1]) || typeof data["attrs"] != "object" || typeof data["saves"] != "object" || typeof data["skills"] != "object" || typeof data["passives"] != "object" || !isUint(data["maxHP"]) || !(data["hitDice"] instanceof Array) || typeof data["speed"] !== "object" || !(data["languages"] instanceof Array)) {
		return false;
	}
	if (data["ac"].length !== 2 || !isUint(data["ac"][0]) || !isUint(data["ac"][1])) {
		return false;
	}
	for (const attr in data["attrs"]) {
		if (!attributes.includes(attr as Attribute) || !isUint(data["attrs"][attr as Attribute])) {
			return false;
		}
	}
	for (const attr in data["saves"]) {
		if (!(attributes.includes(attr as Attribute) || attr === "DEATH") || !isRoll(data["saves"][attr as Attribute | "DEATH"])) {
			return false;
		}
	}
	for (const skill in data["skills"]) {
		if (skills[skill as keyof typeof skills] === undefined || !isRoll(data["skills"][skill as keyof typeof skills])) {
			return false;
		}
	}
	for (const passive in data["passives"]) {
		if (!(passive === "insight" || passive === "investigation" || passive === "perception") || !isRoll(data["passives"][passive])) {
			return false;
		}
	}
	for (const hitDie of data["hitDice"]) {
		if (!(hitDie instanceof Array) || hitDie.length !== 2 || !hitDice.includes(hitDie[0]) || !isUint(hitDie[1], 20)) {
			return false
		}
	}
	for (const speed in data["speed"]) {
		if (!speeds.includes(speed as Speed) || !isUint(data["speed"][speed as Speed])) {
			return false;
		}
	}
	for (const language of data["languages"]) {
		if (typeof language !== "string") {
			return false;
		}
	}
	return true;
      }),
      handleError = (title: string, message: string) => (beyondWindow ?? shell).alert(title, message, icon),
      baseDiv = div({"onpopout": (e: CustomEvent) => beyondWindow = e.detail, "onpopin": () => beyondWindow = null}),
      noData = (() => {
	const beyondLink = a(lang["DOWNLOAD"]),
	      beyondDownload = div([
		      beyondLink,
		      remove({"title": lang["DELETE"], "style": "width: 1em;height: 1em;cursor: pointer;", "onclick": () => beyondDownload.replaceWith(beyondEntry)})
	      ]),
	      beyondID = input({"id": "plugin-beyond-id", "type": "text", "onkeypress": enterKey}),
	      beyondEntry = div([
		label({"for": "plugin-beyond-id"}, `${lang["BEYOND_ID"]}: `),
		beyondID,
		button({"onclick": () => {
			const urlMatch = beyondID.value.match(urlReg),
			      id = parseInt(urlMatch ? beyondID.value = urlMatch[1] : beyondID.value);
			if (id + "" === beyondID.value) {
				beyondLink.setAttribute("href", `https://www.dndbeyond.com/character/${id}/json`);
				beyondEntry.replaceWith(beyondDownload);
			} else {
				handleError(lang["BEYOND_INVALID_ID"], lang["BEYOND_INVALID_ID_LONG"]);
			}
		}}, lang["BEYOND_LOAD"]),
	      ]),
	      urlReg = /\/characters?\/([0-9]+)(\/json)?$/,
	      contents = [
		beyondEntry,
		label({"for": "plugin-beyond-upload"}, lang["UPLOAD"]),
		input({"id": "plugin-beyond-upload", "type": "file", "style": "display: none", "onchange": function(this: HTMLInputElement) {
			if (!this.files || !this.files[0]) {
				handleError(mainLang["ERROR"], lang["ERROR_INVALID_FILE"]);
			} else {
				this.files[0].text().then(d => {
					const data = JSON.parse(d),
					      parsed: BeyondData = {
						"name": "",
						"gender": "",
						"class": "",
						"race": "",
						"level": 0,
						"ac": [0, 0],
						"attrs": {
							"STR": 0,
							"DEX": 0,
							"CON": 0,
							"INT": 0,
							"WIS": 0,
							"CHA": 0
						},
						"saves": {},
						"skills": {},
						"passives": {},
						"maxHP": 0,
						"hitDice": [],
						"speed": {},
						"languages": []
					      },
					      {name, gender, race, baseHitPoints, classes, stats, modifiers} = data;
					if (typeof data !== "object") {
						throw -1;
					}
					if (typeof name !== "string" || typeof gender !== "string") {
						throw -2;
					}
					parsed.name = name;
					parsed.gender = gender;
					if (typeof race !== "object" || typeof race["fullName"] !== "string" || typeof race["weightSpeeds"] !== "object" || typeof race["weightSpeeds"]["normal"] !== "object") {
						throw -3;
					}
					parsed.race = race["fullName"];
					for (const s of speeds) {
						const speed = race["weightSpeeds"]["normal"][s];
						if (!isUint(speed)) {
							throw -4;
						}
						parsed.speed[s] = speed;
					}
					if (!isUint(baseHitPoints)) {
						throw -5;
					}
					parsed.maxHP = data["baseHitPoints"];
					if (!(classes instanceof Array)) {
						throw -6;
					}
					for (const c of classes) {
						if (!isUint(c["level"], 20)) {
							throw -7;
						}
						parsed.level  += c["level"];
						const def = c["definition"],
						      subDef = c["subclassDefinition"];
						if (typeof def !== "object" || typeof def["name"] !== "string" || !hitDice.includes(def["hitDice"])) {
							throw -8;
						}
						if (parsed.class !== "") {
							parsed.class += ", ";
						}
						let added = false;
						for (const hitDie of parsed.hitDice) {
							if (hitDie[0] === def["hitDice"]) {
								hitDie[1] += c["level"];
								added = true;
								break;
							}
						}
						if (!added) {
							parsed.hitDice.push([def["hitDice"], c["level"]]);
						}
						parsed.class += def["name"];
						if (subDef === null) {
							parsed.class += ` (${c["level"]})`;
						} else if (typeof subDef !== "object" || typeof subDef["name"] !== "string") {
							throw -9;
						} else {
							parsed.class += ` (${subDef["name"]}, ${c["level"]})`;
						}
					}
					parsed.hitDice.sort(([a], [b]) => a - b);
					if (!(stats instanceof Array) || stats.length !== 6) {
						throw -10;
					}
					for (let i = 0; i < 6; i++) {
						if (typeof stats[i] !== "object" || !isUint(stats[i]["value"], 20)) {
							throw -11;
						}
						parsed["attrs"][attributes[i]] = stats[i]["value"];
					}
					if (typeof modifiers !== "object") {
						throw -12
					}
					for (const mtype of ["race", "class", "background", "item", "feat"]) {
						if (!(modifiers[mtype] instanceof Array)) {
							throw -13;
						}
						for (const mod of modifiers[mtype]) {
							if (typeof mod !== "object") {
								throw -14;
							}
							switch (mod["type"]) {
							case "proficiency":
								const prof = mod["subType"] as keyof typeof skills;
								if (typeof prof !== "string") {
									throw -15;
								}
								if (skills[prof]) {
									if (parsed.skills[prof]) {
										if (parsed.skills[prof]!.prof < 1) {
											parsed.skills[prof]!.prof = 1;
										}
									} else {
										parsed.skills[prof] = {"prof": 1, "mod": 0, "adv": false};
									}
								} else if (saves2Attrs[prof]) {
									const attr = saves2Attrs[prof];
									if (parsed.saves[attr]) {
										if (parsed.saves[attr]!.prof < 1) {
											parsed.saves[attr]!.prof = 1;
										}
									} else {
										parsed.saves[attr] = {"prof": 1, "mod": 0, "adv": false};
									}
								}
								break;
							case "language":
								const lang = mod["friendlySubtypeName"];
								if (typeof lang !== "string") {
									throw -16;
								}
								if (!parsed.languages.includes(lang)) {
									parsed.languages.push(lang);
								}
								break;
							case "bonus":
								const bonus = mod["subType"];
								if (typeof bonus !== "string" || !isInt(mod["value"])) {
									throw -17;
								}
								const bonusAttr = bonusAttrs2Attrs[bonus];
								if (bonusAttr) {
									parsed.attrs[bonusAttr] += mod["value"];
								} else if (bonus === "speed" || bonus === "unarmored-movement") {
									for (const speed in parsed.speed) {
										parsed.speed[speed as Speed]! += mod["value"];
									}
								}
							}
						}
					}
					beyondData.set(parsed);
					show(parsed);
				}).catch(n => {
					handleError(mainLang["ERROR"], lang["ERROR_INVALID_FILE"]);
					console.log(n);
				});
			}
		}})
	      ];
	return () => createHTML(clearElement(baseDiv), contents);
      })(),
      show = (data: BeyondData) => {
	const prof = Math.ceil(data.level/4)+1;
	createHTML(clearElement(baseDiv), [
		h1([
			data.name,
			remove({"title": lang["DELETE"], "style": "width: 1em; height: 1em;cursor: pointer", "onclick": () => {
				beyondData.remove();
				noData();
			}})
		]),
		h2([
			data.gender,
			" ",
			data.race,
			", ",
			data.class
		]),
		h3(lang["GUI_HP"]),
		div(data.maxHP + ""),
		h3(lang["GUI_HITDICE"]),
		div(data.hitDice.map(([val, num]) => `${num}d${val}`)),
		h3(lang["GUI_ATTRIBUTES"]),
		table([
			thead(tr(attributes.map(a => th(a)))),
			tbody(tr(attributes.map(a => td(data.attrs[a] + ""))))
		]),
		h3(lang["GUI_SAVING_THROWS"]),
		table([
			thead(tr(attributes.map(a => th(a)))),
			tbody(tr(attributes.map(a => td(Math.floor(data.attrs[a as Attribute]/2) - 5 + (data.saves[a]?.prof ?? 0) * prof + ""))))
		]),
		h3(lang["GUI_SKILLS"]),
		table(tbody(Object.keys(skills).filter(s => s !== "initiative").map(s => tr([
			th(lang["SKILL_" + s as keyof typeof lang]),
			td(Math.floor((data.skills[s as keyof typeof skills]?.prof ?? 0) * prof) + "")
		])))),
		h3(lang["GUI_LANGUAGES"]),
		div(data.languages.map((l, n) => [n > 0 ? br(): [], l]))
	]);
      };

if (beyondData.value) {
	show(beyondData.value);
} else {
	noData();
}

addPlugin(lang["PLUGIN_NAME"], {
	"menuItem": {
		"priority": 0,
		"fn": [lang["PLUGIN_NAME"], baseDiv, true, icon],
	}
});
