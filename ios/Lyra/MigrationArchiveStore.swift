import Foundation

struct MigrationArchiveStore {
    static let fileName = "lyra-web-migration-v1.json"

    private let fileManager: FileManager
    private let directory: URL?

    init(fileManager: FileManager = .default, directory: URL? = nil) {
        self.fileManager = fileManager
        self.directory = directory
    }

    func save(json: String) throws -> URL {
        guard let data = json.data(using: .utf8),
              let object = try JSONSerialization.jsonObject(with: data) as? [String: Any],
              object["version"] as? Int == 1,
              object["error"] == nil,
              object["downloads"] is [Any],
              object["covers"] is [Any] else {
            throw CocoaError(.fileReadCorruptFile)
        }

        let support = try directory ?? fileManager.url(
            for: .applicationSupportDirectory,
            in: .userDomainMask,
            appropriateFor: nil,
            create: true
        )
        try fileManager.createDirectory(at: support, withIntermediateDirectories: true)
        let destination = support.appendingPathComponent(Self.fileName, isDirectory: false)
        try data.write(to: destination, options: [.atomic, .completeFileProtectionUntilFirstUserAuthentication])
        return destination
    }
}

enum MigrationExportScript {
    static let source = #"""
    (() => {
      if (window.__lyraMigrationExportStarted) return;
      window.__lyraMigrationExportStarted = true;

      const requestAll = (database, storeName) => new Promise((resolve, reject) => {
        if (!database.objectStoreNames.contains(storeName)) {
          resolve([]);
          return;
        }
        const request = database.transaction(storeName, 'readonly').objectStore(storeName).getAll();
        request.onsuccess = () => resolve(request.result || []);
        request.onerror = () => reject(request.error);
      });

      const openDatabase = () => new Promise((resolve, reject) => {
        const request = indexedDB.open('ln-reader');
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });

      const blobBase64 = async (blob) => {
        const bytes = new Uint8Array(await blob.arrayBuffer());
        let binary = '';
        const chunkSize = 0x8000;
        for (let offset = 0; offset < bytes.length; offset += chunkSize) {
          binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize));
        }
        return btoa(binary);
      };

      const blocksFromHTML = (html) => {
        const document = new DOMParser().parseFromString(html, 'text/html');
        const nodes = [...document.body.querySelectorAll('h1,h2,h3,h4,h5,h6,p,blockquote,li,hr')];
        const blocks = [];
        for (const node of nodes) {
          const tag = node.tagName.toLowerCase();
          if (tag === 'p' && (node.closest('li') || node.closest('blockquote'))) continue;
          if (tag !== 'li' && node.closest('li')) continue;
          if (tag !== 'blockquote' && node.closest('blockquote')) continue;
          if (tag === 'hr') {
            blocks.push({ kind: 'divider', text: '' });
            continue;
          }
          const text = (node.textContent || '').replace(/\s+/g, ' ').trim();
          if (!text) continue;
          const kind = tag === 'blockquote'
            ? 'blockquote'
            : tag === 'li'
              ? 'listItem'
              : tag === 'h1' || tag === 'h2'
                ? 'heading2'
                : /^h[3-6]$/.test(tag)
                  ? 'heading3'
                  : 'paragraph';
          blocks.push({ kind, text });
        }
        return blocks;
      };

      const readJSON = (key) => {
        try {
          const value = localStorage.getItem(key);
          return value ? JSON.parse(value) : null;
        } catch (_) {
          return null;
        }
      };

      (async () => {
        const database = await openDatabase();
        const [downloads, covers] = await Promise.all([
          requestAll(database, 'downloads'),
          requestAll(database, 'covers'),
        ]);
        database.close();

        const encodedCovers = [];
        for (const cover of covers) {
          if (!(cover.blob instanceof Blob)) continue;
          encodedCovers.push({
            seriesKey: String(cover.seriesKey),
            mimeType: cover.blob.type || 'application/octet-stream',
            base64: await blobBase64(cover.blob),
          });
        }

        const archive = {
          version: 1,
          exportedAt: Date.now(),
          origin: location.origin,
          preferences: {
            reader: readJSON('ln-reader-reading-preferences'),
            theme: localStorage.getItem('ln-reader-theme'),
            chapterOrder: localStorage.getItem('chapter-order'),
            hideReadChapters: localStorage.getItem('hide-read-chapters') === 'true',
          },
          downloads: downloads.map((download) => ({
            chapterKey: String(download.chapterKey),
            seriesKey: String(download.seriesKey),
            downloadedAt: Number(download.downloadedAt) || Date.now(),
            content: {
              key: String(download.chapterKey),
              title: String(download.title || 'Chapitre'),
              html: String(download.html || ''),
              blocks: blocksFromHTML(String(download.html || '')),
              source: download.source === 'novelFr' || String(download.chapterKey).startsWith('novelFr:')
                ? 'novelFr'
                : 'novelFr',
            },
          })),
          covers: encodedCovers,
        };
        window.webkit.messageHandlers.lyraMigration.postMessage(JSON.stringify(archive));
      })().catch((error) => {
        window.webkit.messageHandlers.lyraMigration.postMessage(JSON.stringify({
          version: 1,
          error: String(error && error.message ? error.message : error),
          downloads: [],
          covers: [],
        }));
      });
    })();
    """#
}
