import {id, ids} from './lib/css.js';

export const [settingsTicker, invertID, adminHideLight] = ids(3),
selectedLayerID = id(),
tokenSelector = id(),
[folderDragging, dragOver, folders, foldersItem, itemControl, imageIcon] = ids(6),
[layerLight, layerGrid, hiddenLayer, mapID, hideZoomSlider, zoomSliderID, zooming] = ids(7),
cursors = ids(4),
[lighting, mapMask, gridPattern]  = ids(3);
