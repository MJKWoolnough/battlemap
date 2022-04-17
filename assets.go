package battlemap

import (
	"bytes"
	"crypto/sha256"
	"encoding/json"
	"fmt"
	"hash"
	"io"
	"net/http"
	"path"
	"path/filepath"
	"strconv"
	"strings"
	"sync"

	"vimagination.zapto.org/keystore"
	"vimagination.zapto.org/memio"
)

type hasher struct {
	hash.Hash
}

func (h *hasher) ReadFrom(r io.Reader) (int64, error) {
	return io.Copy(h.Hash, r)
}

type assetsDir struct {
	folders
	handler http.Handler
	hashes  map[[sha256.Size]byte][]uint64
	sync.Once
}

func (a *assetsDir) Init(b *Battlemap, links links) error {
	var (
		location keystore.String
		locname  string
		lm       linkManager
	)
	switch a.fileType {
	case fileTypeImage:
		locname = "ImageAssetsDir"
		lm = links.images
	case fileTypeAudio:
		locname = "AudioAssetsDir"
		lm = links.audio
	default:
		return ErrInvalidFileType
	}
	err := b.config.Get(locname, &location)
	if err != nil {
		return fmt.Errorf("error getting asset data directory: %w", err)
	}
	l := filepath.Join(b.config.BaseDir, string(location))
	assetStore, err := keystore.NewFileStore(l, l, keystore.NoMangle)
	if err != nil {
		return fmt.Errorf("error creating asset meta store: %w", err)
	}
	a.handler = http.FileServer(http.Dir(l))
	return a.folders.Init(b, assetStore, lm)
}

func (a *assetsDir) makeHashMap() {
	a.hashes = make(map[[sha256.Size]byte][]uint64)
	h := hasher{Hash: sha256.New()}
	for _, key := range a.Keys() {
		id, err := strconv.ParseUint(key, 10, 64)
		if err != nil {
			continue
		}
		var hash [sha256.Size]byte
		if err := a.Get(key, &h); err != nil {
			continue
		}
		h.Sum(hash[:0])
		a.hashes[hash] = append(a.hashes[hash], id)
		h.Reset()
	}
}

func (a *assetsDir) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	a.Once.Do(a.makeHashMap)
	switch r.Method {
	case http.MethodGet, http.MethodHead:
		if r.URL.Path == folderMetadata {
			http.NotFound(w, r)
		} else {
			a.handler.ServeHTTP(w, r)
		}
	case http.MethodPost:
		if !a.auth.IsAdmin(r) {
			http.Error(w, http.StatusText(http.StatusUnauthorized), http.StatusUnauthorized)
		} else if r.URL.Path != "" {
			http.Error(w, http.StatusText(http.StatusMethodNotAllowed), http.StatusMethodNotAllowed)
		} else if err := a.Post(w, r); err != nil {
			http.Error(w, err.Error(), http.StatusBadRequest)
		}
	default:
		http.Error(w, http.StatusText(http.StatusMethodNotAllowed), http.StatusMethodNotAllowed)
	}
}

func (a *assetsDir) Post(w http.ResponseWriter, r *http.Request) error {
	m, err := r.MultipartReader()
	defer r.Body.Close()
	if err != nil {
		return err
	}
	var (
		added  []idName
		gft    getFileType
		hash   [sha256.Size]byte
		folder map[string]uint64
	)
	h := sha256.New()
	r.ParseForm()
	folderPath := path.Clean("/" + r.Form.Get("path"))
	if f := a.getFolder(folderPath); f != nil {
		folder = f.Items
		folderPath += "/"
	} else {
		folderPath = "/"
		folder = a.root.Items
	}
	for {
		p, err := m.NextPart()
		if err != nil {
			if err == io.EOF {
				break
			}
			return err
		}
		gft.Type = fileTypeUnknown
		bufLen, err := gft.ReadFrom(p)
		if err != nil {
			return err
		}
		if gft.Type != a.fileType {
			continue
		}
		a.mu.Lock()
		a.lastID++
		id := a.lastID
		a.mu.Unlock()
		idStr := strconv.FormatUint(id, 10)
		b := bufReaderWriterTo{gft.Buffer[:bufLen], p, h, 0}
		if err = a.Set(idStr, &b); err != nil {
			return err
		}
		h.Sum(hash[:0])
		h.Reset()
		if ids, ok := a.hashes[hash]; ok {
			match := false
			for _, fid := range ids {
				fidStr := strconv.FormatUint(fid, 10)
				fs, err := a.Stat(fidStr)
				if err != nil {
					continue
				}
				if fs.Size() == b.size {
					a.Get(idStr, readerFromFunc(func(ar io.Reader) {
						a.Get(fidStr, readerFromFunc(func(br io.Reader) {
							abuf, bbuf := make([]byte, 32768), make([]byte, 32768)
							for {
								n, erra := io.ReadFull(ar, abuf)
								m, errb := io.ReadFull(br, bbuf)
								if !bytes.Equal(abuf[:n], bbuf[:m]) {
									return
								}
								if erra == io.EOF || erra == io.ErrUnexpectedEOF {
									match = erra == errb
									return
								} else if erra != nil || errb != nil {
									return
								}
							}
						}))
					}))
					if match {
						id = fid
						a.mu.Lock()
						a.lastID--
						a.mu.Unlock()
						a.Remove(idStr)
						break
					}
				}
			}
			if !match {
				a.hashes[hash] = append(ids, id)
			}
		} else {
			a.hashes[hash] = []uint64{id}
		}
		filename := p.FileName()
		if filename == "" || strings.ContainsAny(filename, invalidFilenameChars) {
			filename = idStr
		}
		newName := addItemTo(folder, filename, id)
		added = append(added, idName{id, newName})
	}
	if len(added) == 0 {
		w.WriteHeader(http.StatusNoContent)
		return nil
	}
	a.mu.Lock()
	a.saveFolders()
	a.mu.Unlock()
	var buf memio.Buffer
	fmt.Fprintf(&buf, "[{\"id\":%d,\"name\":%q}", added[0].ID, folderPath+added[0].Name)
	for _, id := range added[1:] {
		fmt.Fprintf(&buf, ",{\"id\":%d,\"name\":%q}", id.ID, folderPath+id.Name)
	}
	fmt.Fprint(&buf, "]")
	bid := broadcastImageItemAdd
	if a.fileType == fileTypeAudio {
		bid--
	}
	a.socket.broadcastAdminChange(bid, json.RawMessage(buf), SocketIDFromRequest(r))
	w.Header().Set(contentType, "application/json")
	w.Header().Set("Content-Length", strconv.FormatUint(uint64(len(buf)), 10))
	w.Write(buf)
	return nil
}

type bufReaderWriterTo struct {
	Buf    []byte
	Reader io.Reader
	hash   hash.Hash
	size   int64
}

func (b *bufReaderWriterTo) WriteTo(w io.Writer) (int64, error) {
	b.hash.Reset()
	b.hash.Write(b.Buf)
	n, err := w.Write(b.Buf)
	if err != nil {
		return int64(n), err
	}
	m, err := io.Copy(io.MultiWriter(w, b.hash), b.Reader)
	b.size = int64(n) + m
	return int64(n) + m, err
}

type readerFromFunc func(io.Reader)

func (rff readerFromFunc) ReadFrom(r io.Reader) (int64, error) {
	rff(r)
	return 0, nil
}

const (
	invalidFilenameChars = "\x00\r\n\\/"
	contentType          = "Content-Type"
)
