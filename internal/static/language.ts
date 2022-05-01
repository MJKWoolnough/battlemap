import {StringSetting} from './lib/settings.js';

const defaultLanguage = {
	"ARE_YOU_SURE": "Are you sure?",
	"AUTH": "Authentication",
	"AUTOSNAP": "Autosnap",
	"CANCEL": "Cancel",
	"CHARACTER": "Character",
	"CHARACTER_CREATE": "Create Character",
	"CHARACTER_DRAG_ICON": "Drag icon here",
	"CHARACTER_NEW": "New Character",
	"CHARACTER_EDIT": "Edit Character",
	"CHARACTER_IMAGE": "Character Image",
	"CHARACTER_NAME": "Character Name",
	"CHARACTER_NEED_NAME": "A character needs a name",
	"CHARACTER_NEED_ICON": "A character needs an icon",
	"CHARACTERS": "Characters",
	"CLOSE": "Close",
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
	"ERROR_UNKNOWN": "Unknown error occurred, connection closed",
	"FILTER": "Filter",
	"FOLDER_ADD": "Add Folder",
	"FOLDER_MOVE": "Move Folder",
	"FOLDER_NAME": "Folder Name",
	"FOLDER_REMOVE": "Remove Folder",
	"FOLDER_REMOVE_CONFIRM": "Remove the following folder? NB: This will remove all folders and items it contains.",
	"HELP": "Help",
	"HELP_DEMO_DRAG": "The map can be moved around by left-click dragging it.",
	"HELP_DEMO_SCROLL": "The map can also be moved around with the scroll wheel. Up & Down on the scroll wheel will move the map Up & Down, and holding the Shift key while scrolling will move the map Left & Right accordingly.",
	"HELP_DEMO_SIDEPANEL_OPEN": "The Red outlined (Semi-)Circle can be used to toggle the display of the Sidepanel, where settings for the map are stored.",
	"HELP_DEMO_SIDEPANEL_RESIZE": "When the Sidepanel is open, left-click dragging it will adjust the width of the sidebar.",
	"HELP_DEMO_SIGNAL": "Right clicking on the map will produce a signal, an expanding circle, that both you and the GM are able to see.",
	"HELP_DEMO_ZOOM": "The map can be zoomed In & Out by holding the Ctrl key on the keyboard and scrolling the mouse's scroll wheel Up & Down.",
	"HELP_MAP_DRAG": "Map Moving",
	"HELP_MAP_SCROLL": "Map Scrolling",
	"HELP_MAP_SIGNAL": "Signalling",
	"HELP_MAP_ZOOM": "Map Zoom",
	"HELP_OPEN": "Press F1 anytime, or click here, to open Help",
	"HELP_PANEL_OPEN": "Opening/Closing Side Panel",
	"HELP_PANEL_RESIZE": "Resizing Side Panel",
	"HIDE_MENU": "Hide Menu Button?",
	"INVALID_ACTION": "Invalid Action",
	"INVALID_RENAME": "Cannot rename active map",
	"INVALID_RENAME_CONTAIN": "Cannot rename while containing active map",
	"INVALID_REMOVE": "Cannot remove active map",
	"INVALID_REMOVE_CONTAIN": "Cannot remove while containing active map",
	"ITEM_COPY": "Copy Item",
	"ITEM_COPY_ADD": "Copy Item",
	"ITEM_COPY_NEW": "Copy To",
	"ITEM_MOVE": "Move Item",
	"ITEM_REMOVE": "Remove Item",
	"ITEM_REMOVE_CONFIRM": "Remove the following item?",
	"LANGUAGE": "Language",
	"LAYER_ADD": "Add Layer",
	"LAYER_GRID": "Grid",
	"LAYER_HIDDEN_OPACITY": "Hidden Layer Opacity",
	"LAYER_HIDDEN_SELECTED_OPACITY": "Selected Hidden Layer Opacity",
	"LAYER_LIGHT": "Light",
	"LAYER_LIGHT_COLOUR": "Change Light Colour",
	"LAYER_NAME": "Name",
	"LAYER_RENAME": "Rename Layer",
	"LAYER_TOGGLE_VISIBILITY": "Toggle Visibility",
	"LIGHTING_COLOUR": "Light Colour",
	"LIGHTING_INTENSITY": "Light Intensity (Distance)",
	"LIGHTING_PICK_COLOUR": "Pick Token Lighting Colour",
	"LOADING": "Loading…",
	"LOADING_MAP": "Loading Map",
	"LOGIN": "Login",
	"LOGOUT": "Logout",
	"MAP_ADD": "Add Map",
	"MAP_CHANGED": "Map Changed",
	"MAP_CHANGED_LONG": "An error occurred because the map was changed",
	"MAP_EDIT": "Edit Map",
	"MAP_NAME": "Map Name",
	"MAP_NEW": "New Map",
	"MAP_NONE_SELECTED": "No Map Selected",
	"MAP_SET_USER": "Set User Map",
	"MAP_SETTINGS": "Map Settings",
	"MAP_SQUARE_COLOUR": "Tile Line Colour",
	"MAP_SQUARE_HEIGHT": "Height in Tiles",
	"MAP_SQUARE_LINE": "Tile Line Width",
	"MAP_SQUARE_SIZE": "Tile Size",
	"MAP_SQUARE_TYPE": "Tile Type",
	"MAP_SQUARE_TYPE_HEX_H": "Hexagon Tiles - Horizontal",
	"MAP_SQUARE_TYPE_HEX_V": "Hexagon Tiles - Vertical",
	"MAP_SQUARE_TYPE_SQUARE": "Square Tiles",
	"MAP_SQUARE_WIDTH": "Width in Tiles",
	"MAXIMISE": "Maximise",
	"MEASURE_TOKEN_MOVE": "Automatically Measure Token Moves",
	"MINI_TOOLS": "Mini Tools Windows",
	"MINIMISE": "Minimise",
	"MUSIC_ADD": "Add Music Pack",
	"MUSIC_ADD_NAME": "Please enter a name for this new music pack",
	"MUSIC_ENABLE": "Autoplay is disabled, please click here to enable",
	"MUSIC_RENAME": "Rename Music Pack",
	"MUSIC_RENAME_LONG": "Please enter a new name for this music pack",
	"MUSIC_REMOVE": "Remove Music Pack",
	"MUSIC_REMOVE_LONG": "Are you sure you wish to remove this music pack",
	"MUSIC_COPY": "Copy Music Pack",
	"MUSIC_COPY_LONG": "Please enter a name for this music pack copy",
	"MUSIC_DROP": "To add a track, drag an Audio Asset here",
	"MUSIC_PAUSE": "Pause",
	"MUSIC_PLAY": "Play",
	"MUSIC_STOP": "Stop",
	"MUSIC_TRACK": "Track",
	"MUSIC_TRACK_REMOVE": "Remove Music Track",
	"MUSIC_TRACK_REMOVE_LONG": "Are you sure you wish to remove this track?",
	"MUSIC_WINDOW_TITLE": "Music Pack",
	"OK": "Ok",
	"OLD_LOCATION": "Old Location",
	"NEW_LOCATION": "New Location",
	"PANEL_GRABBER": "Click to Show/Hide - Drag to Resize",
	"PANEL_ON_TOP": "Show Side Panel above Windows",
	"PLUGINS": "Plugins",
	"PLUGIN_REFRESH": "Refresh Page?",
	"PLUGIN_REFRESH_REQUEST": "Plugin settings have change and a page refresh is required to load changes. Refresh the page now?",
	"RESTORE": "Restore",
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
	"SHARE": "Share",
	"TAB_AUDIO": "Audio",
	"TAB_CHARACTERS": "Characters",
	"TAB_ICONS": "Show Tab Icons",
	"TAB_IMAGES": "Images",
	"TAB_LAYERS": "Layers",
	"TAB_MAPS": "Maps",
	"TAB_MUSIC_PACKS": "Music",
	"TAB_SETTINGS": "Settings",
	"TAB_TOOLS": "Tools",
	"THEME": "Theme",
	"TITLE": "Battlemap",
	"TOKEN": "Token",
	"TOKEN_ADD": "Add Token",
	"TOKEN_NEXT": "Next Token",
	"TOKEN_ORDER": "Token Order",
	"TOKEN_ORDER_NORMAL": "Normal",
	"TOKEN_ORDER_SHUFFLE": "Shuffle",
	"TOKEN_REMOVE": "Remove Token?",
	"TOKEN_REMOVE_CONFIRM": "Are you sure that you wish to remove this token?",
	"TOKEN_REPLACE": "Replace Token?",
	"TOKEN_REPLACE_CONFIRM": "Are you sure that you wish to replace the current token with the currently selected token?",
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
	"TOOL_DRAW_SHAPE": "Draw Shape",
	"TOOL_DRAW_SNAP": "Snap to Grid",
	"TOOL_DRAW_STROKE_COLOUR": "Stroke Colour",
	"TOOL_DRAW_STROKE_WIDTH": "Stroke Width",
	"TOOL_MASK": "Mask Tool",
	"TOOL_MASK_CLEAR": "Clear Mask",
	"TOOL_MASK_CLEAR_CONFIRM": "Are you sure you wish to clear the mask?",
	"TOOL_MASK_DRAW_SHAPE": "Draw Shape",
	"TOOL_MASK_DRAW_TYPE": "Draw Type",
	"TOOL_MASK_OPACITY": "Mask Opacity",
	"TOOL_MASK_OPAQUE": "Opaque",
	"TOOL_MASK_REMOVE": "Remove",
	"TOOL_MASK_TRANSPARENT": "Transparent",
	"TOOL_MEASURE": "Measuring Tool",
	"TOOL_MEASURE_CELL": "Cell Distance",
	"TOOL_MEASURE_DIAGONALS": "Measure Diagonals",
	"TOOL_MEASURE_MULTI": "Multiple Measuring Points",
	"TOOL_MEASURE_SNAP": "Snap to Grid",
	"TOOL_MOVE": "Move All",
	"TOOL_MULTIPLACE": "Multi-Place",
	"TOOL_MULTIPLACE_MODE": "Grab Mode",
	"TOOL_WALL": "Wall Tool",
	"TOOL_WALL_COLOUR": "Wall Colour",
	"TOOL_WALL_LAYER": "Wall Layer",
	"TOOL_WALL_MODE": "Wall Mode",
	"TOOL_WALL_PLACE": "Place Wall",
	"TOOL_WALL_SCATTER": "Wall Light Scattering",
	"TOOL_WALL_SELECT": "Select Wall",
	"TOOL_WALL_SNAP": "Snap to Grid",
	"UNDO_CHARACTER": "Character change",
	"UNDO_LAYER_ADD": "Add Layer",
	"UNDO_LAYER_FOLDER_ADD": "Add Layer Folder",
	"UNDO_LAYER_HIDE": "Hide Layer",
	"UNDO_LAYER_MOVE": "Move Layer",
	"UNDO_LAYER_RENAME": "Rename Layer",
	"UNDO_LAYER_SHIFT": "Layer Shift",
	"UNDO_LAYER_SHOW": "Show Layer",
	"UNDO_LIGHT_COLOUR": "Map Light Colour",
	"UNDO_LIMIT": "Undo Limit (-1 for infinite, 0 to disable)",
	"UNDO_MAP_CHANGE": "Map Settings Change",
	"UNDO_MAP_DATA_REMOVE": "Map Data Remove",
	"UNDO_MAP_DATA_SET": "Map Data Set",
	"UNDO_MAP_LOAD": "Map Loaded",
	"UNDO_MASK_ADD": "Mask Added",
	"UNDO_MASK_REMOVE": "Mask Removed",
	"UNDO_MASK_SET": "Mask Set",
	"UNDO_REDO": "Redo",
	"UNDO_TOKEN_ADD": "Token Add",
	"UNDO_TOKEN_LIGHT_CHANGE": "Token Light Change",
	"UNDO_TOKEN_MOVE": "Token Move Layer/Position",
	"UNDO_TOKEN_REMOVE": "Token Remove",
	"UNDO_TOKEN_SET": "Token Update",
	"UNDO_UNDO": "Undo",
	"UNDO_WALL_ADD": "Wall Add",
	"UNDO_WALL_MODIFY": "Wall Modified",
	"UNDO_WALL_MOVE": "Wall Move",
	"UNDO_WALL_REMOVE": "Wall Remove",
	"UNDO_WINDOW_TITLE": "Undo Debug",
	"UNDO_WINDOW_UNDOS": "Undo List",
	"UNDO_WINDOW_REDOS": "Redo List",
	"UNSAVED_CHANGES": "There are unsaved changes, are you sure you wish to close?",
	"UPLOAD_AUDIO": "Upload Sound",
	"UPLOAD_IMAGES": "Upload Image",
	"UPLOADING": "Uploading Files...",
	"ZOOM_SLIDER_HIDE": "Hide Zoom Slider"
      },
      overlayLang = <Pack extends Record<string, string>>(pack: Partial<Pack>, base: Pack) => {
	for (const s in base) {
		pack[s] ??= base[s];
	}
	return pack as Pack;
      },
      languagePacks: Record<string, typeof defaultLanguage> = {
	"en-GB": defaultLanguage,
	"en": defaultLanguage,
	"en-US": overlayLang({
		"COLOUR": "Color",
		"COLOUR_UPDATE": "Update Color",
		"LAYER_LIGHT_COLOUR": "Change Light Color",
		"LIGHTING_COLOUR": "Light Color",
		"LIGHTING_PICK_COLOUR": "Pick Token Lighting Color",
		"MAP_SQUARE_COLOUR": "Tile Line Color",
		"MAXIMISE": "Maximize",
		"MINIMISE": "Minimize",
		"TOOL_DRAW_FILL_COLOUR": "Fill Color",
		"TOOL_DRAW_STROKE_COLOUR": "Stroke Color",
		"TOOL_WALL_COLOUR": "Wall Color",
		"UNDO_LIGHT_COLOUR": "Map Light Color",
	}, defaultLanguage)
      };

export const languages: string[] = Object.keys(languagePacks),
language = new StringSetting("language", navigator.language);

export {overlayLang};
export default Object.freeze(languagePacks[language.value] ?? defaultLanguage);
