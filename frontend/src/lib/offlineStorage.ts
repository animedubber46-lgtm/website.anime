import { openDB, DBSchema, IDBPDatabase } from 'idb';

interface OfflineEpisode {
  id: string;         // episodeId
  animeId: string;
  animeTitle: string;
  animeSlug: string;
  episodeNumber: number;
  episodeTitle: string;
  thumbnail: string;
  duration: number;
  // Encrypted HLS segments stored as Uint8Array
  encryptedData: ArrayBuffer;
  quality: string;
  size: number;
  downloadedAt: Date;
}

interface AnimeXDB extends DBSchema {
  episodes: {
    key: string;
    value: OfflineEpisode;
    indexes: { 'by-anime': string };
  };
  metadata: {
    key: string;
    value: { key: string; value: unknown };
  };
}

let db: IDBPDatabase<AnimeXDB>;

async function getDB() {
  if (!db) {
    db = await openDB<AnimeXDB>('animex-offline', 1, {
      upgrade(database) {
        const episodeStore = database.createObjectStore('episodes', { keyPath: 'id' });
        episodeStore.createIndex('by-anime', 'animeId');
        database.createObjectStore('metadata', { keyPath: 'key' });
      },
    });
  }
  return db;
}

// AES-GCM encryption key (stored in IndexedDB — not exportable to device storage)
async function getEncryptionKey(): Promise<CryptoKey> {
  const database = await getDB();
  const stored = await database.get('metadata', 'enc-key');

  if (stored) {
    return crypto.subtle.importKey(
      'raw',
      stored.value as ArrayBuffer,
      { name: 'AES-GCM' },
      false,
      ['encrypt', 'decrypt']
    );
  }

  // Generate new key
  const key = await crypto.subtle.generateKey(
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt']
  );

  const exported = await crypto.subtle.exportKey('raw', key);
  await database.put('metadata', { key: 'enc-key', value: exported });

  return key;
}

async function encryptData(data: ArrayBuffer): Promise<{ encrypted: ArrayBuffer; iv: Uint8Array }> {
  const key = await getEncryptionKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, data);
  return { encrypted, iv };
}

async function decryptData(encrypted: ArrayBuffer, iv: Uint8Array): Promise<ArrayBuffer> {
  const key = await getEncryptionKey();
  return crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, encrypted);
}

export const offlineStorage = {
  /**
   * Download and encrypt episode for offline viewing.
   * The data never touches the device's Downloads folder.
   */
  async saveEpisode(
    episode: Omit<OfflineEpisode, 'encryptedData' | 'downloadedAt'>,
    hlsData: ArrayBuffer
  ): Promise<void> {
    const database = await getDB();
    const { encrypted, iv } = await encryptData(hlsData);

    // Prepend IV to encrypted data
    const combined = new Uint8Array(iv.length + encrypted.byteLength);
    combined.set(iv, 0);
    combined.set(new Uint8Array(encrypted), iv.length);

    await database.put('episodes', {
      ...episode,
      encryptedData: combined.buffer,
      downloadedAt: new Date(),
    });
  },

  /**
   * Retrieve and decrypt an offline episode for playback.
   */
  async getEpisode(episodeId: string): Promise<{ episode: OfflineEpisode; data: ArrayBuffer } | null> {
    const database = await getDB();
    const episode = await database.get('episodes', episodeId);
    if (!episode) return null;

    const combined = new Uint8Array(episode.encryptedData);
    const iv = combined.slice(0, 12);
    const encrypted = combined.slice(12);

    const data = await decryptData(encrypted.buffer, iv);
    return { episode, data };
  },

  async getOfflineEpisodes(): Promise<Omit<OfflineEpisode, 'encryptedData'>[]> {
    const database = await getDB();
    const all = await database.getAll('episodes');
    return all.map(({ encryptedData, ...rest }) => rest);
  },

  async getEpisodesByAnime(animeId: string): Promise<Omit<OfflineEpisode, 'encryptedData'>[]> {
    const database = await getDB();
    const all = await database.getAllFromIndex('episodes', 'by-anime', animeId);
    return all.map(({ encryptedData, ...rest }) => rest);
  },

  async removeEpisode(episodeId: string): Promise<void> {
    const database = await getDB();
    await database.delete('episodes', episodeId);
  },

  async getStorageUsage(): Promise<{ used: number; available: number }> {
    if ('storage' in navigator && 'estimate' in navigator.storage) {
      const estimate = await navigator.storage.estimate();
      return {
        used: estimate.usage || 0,
        available: estimate.quota || 0,
      };
    }
    return { used: 0, available: 0 };
  },

  async isEpisodeDownloaded(episodeId: string): Promise<boolean> {
    const database = await getDB();
    const ep = await database.get('episodes', episodeId);
    return !!ep;
  },

  async clearAll(): Promise<void> {
    const database = await getDB();
    await database.clear('episodes');
  },
};
