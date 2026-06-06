// Lightweight client-side discovery registry. Shared objects (Dataset,
// Campaign) aren't returned by owned-object queries, and we don't run an
// indexer for the MVP — so we remember ids we create or import here.

type Kind = 'dataset' | 'campaign';

const KEY = (k: Kind) => `walcoop_ids_${k}`;

export function getIds(kind: Kind): string[] {
  try {
    return JSON.parse(localStorage.getItem(KEY(kind)) ?? '[]');
  } catch {
    return [];
  }
}

export function addId(kind: Kind, id: string): void {
  const ids = new Set(getIds(kind));
  ids.add(id);
  localStorage.setItem(KEY(kind), JSON.stringify([...ids]));
}

export function addIds(kind: Kind, newIds: string[]): void {
  newIds.forEach((id) => addId(kind, id));
}

export function removeId(kind: Kind, id: string): void {
  const ids = getIds(kind).filter((x) => x !== id);
  localStorage.setItem(KEY(kind), JSON.stringify(ids));
}
