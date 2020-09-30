import {StringSetting} from './settings_types.js';

const defaultLanguage: Record<string, string> = {
	"ARE_YOU_SURE": "Are you sure?",
	"AUTH": "Authentication",
	"AUTOSNAP": "Autosnap",
	"CHARACTER": "Character",
	"CHARACTER_IMAGE": "Character Image",
	"CHARACTER_EDIT": "Edit Character",
	"DARK_MODE": "Dark Mode",
	"HIDE_MENU": "Hide Menu Button?",
	"LANGUAGE": "Language",
	"LIGHT_MODE": "Light Mode",
	"LOGIN": "Login",
	"LOGOUT": "Logout",
	"MAP_SETTINGS": "Map Settings",
	"PLUGINS": "Plugins",
	"PLUGIN_REFRESH": "Refresh Page?",
	"PLUGIN_REFRESH_REQUEST": "Plugin settings have change and a page refresh is required to load changes. Refresh the page now?",
	"ROW_ADD": "Add Row",
	"ROW_NEW": "New Row",
	"ROW_NAME_ENTER": "Please enter a new row name",
	"ROW_NAME_EXISTS": "Existing Key",
	"ROW_NAME_EXISTS_LONG": "Key entered already exists",
	"ROW_NAME_RESERVED": "Reserved Key",
	"ROW_NAME_RESERVED_LONG": "Key entered is reserved and cannot be used for user data",
	"SAVE": "Save",
	"SCROLL_AMOUNT": "Scroll (zero is square width)",
	"SELECT_LANGUAGE": "Select Language",
	"SETTINGS_CLEAR": "Clear Settings",
	"SETTINGS_RESET": "Reset",
	"SETTINGS_RESET_CONFIRM": "Are you sure that you wish to clear all settings? This cannot be undone",
	"THEME": "Theme",
	"TOKEN_SELECT": "Select Token",
	"TOKEN_NONE_SELECTED": "No token selected",
	"UNDO_LIMIT": "Undo Limit (-1 for infinite, 0 to disable)",
	"UNSAVED_CHANGES": "There are unsaved changes, are you sure you wish to close?",
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
