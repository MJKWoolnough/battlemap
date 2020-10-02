import {StringSetting} from './settings_types.js';

const defaultLanguage: Record<string, string> = {
	"ARE_YOU_SURE": "Are you sure?",
	"AUTH": "Authentication",
	"AUTOSNAP": "Autosnap",
	"CHARACTER": "Character",
	"CHARACTER_IMAGE": "Character Image",
	"CHARACTER_EDIT": "Edit Character",
	"CURRENT_LOCATION": "Current Location",
	"DARK_MODE": "Dark Mode",
	"FOLDER_ADD": "Add Folder",
	"FOLDER_MOVE": "Move Folder",
	"FOLDER_NAME": "Folder Name",
	"FOLDER_REMOVE": "Remove Folder",
	"FOLDER_REMOVE_CONFIRM": "Remove the following folder? NB: This will remove all folders and items it contains.",
	"HIDE_MENU": "Hide Menu Button?",
	"ITEM_LINK": "Link Item",
	"ITEM_LINK_ADD": "Add Link",
	"ITEM_LINK_NEW": "New Link",
	"ITEM_MOVE": "Move Item",
	"ITEM_REMOVE": "Remove Item",
	"ITEM_REMOVE_CONFIRM": "Remove the following item?",
	"LANGUAGE": "Language",
	"LIGHT_MODE": "Light Mode",
	"LOADING": "Loading…",
	"LOGIN": "Login",
	"LOGOUT": "Logout",
	"MAP_SETTINGS": "Map Settings",
	"OLD_LOCATION": "Old Location",
	"NEW_LOCATION": "New Location",
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
	"TAB_AUDIO": "Audio",
	"TAB_CHARACTERS": "Characters",
	"TAB_IMAGES": "Images",
	"TAB_LAYERS": "Layers",
	"TAB_MAPS": "Maps",
	"TAB_SETTINGS": "Settings",
	"TAB_TOOLS": "Tools",
	"THEME": "Theme",
	"TOKEN_SELECT": "Select Token",
	"TOKEN_NONE_SELECTED": "No token selected",
	"TOKEN_USE_SELECTED": "Use currently selected token",
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
