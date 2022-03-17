import type {Byte, IDName, WidthHeight} from './types.js';
import type {Colour} from './colours.js';
import {DragFiles, DragTransfer}  from './lib/drag.js';

export type FolderDragItem = IDName & WidthHeight;

export const audioAsset = new DragTransfer<FolderDragItem>("audioasset"),
character = new DragTransfer<FolderDragItem>("character"),
colour = new DragTransfer<Colour>("colour"),
imageAsset = new DragTransfer<FolderDragItem>("imageasset"),
map = new DragTransfer<FolderDragItem>("map"),
musicPack = new DragTransfer<IDName>("musicpack"),
scattering = new DragTransfer<Byte>("scattering"),
images = new DragFiles("image/gif", "image/png", "image/jpeg", "image/webp", "video/apng"),
audio = new DragFiles("application/ogg, audio/mpeg");
