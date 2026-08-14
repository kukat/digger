import AsyncStorage from '@react-native-async-storage/async-storage';

import type { DnsRecordType } from '../native/NativeDns';

export type RecentQuery = {
  name: string;
  type: DnsRecordType;
};

export interface RecentQueryStorage {
  load(): Promise<readonly RecentQuery[]>;
  save(entries: readonly RecentQuery[]): Promise<void>;
}

export const MAX_RECENT_QUERIES = 50;
const storageKey = '@digger/recent-queries';
const recordTypes = new Set<DnsRecordType>([
  'A',
  'AAAA',
  'CNAME',
  'MX',
  'TXT',
  'NS',
  'SOA',
  'PTR',
  'SRV',
  'CAA',
  'HTTPS',
  'SVCB',
]);

function isRecentQuery(value: unknown): value is RecentQuery {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const { name, type } = value as Record<string, unknown>;
  return (
    typeof name === 'string' &&
    name.length > 1 &&
    name.endsWith('.') &&
    recordTypes.has(type as DnsRecordType)
  );
}

function normaliseEntries(entries: readonly RecentQuery[]): RecentQuery[] {
  const unique = new Set<string>();
  const normalised: RecentQuery[] = [];
  for (const entry of entries) {
    if (!isRecentQuery(entry)) {
      continue;
    }
    const query = { name: entry.name.toLowerCase(), type: entry.type };
    const key = `${query.name}\0${query.type}`;
    if (!unique.has(key)) {
      unique.add(key);
      normalised.push(query);
    }
    if (normalised.length === MAX_RECENT_QUERIES) {
      break;
    }
  }
  return normalised;
}

export const recentQueryStorage: RecentQueryStorage = {
  async load() {
    const value = await AsyncStorage.getItem(storageKey);
    if (!value) {
      return [];
    }
    try {
      const parsed: unknown = JSON.parse(value);
      return Array.isArray(parsed)
        ? normaliseEntries(parsed.filter(isRecentQuery))
        : [];
    } catch {
      return [];
    }
  },
  save(entries) {
    return AsyncStorage.setItem(storageKey, JSON.stringify(entries));
  },
};

export class RecentQueries {
  private entries: RecentQuery[] = [];
  private readonly listeners = new Set<
    (entries: readonly RecentQuery[]) => void
  >();
  private readonly ready: Promise<void>;
  private writes = Promise.resolve();

  constructor(private readonly storage: RecentQueryStorage) {
    this.ready = Promise.resolve()
      .then(() => storage.load())
      .then(entries => {
        this.entries = normaliseEntries(entries);
        this.notify();
      })
      .catch(() => undefined);
  }

  getAll(): readonly RecentQuery[] {
    return this.entries;
  }

  subscribe(listener: (entries: readonly RecentQuery[]) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  record(query: RecentQuery): Promise<void> {
    return this.update(entries => [
      query,
      ...entries.filter(
        entry => entry.name !== query.name || entry.type !== query.type,
      ),
    ]);
  }

  remove(query: RecentQuery): Promise<void> {
    return this.update(entries =>
      entries.filter(
        entry => entry.name !== query.name || entry.type !== query.type,
      ),
    );
  }

  clear(): Promise<void> {
    return this.update(() => []);
  }

  private update(
    transform: (entries: readonly RecentQuery[]) => readonly RecentQuery[],
  ): Promise<void> {
    this.writes = this.writes.then(async () => {
      await this.ready;
      this.entries = normaliseEntries(transform(this.entries));
      this.notify();
      try {
        await this.storage.save(this.entries);
      } catch {
        // A storage failure must not retain Result data or interrupt an active Query.
      }
    });
    return this.writes;
  }

  private notify() {
    for (const listener of this.listeners) {
      listener(this.entries);
    }
  }
}
