import {StringSetting} from './settings_types.js';

const defaultLanguage: Record<string, string> = {
	"ARE_YOU_SURE": "Are you sure?",
	"AUTH": "Authentication",
	"AUTOSNAP": "Autosnap",
	"DARK_MODE": "Dark Mode",
	"HIDE_MENU": "Hide Menu Button?",
	"LANGUAGE": "Language",
	"LIGHT_MODE": "Light Mode",
	"LOGIN": "Login",
	"LOGOUT": "Logout",
	"MAP_SETTINGS": "Map Settings",
	"SCROLL_AMOUNT": "Scroll (zero is square width)",
	"SELECT_LANGUAGE": "Select Language",
	"SETTINGS_CLEAR": "Clear Settings",
	"SETTINGS_RESET": "Reset",
	"SETTINGS_RESET_CONFIRM": "Are you sure that you wish to clear all settings? This cannot be undone",
	"THEME": "Theme",
	"UNDO_LIMIT": "Undo Limit (-1 for infinite, 0 to disable)",
      },
      overDefault = (pack: Record<string, string>) => {
	for (const s in defaultLanguage) {
		if (!pack[s]) {
			pack[s] = defaultLanguage[s];
		}
		return pack;
	}
      },
      languagePacks: Record<string, Record<string, string>> = {
	"en-GB": defaultLanguage,
	"en": defaultLanguage,
      };

export const languages: string[] = Object.keys(languagePacks),
language = new StringSetting("language", navigator.language);

export default Object.freeze(languagePacks[language.value] ?? defaultLanguage);
