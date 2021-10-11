package battlemap

import (
	"encoding/json"
	"sync/atomic"
)

const (
	broadcastIsAdmin = -1 - iota
	broadcastCurrentUserMap
	broadcastCurrentUserMapData

	broadcastMapDataSet
	broadcastMapDataRemove
	broadcastMapStartChange

	broadcastImageItemAdd
	broadcastAudioItemAdd
	broadcastCharacterItemAdd
	broadcastMapItemAdd

	broadcastImageItemMove
	broadcastAudioItemMove
	broadcastCharacterItemMove
	broadcastMapItemMove

	broadcastImageItemRemove
	broadcastAudioItemRemove
	broadcastCharacterItemRemove
	broadcastMapItemRemove

	broadcastImageItemCopy
	broadcastAudioItemCopy
	broadcastCharacterItemCopy
	broadcastMapItemCopy

	broadcastImageFolderAdd
	broadcastAudioFolderAdd
	broadcastCharacterFolderAdd
	broadcastMapFolderAdd

	broadcastImageFolderMove
	broadcastAudioFolderMove
	broadcastCharacterFolderMove
	broadcastMapFolderMove

	broadcastImageFolderRemove
	broadcastAudioFolderRemove
	broadcastCharacterFolderRemove
	broadcastMapFolderRemove

	broadcastMapItemChange

	broadcastCharacterDataChange
	broadcastTokenDataChange

	broadcastLayerAdd
	broadcastLayerFolderAdd
	broadcastLayerMove
	broadcastLayerRename
	broadcastLayerRemove

	broadcastGridDistanceChange
	broadcastGridDiagonalChange
	broadcastMapLightChange

	broadcastLayerShow
	broadcastLayerHide
	broadcastMaskAdd
	broadcastMaskRemove
	broadcastMaskReset

	broadcastTokenAdd
	broadcastTokenRemove
	broadcastTokenMoveLayerPos
	broadcastTokenSet
	broadcastLayerShift

	broadcastLightShift
	broadcastTokenLightChange
	broadcastWallAdd
	broadcastWallRemove

	broadcastMusicPackAdd
	broadcastMusicPackRename
	broadcastMusicPackRemove
	broadcastMusicPackCopy
	broadcastMusicPackVolume
	broadcastMusicPackPlay
	broadcastMusicPackStop
	broadcastMusicPackStopAll
	broadcastMusicPackTrackAdd
	broadcastMusicPackTrackRemove
	broadcastMusicPackTrackVolume
	broadcastMusicPackTrackRepeat

	broadcastPluginChange
	broadcastPluginSettingChange

	broadcastWindow

	broadcastSignalMeasure
	broadcastSignalPosition
	broadcastSignalMovePosition
	broadcastAny
)

func (s *socket) KickAdmins(except ID) {
	s.mu.RLock()
	for c := range s.conns {
		id := c.ID
		if id > 0 && id != except {
			go c.kickAdmin()
		}
	}
	s.mu.RUnlock()
}
func (c *conn) kickAdmin() {
	atomic.StoreUint64((*uint64)(&c.ID), 0)
	c.rpc.SendData(loggedOut)
}

const broadcastStart = "{\"id\": -0,\"result\":"

func buildBroadcast(id int, data json.RawMessage) []byte {
	l := len(broadcastStart) + len(data) + 1
	dat := make([]byte, l)
	copy(dat, broadcastStart)
	copy(dat[len(broadcastStart):], data)
	id = -id
	if id > 9 {
		dat[6] = '-'
		dat[7] = byte('0' + id/10)
	}
	dat[8] = byte('0' + id%10)
	dat[l-1] = '}'
	return dat
}

func (s *socket) SetCurrentUserMap(currentUserMap uint64, data, mData json.RawMessage, except ID) {
	s.mu.RLock()
	var dat, mdat json.RawMessage
	for c := range s.conns {
		id := c.ID
		if c.IsAdmin() {
			if except != id {
				if len(dat) == 0 {
					dat = buildBroadcast(broadcastCurrentUserMap, data)
				}
				go c.rpc.SendData(dat)
			}
		} else {
			if len(mdat) == 0 {
				mdat = buildBroadcast(broadcastCurrentUserMapData, mData)
			}
			atomic.StoreUint64(&c.CurrentMap, currentUserMap)
			go c.rpc.SendData(mdat)
		}
	}
	s.mu.RUnlock()
}

type userStatus uint8

const (
	userAny userStatus = iota
	userAdmin
	userNotAdmin
)

func (s *socket) broadcastMapChange(cd ConnData, id int, data json.RawMessage, user userStatus) {
	s.mu.RLock()
	var dat json.RawMessage
	for c := range s.conns {
		currentMap := atomic.LoadUint64(&c.CurrentMap)
		if c.ID != cd.ID && (currentMap == cd.CurrentMap || cd.CurrentMap == 0) && (user == userAny || ((user == userAdmin) && c.IsAdmin()) || ((user == userNotAdmin) && !c.IsAdmin())) {
			if len(dat) == 0 {
				dat = buildBroadcast(id, data)
			}
			go c.rpc.SendData(dat)
		}
	}
	s.mu.RUnlock()
}

func (s *socket) broadcastAdminChange(id int, data json.RawMessage, except ID) {
	s.mu.RLock()
	var dat json.RawMessage
	for c := range s.conns {
		if c.IsAdmin() && c.ID != except {
			if len(dat) == 0 {
				dat = buildBroadcast(id, data)
			}
			go c.rpc.SendData(dat)
		}
	}
	s.mu.RUnlock()
}

type idName struct {
	ID   uint64 `json:"id"`
	Name string `json:"name"`
}
