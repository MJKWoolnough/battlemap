import {StringSetting} from './settings_types.js';

const defaultLanguage: Record<string, string> = {
	"ARE_YOU_SURE": "Are you sure?",
	"AUTH": "Authentication",
	"AUTOSNAP": "Autosnap",
	"CHARACTER": "Character",
	"CHARACTER_DRAG_ICON": "Drag icon here",
	"CHARACTER_NEW": "New Character",
	"CHARACTER_EDIT": "Edit Character",
	"CHARACTER_IMAGE": "Character Image",
	"CHARACTER_NAME": "Character Name",
	"CHARACTER_NEED_NAME": "A character needs a name",
	"CHARACTER_NEED_ICON": "A character needs an icon",
	"CHARACTERS": "Characters",
	"COLOUR": "Colour",
	"COLOUR_ALPHA": "Alpha",
	"COLOUR_UPDATE": "Update Colour",
	"CONTEXT_DELETE": "Delete",
	"CONTEXT_EDIT_TOKEN": "Edit Token Data",
	"CONTEXT_FLIP": "Flip",
	"CONTEXT_FLOP": "Flop",
	"CONTEXT_MOVE_BOTTOM": "Move to Bottom",
	"CONTEXT_MOVE_DOWN": "Move Down",
	"CONTEXT_MOVE_LAYER": "Move to Layer",
	"CONTEXT_MOVE_TOP": "Move to Top",
	"CONTEXT_MOVE_UP": "Move Up",
	"CONTEXT_SET_IMAGE": "Set as Image",
	"CONTEXT_SET_PATTERN": "Set as Pattern",
	"CONTEXT_SET_LIGHTING": "Set Lighting",
	"CONTEXT_SNAP": "Snap",
	"CONTEXT_UNSNAP": "Unsnap",
	"CURRENT_LOCATION": "Current Location",
	"DARK_MODE": "Dark Mode",
	"ERROR": "Error",
	"FOLDER_ADD": "Add Folder",
	"FOLDER_MOVE": "Move Folder",
	"FOLDER_NAME": "Folder Name",
	"FOLDER_REMOVE": "Remove Folder",
	"FOLDER_REMOVE_CONFIRM": "Remove the following folder? NB: This will remove all folders and items it contains.",
	"HIDE_MENU": "Hide Menu Button?",
	"INVALID_ACTION": "Invalid Action",
	"INVALID_RENAME": "Cannot rename active map",
	"INVALID_RENAME_CONTAIN": "Cannot rename while containing active map",
	"INVALID_REMOVE": "Cannot remove active map",
	"INVALID_REMOVE_CONTAINT": "Cannot remove while containing active map",
	"ITEM_LINK": "Link Item",
	"ITEM_LINK_ADD": "Add Link",
	"ITEM_LINK_NEW": "New Link",
	"ITEM_MOVE": "Move Item",
	"ITEM_REMOVE": "Remove Item",
	"ITEM_REMOVE_CONFIRM": "Remove the following item?",
	"LANGUAGE": "Language",
	"LAYER_LIGHT_COLOUR": "Change Light Colour",
	"LAYER_NAME": "Name",
	"LAYER_RENAME": "Rename Layer",
	"LIGHT_MODE": "Light Mode",
	"LIGHTING_COLOUR": "Light Colour",
	"LIGHTING_INTENSITY": "Light Intensity (Distance)",
	"LOADING": "Loading…",
	"LOGIN": "Login",
	"LOGOUT": "Logout",
	"MAP_ADD": "Add Map",
	"MAP_CHANGED": "Map Changed",
	"MAP_CHANGED_LONG": "An error occurred because the map was changed",
	"MAP_EDIT": "Edit Map",
	"MAP_NAME": "Map Name",
	"MAP_NEW": "New Map",
	"MAP_SET_USER": "Set User Map",
	"MAP_SETTINGS": "Map Settings",
	"MAP_SQUARE_COLOUR": "Square Colour",
	"MAP_SQUARE_HEIGHT": "Height in Squares",
	"MAP_SQUARE_LINE": "Square Line Width",
	"MAP_SQUARE_SIZE": "Square Size",
	"MAP_SQUARE_WIDTH": "Width in Squares",
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
	"TOKEN": "Token",
	"TOKEN_REPLACE": "Replace Token?",
	"TOKEN_REPALCE_CONFIRM": "Are you sure that you wish to replace the current token with the currently selected token?",
	"TOKEN_SELECT": "Select Token",
	"TOKEN_NONE_SELECTED": "No token selected",
	"TOKEN_USE_SELECTED": "Use currently selected token",
	"TOOL_DEFAULT": "Default",
	"TOOL_OPTIONS": "Options",
	"TOOL_DRAW": "Draw",
	"TOOL_DRAW_ERROR": "No Layer Selected",
	"TOOL_DRAW_ELLIPSE": "Ellipse",
	"TOOL_DRAW_FILL_COLOUR": "Fill Colour",
	"TOOL_DRAW_POLYGON": "Polygon",
	"TOOL_DRAW_RECT": "Rectangle",
	"TOOL_DRAW_SNAP": "Snap to Grid",
	"TOOL_DRAW_STROKE_COLOUR": "Stroke Colour",
	"TOOL_DRAW_STROKE_WIDTH": "Stroke Width",
	"TOOL_LIGHT": "Light Layer",
	"TOOL_LIGHT_COLOUR": "Wall Colour",
	"TOOL_LIGHT_REMOVE": "Remove Wall",
	"TOOL_LIGHT_SUN": "Position Sun/Moon",
	"TOOL_LIGHT_WALL": "Wall Tool",
	"TOOL_MASK": "Mask Tool",
	"TOOL_MOVE": "Move All",
	"TOOL_ZOOM": "Zoom",
	"TOOL_ZOOM_IN": "Zoom In",
	"TOOL_ZOOM_OUT": "Zoom Out",
	"UNDO_LIMIT": "Undo Limit (-1 for infinite, 0 to disable)",
	"UNSAVED_CHANGES": "There are unsaved changes, are you sure you wish to close?",
	"UPLOAD_AUDIO": "Upload Sound",
	"UPLOAD_IMAGES": "Upload Image",
	"UPLOADING": "Uploading Files...",
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
