// On-chain READ adapter.
//
// dApp Kit's signing/wallet surface is fully typed and verified. The gRPC READ
// API (object fetch + event scan) is newer and its exact return shape varies by
// SDK build, so reads go through this adapter where the client is treated as
// `any`. If the live gRPC schema differs, adjust ONLY this file — the rest of
// the app consumes the normalized shapes below.

import {
  parseDataset,
  parseCampaign,
  parseUsageRecord,
  type Dataset,
  type Campaign,
  type UsageRecord,
} from '../contracts';
import { tatumEnabled, tatumGetObject, tatumGetOwnedObjects } from './tatum';
import { PACKAGE_ID } from '../contracts';

type AnyClient = any;

export interface OwnedCap {
  id: string;
  /** short label for the dropdown, e.g. "ProviderCap · 0x18cd…cdae" */
  label: string;
}

/** Pull the object id + type from whatever owned-object entry shape we get. */
function ownedEntry(o: any): { id?: string; type?: string } {
  const d = o?.data ?? o; // Tatum wraps each in { data: {...} }
  return {
    id: d?.objectId ?? d?.object_id ?? d?.id,
    type: d?.type ?? d?.objectType ?? d?.object_type,
  };
}

/**
 * List capability objects of `kind` (acl::PublisherCap | acl::ProviderCap)
 * owned by `owner`, for dropdown selection instead of pasting ids.
 */
export async function getOwnedCaps(
  client: AnyClient,
  owner: string,
  kind: 'PublisherCap' | 'ProviderCap',
): Promise<OwnedCap[]> {
  const wantType = `${PACKAGE_ID}::acl::${kind}`;
  let raw: any[];
  if (tatumEnabled) {
    const res = await tatumGetOwnedObjects(owner, PACKAGE_ID, 'acl');
    raw = res?.data ?? [];
  } else {
    const opts = {
      owner,
      filter: { MoveModule: { package: PACKAGE_ID, module: 'acl' } },
      options: { showType: true },
    };
    const res =
      (await client?.core?.getOwnedObjects?.(opts)) ??
      (await client?.getOwnedObjects?.(opts));
    raw = res?.data ?? res?.objects ?? [];
  }
  return raw
    .map(ownedEntry)
    .filter((e) => e.id && e.type === wantType)
    .map((e) => ({ id: e.id as string, label: `${kind} · ${shortId(e.id as string)}` }));
}

function shortId(id: string): string {
  return id.length > 12 ? `${id.slice(0, 6)}…${id.slice(-4)}` : id;
}

/** Extract the Move struct fields from whatever object-response shape we get. */
function extractFields(obj: any): Record<string, any> | null {
  if (!obj) return null;
  // Try the common shapes across JSON-RPC / gRPC / core API responses.
  return (
    obj?.data?.content?.fields ??
    obj?.content?.fields ??
    obj?.fields ??
    obj?.object?.content?.fields ??
    obj?.asMoveObject?.contents?.json ??
    null
  );
}

async function fetchObject(client: AnyClient, id: string): Promise<any> {
  // Proven path: Tatum JSON-RPC gateway. extractFields() handles the
  // result.data.content.fields shape it returns.
  if (tatumEnabled) return tatumGetObject(id);

  // Fallback: dApp Kit gRPC client (v2 core namespace, then legacy).
  const opts = { objectId: id, options: { showContent: true } };
  if (client?.core?.getObject) return client.core.getObject(opts);
  if (client?.getObject) return client.getObject(opts);
  throw new Error('No RPC read path: set VITE_TATUM_API_KEY or provide a gRPC client');
}

export async function getDataset(client: AnyClient, id: string): Promise<Dataset | null> {
  const fields = extractFields(await fetchObject(client, id));
  return fields ? parseDataset(fields) : null;
}

export async function getCampaign(client: AnyClient, id: string): Promise<Campaign | null> {
  const fields = extractFields(await fetchObject(client, id));
  return fields ? parseCampaign(fields) : null;
}

export async function getUsageRecord(client: AnyClient, id: string): Promise<UsageRecord | null> {
  const fields = extractFields(await fetchObject(client, id));
  return fields ? parseUsageRecord(fields) : null;
}

export async function getMany<T>(
  client: AnyClient,
  ids: string[],
  fetcher: (c: AnyClient, id: string) => Promise<T | null>,
): Promise<T[]> {
  const out = await Promise.all(
    ids.map((id) => fetcher(client, id).catch(() => null)),
  );
  return (out as (T | null)[]).filter((x): x is T => x !== null);
}

/**
 * Pull created object ids from a tx result's effects (shape-tolerant). Used to
 * register newly-created shared objects into the local discovery registry
 * (we avoid requiring a full indexer for the hackathon MVP).
 */
export function createdObjectIds(txResult: any): string[] {
  const eff = txResult?.Transaction?.effects ?? txResult?.effects ?? {};
  // gRPC v2: effects.changedObjects[] tagged with idOperation ('Created' |
  // 'Deleted' | 'None'); we want only freshly created ids. Legacy JSON-RPC put
  // them in a dedicated effects.created[] — keep that path as a fallback.
  const changed: any[] = eff?.changedObjects ?? eff?.created ?? [];
  const ids: string[] = [];
  for (const c of changed) {
    // On changedObjects, filter to created. On legacy created[], idOperation is
    // absent so the !== 'Deleted'/'None' guard passes everything through.
    const op = c?.idOperation;
    if (op === 'Deleted' || op === 'None') continue;
    const id = c?.reference?.objectId ?? c?.objectId ?? c?.id ?? c?.object_id;
    if (typeof id === 'string') ids.push(id);
  }
  return ids;
}
