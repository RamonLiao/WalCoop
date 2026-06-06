# 前後端 Pipeline 接通 — 實作計畫

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development 或 executing-plans，逐 task 實作。Steps 用 `- [ ]` 追蹤。
> Spec：`docs/specs/2026-06-07-frontend-backend-pipeline-design.md`

**Goal:** 讓資料真的被 Seal 加密上 Walrus、被 Seal 解密（鏈上 `seal_approve` 放行）、模型跑出結果，全程前端可操作可見。

**Architecture:** 前端錢包簽所有鏈上交易；後端新增**零簽署**的 `/encrypt`、`/decrypt-train` 做 Seal/Walrus 鏈下算力；瀏覽器簽 Seal SessionKey 委託後端解密。舊簽署 endpoint 保留給 e2e（GTM 移除）。

**Tech Stack:** Express + `@mysten/seal` 1.1.3 + `@mysten/walrus`（後端）；React + dapp-kit + `@mysten/seal`（SessionKey）+ `SuiGrpcClient`（前端）。

---

## 檔案結構

**後端**
- 修改 `backend/src/pipeline.ts` — 抽出純鏈下函式 `sealEncryptStore`、`decryptTrainReport`；舊 `publishDataset`/`runModelWorker` 改呼叫它們。
- 修改 `backend/src/server.ts` — 加 `cors`、`POST /encrypt`、`POST /decrypt-train`。
- 建立 `backend/src/pipeline.test.ts` — 純函式單元測試（mock seal/walrus）。

**前端**
- 建立 `frontend/src/lib/backend.ts` — backend HTTP client（`encrypt`、`decryptTrain`）。
- 建立 `frontend/src/lib/seal.ts` — 瀏覽器 SessionKey 建立+簽署 helper。
- 修改 `frontend/src/lib/registry.ts` — 加 AccessTicket / pending-blob 暫存。
- 修改 `frontend/src/pages/Marketplace.tsx` — textarea+file 上傳，register→encrypt→updateBlob 流程 + 重試綁定。
- 修改 `frontend/src/pages/Campaigns.tsx` — fund 捕捉 ticketId；settle 走 SessionKey→decrypt-train→settle。
- 修改 `frontend/.env.example` / `.env.local` — 加 `VITE_BACKEND_URL`。

---

## Task 1：後端抽出純鏈下函式（不簽鏈上）

**Files:** Modify `backend/src/pipeline.ts`

- [ ] **Step 1: 抽出 `sealEncryptStore` + `decryptTrainReport`**

在 `pipeline.ts` 加（放在 `publishDataset` 之前）：

```ts
/** 純鏈下：Seal 加密(id=datasetId) → 寫 Walrus。不簽鏈上。 */
export async function sealEncryptStore(datasetId: string, data: Uint8Array): Promise<string> {
  const { encryptedObject } = await sealClient.encrypt({
    threshold: SEAL_THRESHOLD,
    packageId: PACKAGE_ID,
    id: datasetId,
    data,
  });
  return walrusWrite(encryptedObject);
}

/** 純鏈下：用瀏覽器簽的 SessionKey 解密被 seal_approve 放行的 dataset → toy 模型 → 報告寫 Walrus。不簽鏈上。 */
export async function decryptTrainReport(args: {
  sessionKey: import('@mysten/seal').ExportedSessionKey;
  ticketId: string;
  campaignId: string;
  datasets: { datasetId: string; blobId: string }[];
}): Promise<{ reportBlobId: string; usageStatsHashHex: string; modelOutput: Record<string, unknown> }> {
  const sessionKey = SessionKey.import(args.sessionKey, suiClient as any);
  const perDataset: Record<string, unknown> = {};
  for (const ds of args.datasets) {
    const txBytes = await buildSealApproveTxBytes(ds.datasetId, args.ticketId);
    const ciphertext = await walrusClient.readBlob({ blobId: ds.blobId });
    const plaintext = await sealClient.decrypt({ data: ciphertext, sessionKey, txBytes });
    perDataset[ds.datasetId] = toyModel(plaintext);
  }
  const report = { campaignId: args.campaignId, model: 'toy-topk-v0', trainedAt: new Date().toISOString(), perDataset };
  const reportBytes = enc(JSON.stringify(report));
  const reportBlobId = await walrusWrite(reportBytes);
  return {
    reportBlobId,
    usageStatsHashHex: Buffer.from(sha256(reportBytes)).toString('hex'),
    modelOutput: perDataset,
  };
}
```

- [ ] **Step 2: `publishDataset` 改用 `sealEncryptStore`**

把 `publishDataset` 內第 2–3 步（encrypt + walrusWrite）換成：

```ts
  // 2-3. 加密 + 存 Walrus（共用純函式）
  const blobId = await sealEncryptStore(datasetId, args.data);
```

- [ ] **Step 3: `runModelWorker` 改用 `decryptTrainReport` + 補簽 settle**

把 `runModelWorker` body 換成：

```ts
  const { reportBlobId, usageStatsHashHex } = await decryptTrainReport({
    sessionKey: (await SessionKey.create({
      address: ADDRESS, packageId: PACKAGE_ID, ttlMin: 10, signer: keypair, suiClient,
    })).export(),
    ticketId: args.ticketId,
    campaignId: args.campaignId,
    datasets: args.datasets,
  });
  const { digest } = await settleCampaign({
    providerCapId: args.providerCapId,
    campaignId: args.campaignId,
    orderedDatasetIds: args.datasets.map((d) => d.datasetId),
    usageStatsHash: fromHex(usageStatsHashHex),
    reportBlobId: enc(reportBlobId),
  });
  return { reportBlobId, digest };
```

- [ ] **Step 4: typecheck**

Run: `cd backend && npx tsc --noEmit`
Expected: 無錯誤

- [ ] **Step 5: Commit**

```bash
git add backend/src/pipeline.ts
git commit -m "refactor(backend): extract keyless sealEncryptStore + decryptTrainReport"
```

---

## Task 2：後端純函式單元測試

**Files:** Create `backend/src/pipeline.test.ts`

- [ ] **Step 1: 寫測試（mock seal/walrus）**

> 註：後端目前無測試框架。用 node 內建 `node:test`（無需新依賴）。mock 用 module 替身較重；此處測 `toyModel` 與 hash 穩定性（純函式、無 IO），Seal/Walrus 整合留給既有 e2e。

```ts
import { test } from 'node:test';
import assert from 'node:assert';
import { createHash } from 'node:crypto';

// toyModel 為 pipeline 內部函式：若未 export，於此 task 先 export 它再測。
import { toyModel } from './pipeline.js';

test('toyModel 對相同輸入輸出穩定且含 rows', () => {
  const data = new TextEncoder().encode('a a b\nc a');
  const r1 = toyModel(data);
  const r2 = toyModel(data);
  assert.deepStrictEqual(r1, r2);
  assert.ok(typeof r1.rows === 'number' && r1.rows >= 1);
  assert.ok(Array.isArray(r1.topK));
});

test('sha256 報告 hash 對相同 bytes 一致', () => {
  const b = new TextEncoder().encode('{"x":1}');
  const h1 = createHash('sha256').update(b).digest('hex');
  const h2 = createHash('sha256').update(b).digest('hex');
  assert.strictEqual(h1, h2);
});
```

於 `pipeline.ts` 把 `function toyModel` 改成 `export function toyModel`。

- [ ] **Step 2: 跑測試**

Run: `cd backend && node --import tsx --test src/pipeline.test.ts`
Expected: 2 passing（若無 tsx：`npx tsx --test src/pipeline.test.ts`）

- [ ] **Step 3: Commit**

```bash
git add backend/src/pipeline.ts backend/src/pipeline.test.ts
git commit -m "test(backend): toyModel + hash determinism"
```

---

## Task 3：後端 endpoint `/encrypt` `/decrypt-train` + CORS

**Files:** Modify `backend/src/server.ts`；`cd backend && npm i cors && npm i -D @types/cors`

- [ ] **Step 1: 加 cors + 兩支 endpoint**

`server.ts` 頂部 import 改：

```ts
import cors from 'cors';
import { publishDataset, runModelWorker, sealEncryptStore, decryptTrainReport } from './pipeline.js';
```

`const app = express();` 後加：

```ts
app.use(cors({ origin: (process.env.CORS_ORIGIN ?? 'http://localhost:5173').split(',') }));
```

在 `/settle` 之後、`app.listen` 之前加：

```ts
// 純鏈下：Seal 加密 + Walrus 存。不簽鏈上。
// Body: { datasetId, dataB64 }
app.post('/encrypt', async (req, res) => {
  try {
    const { datasetId, dataB64 } = req.body ?? {};
    if (!datasetId || typeof dataB64 !== 'string') {
      return res.status(400).json({ error: 'datasetId and dataB64 required' });
    }
    const blobId = await sealEncryptStore(datasetId, new Uint8Array(Buffer.from(dataB64, 'base64')));
    res.json({ blobId });
  } catch (e) {
    res.status(500).json({ error: (e as Error).message });
  }
});

// 純鏈下：收瀏覽器簽的 SessionKey → 解密 + toy 模型 + 報告。不簽鏈上。
// Body: { sessionKey, ticketId, campaignId, datasets:[{datasetId, blobId}] }
app.post('/decrypt-train', async (req, res) => {
  try {
    const { sessionKey, ticketId, campaignId, datasets } = req.body ?? {};
    if (!sessionKey || !ticketId || !campaignId || !Array.isArray(datasets)) {
      return res.status(400).json({ error: 'sessionKey, ticketId, campaignId, datasets[] required' });
    }
    const result = await decryptTrainReport({ sessionKey, ticketId, campaignId, datasets });
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: (e as Error).message });
  }
});
```

- [ ] **Step 2: typecheck + 啟動煙霧測試**

Run: `cd backend && npx tsc --noEmit && node --import tsx src/server.ts &` 然後 `curl -s localhost:8787/health`
Expected: typecheck 過；health 回 `{ok:true,...}`。測完 `kill %1`。

- [ ] **Step 3: Commit**

```bash
git add backend/src/server.ts backend/package.json backend/package-lock.json
git commit -m "feat(backend): keyless /encrypt + /decrypt-train endpoints with CORS"
```

---

## Task 4：前端 backend client + seal helper + env

**Files:** Create `frontend/src/lib/backend.ts`, `frontend/src/lib/seal.ts`；Modify `.env.example`, `.env.local`；`cd frontend && npm i @mysten/seal`

- [ ] **Step 1: env**

`frontend/.env.example` 與 `.env.local` 各加一行：

```
VITE_BACKEND_URL=http://localhost:8787
```

- [ ] **Step 2: `frontend/src/lib/backend.ts`**

```ts
const BASE = (import.meta as any).env?.VITE_BACKEND_URL ?? 'http://localhost:8787';

async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error ?? `backend ${path} ${res.status}`);
  return json as T;
}

const toB64 = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes));

export const encryptDataset = (datasetId: string, data: Uint8Array) =>
  post<{ blobId: string }>('/encrypt', { datasetId, dataB64: toB64(data) });

export const decryptTrain = (body: {
  sessionKey: unknown;
  ticketId: string;
  campaignId: string;
  datasets: { datasetId: string; blobId: string }[];
}) => post<{ reportBlobId: string; usageStatsHashHex: string; modelOutput: Record<string, unknown> }>(
  '/decrypt-train', body,
);
```

- [ ] **Step 3: `frontend/src/lib/seal.ts`（瀏覽器簽 SessionKey，用 gRPC client）**

```ts
import { SessionKey, type ExportedSessionKey } from '@mysten/seal';
import { SuiGrpcClient } from '@mysten/sui/grpc';
import { PACKAGE_ID } from '../contracts';

const GRPC: Record<string, string> = {
  testnet: 'https://fullnode.testnet.sui.io:443',
  mainnet: 'https://fullnode.mainnet.sui.io:443',
};
const NETWORK = ((import.meta as any).env?.VITE_SUI_NETWORK ?? 'testnet') as 'testnet' | 'mainnet';

/** 建 SessionKey、用錢包簽 personal message、export 給後端。 */
export async function buildSessionKey(
  address: string,
  signPersonalMessage: (msg: Uint8Array) => Promise<string>,
): Promise<ExportedSessionKey> {
  const suiClient = new SuiGrpcClient({ network: NETWORK, baseUrl: GRPC[NETWORK] }) as any;
  const sk = await SessionKey.create({ address, packageId: PACKAGE_ID, ttlMin: 10, suiClient });
  const sig = await signPersonalMessage(sk.getPersonalMessage());
  await sk.setPersonalMessageSignature(sig);
  return sk.export();
}
```

- [ ] **Step 4: typecheck**

Run: `cd frontend && npm run typecheck`
Expected: 無錯誤（若 `@mysten/seal` 型別找不到，確認已安裝）

- [ ] **Step 5: Commit**

```bash
git add frontend/src/lib/backend.ts frontend/src/lib/seal.ts frontend/.env.example frontend/package.json frontend/package-lock.json
git commit -m "feat(frontend): backend client + browser SessionKey helper (gRPC)"
```

---

## Task 5：前端 registry 加 ticket / pending-blob 暫存

**Files:** Modify `frontend/src/lib/registry.ts`

- [ ] **Step 1: 加 helpers**

於 `registry.ts` 末尾加：

```ts
// campaignId → AccessTicket id
export function setTicket(campaignId: string, ticketId: string): void {
  localStorage.setItem(`walcoop_ticket_${campaignId}`, ticketId);
}
export function getTicket(campaignId: string): string | null {
  return localStorage.getItem(`walcoop_ticket_${campaignId}`);
}

// datasetId → 已上傳但尚未綁定的 blobId（updateBlob 失敗時可重試）
export function setPendingBlob(datasetId: string, blobId: string): void {
  localStorage.setItem(`walcoop_pendblob_${datasetId}`, blobId);
}
export function getPendingBlob(datasetId: string): string | null {
  return localStorage.getItem(`walcoop_pendblob_${datasetId}`);
}
export function clearPendingBlob(datasetId: string): void {
  localStorage.removeItem(`walcoop_pendblob_${datasetId}`);
}
```

- [ ] **Step 2: typecheck + Commit**

```bash
cd frontend && npm run typecheck
git add frontend/src/lib/registry.ts
git commit -m "feat(frontend): registry helpers for ticket + pending blob"
```

---

## Task 6：前端 Dataset 上傳真流程（register→encrypt→updateBlob）

**Files:** Modify `frontend/src/pages/Marketplace.tsx`

- [ ] **Step 1: RegisterPanel 加 textarea + file，改提交流程**

import 加：

```ts
import { encryptDataset } from '../lib/backend';
import { setPendingBlob, getPendingBlob, clearPendingBlob } from '../lib/registry';
import { dec } from '../lib/format';
```

`RegisterPanel` 內：
- 加 state：`const [content, setContent] = useState(''); const [fileBytes, setFileBytes] = useState<Uint8Array | null>(null);`
- UI 加（名稱欄位下方）：

```tsx
<div className="field">
  <label>資料內容（貼上 CSV/JSON）</label>
  <textarea className="textarea" rows={4} value={content}
    onChange={(e) => setContent(e.target.value)} placeholder="col_a,col_b&#10;1,2" />
</div>
<div className="field">
  <label>或上傳檔案</label>
  <input type="file" accept=".csv,.json,.txt"
    onChange={async (e) => {
      const f = e.target.files?.[0];
      setFileBytes(f ? new Uint8Array(await f.arrayBuffer()) : null);
    }} />
</div>
```

- 把 `submit` 換成真流程：

```ts
const submit = async () => {
  setBusy(true);
  try {
    const data = fileBytes ?? new TextEncoder().encode(content);
    if (data.length === 0) throw new Error('請輸入資料內容或上傳檔案');
    if (data.length > 9_000_000) throw new Error('資料過大（上限 ~9MB）');

    // 1. 鏈上註冊 placeholder → 取 datasetId（Shared）
    const { createdDetailed } = await exec((tx) =>
      client.registerDataset(tx, {
        blobId: enc('pending'),
        sealInnerId: enc('pending'),
        schemaUri: enc(`schema:${name}`),
        name,
        pricingModel: PricingModel.PerUse,
        unitPrice: BigInt(Math.round(Number(unitPrice) * 1e9)),
        revShareBps: Math.round(Number(revShare) * 100),
      }),
    );
    const datasetId = createdDetailed.find((o) => o.owner === 'Shared')?.id;
    if (!datasetId) throw new Error('找不到新建 dataset id');
    addIds('dataset', [datasetId]);

    // 2. 後端 Seal 加密 + Walrus 存
    const { blobId } = await encryptDataset(datasetId, data);
    setPendingBlob(datasetId, blobId);

    // 3. 鏈上綁定真 blob
    await exec((tx) => client.updateBlob(tx, datasetId,
      enc(blobId), fromHex(datasetId.replace(/^0x/, ''))));
    clearPendingBlob(datasetId);

    await invalidate('datasets');
    setTimeout(() => { invalidate('datasets'); }, 1500);
    toast.push('資料已加密上鏈（Seal + Walrus）');
    setName(''); setContent(''); setFileBytes(null);
  } catch (e) {
    toast.push((e as Error).message, 'error');
  } finally {
    setBusy(false);
  }
};
```

import 補 `fromHex`：`import { fromHex } from '@mysten/sui/utils';`

- [ ] **Step 2: 加「重試綁定」按鈕（updateBlob 失敗時）**

DatasetCard 內，當 `getPendingBlob(ds.id)` 有值且 `dec(ds.blobId)==='pending'` 時顯示按鈕：

```tsx
{getPendingBlob(ds.id) && (
  <button className="btn btn-secondary btn-sm" onClick={async () => {
    const blobId = getPendingBlob(ds.id)!;
    try {
      await exec((tx) => client.updateBlob(tx, ds.id, enc(blobId), fromHex(ds.id.replace(/^0x/, ''))));
      clearPendingBlob(ds.id);
      toast.push('已重新綁定 blob');
    } catch (e) { toast.push((e as Error).message, 'error'); }
  }}>重試綁定 Walrus blob</button>
)}
```

> DatasetCard 需能存取 `exec`/`client`/`toast`：把這些由 Marketplace 透過 prop 傳入，或把重試按鈕做成獨立子元件包含自己的 hooks。實作時選後者（`<RetryBindButton ds={ds} />`）避免 prop 鑽孔。

- [ ] **Step 3: typecheck + Commit**

```bash
cd frontend && npm run typecheck
git add frontend/src/pages/Marketplace.tsx
git commit -m "feat(frontend): real dataset upload via Seal+Walrus (register→encrypt→updateBlob)"
```

---

## Task 7：前端 fund 捕捉 ticketId

**Files:** Modify `frontend/src/pages/Campaigns.tsx`

- [ ] **Step 1: fundAndAuthorize 後存 ticketId**

import 加 `import { setTicket } from '../lib/registry';`

`fundAndAuthorize` 改：

```ts
const fundAndAuthorize = () =>
  run(async () => {
    const { createdDetailed } = await exec((tx) => {
      client.fundCampaign(tx, { campaignId: c.id, amount: suiToMist(amount) });
      client.issueAccessTicket(tx, { campaignId: c.id, expiryMs: BigInt(Date.now() + 7 * 86400_000) });
    });
    const ticketId = createdDetailed.find((o) => o.owner === 'Address')?.id;
    if (ticketId) setTicket(c.id, ticketId);
    toast.push('已付款並核發使用授權');
  });
```

> 註：`run` 目前不回傳 exec 結果；本 step 直接在 callback 內 await exec，不依賴 run 的回傳。

- [ ] **Step 2: typecheck + Commit**

```bash
cd frontend && npm run typecheck
git add frontend/src/pages/Campaigns.tsx
git commit -m "feat(frontend): capture AccessTicket id on fund"
```

---

## Task 8：前端 settle 走真實解密流程

**Files:** Modify `frontend/src/pages/Campaigns.tsx`

- [ ] **Step 1: import + hook**

```ts
import { useSignPersonalMessage } from '@mysten/dapp-kit-react';
import { fromHex } from '@mysten/sui/utils';
import { buildSessionKey } from '../lib/seal';
import { decryptTrain } from '../lib/backend';
import { getTicket } from '../lib/registry';
import { useDatasets } from '../hooks/useDataCoop';
import { dec } from '../lib/format';
```

`CampaignCard` 內加：`const { mutateAsync: signPm } = useSignPersonalMessage(); const { data: datasets } = useDatasets();`
state 加：`const [modelOut, setModelOut] = useState<Record<string, unknown> | null>(null);`

- [ ] **Step 2: 改寫 settle**

```ts
const settle = () =>
  run(async () => {
    const ticketId = getTicket(c.id);
    if (!ticketId) throw new Error('找不到此方案的 AccessTicket（請先付款並授權）');
    if (!account?.address) throw new Error('請先連接錢包');

    // 對應 campaign 的 dataset blobId（從已讀到的 datasets 取）
    const dsList = c.datasetIds.map((id) => {
      const d = (datasets ?? []).find((x) => x.id === id);
      const blobId = d ? dec(d.blobId) : '';
      if (!blobId || blobId === 'pending') throw new Error(`dataset ${id} 尚未綁定 Walrus blob`);
      return { datasetId: id, blobId };
    });

    // 1. 瀏覽器簽 SessionKey
    const sessionKey = await buildSessionKey(account.address, async (msg) => {
      const { signature } = await signPm({ message: msg });
      return signature;
    });

    // 2. 後端解密 + 跑模型
    const { reportBlobId, usageStatsHashHex, modelOutput } = await decryptTrain({
      sessionKey, ticketId, campaignId: c.id, datasets: dsList,
    });
    setModelOut(modelOutput);

    // 3. 錢包簽 settle（真報告 + 真 hash）
    const { createdDetailed } = await exec((tx) =>
      client.settleCampaign(tx, {
        providerCapId: capId,
        campaignId: c.id,
        orderedDatasetIds: c.datasetIds,
        usageStatsHash: fromHex(usageStatsHashHex),
        reportBlobId: enc(reportBlobId),
      }),
    );
    setUsageId(createdDetailed.find((o) => o.owner === 'Immutable')?.id ?? '');
    setPayoutIds(createdDetailed.filter((o) => o.owner === 'Address').map((o) => o.id));
    toast.push('解密成功、模型已跑、分潤已上鏈');
  });
```

- [ ] **Step 3: UI 顯示模型輸出**

在 usageId 區塊上方加：

```tsx
{modelOut && (
  <div className="panel mt-m" style={{ background: 'var(--bg-700)' }}>
    <div className="meta">模型輸出（Seal 解密後）</div>
    <pre className="mono" style={{ fontSize: 11, whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
      {JSON.stringify(modelOut, null, 2)}
    </pre>
  </div>
)}
```

- [ ] **Step 4: typecheck + Commit**

```bash
cd frontend && npm run typecheck
git add frontend/src/pages/Campaigns.tsx
git commit -m "feat(frontend): real settle via browser SessionKey → backend decrypt-train"
```

---

## Task 9：整合驗證 + Monkey test

**Files:** 無（手動 e2e，依專案 test 規則）

- [ ] **Step 1: 啟動**

```bash
cd backend && node --import tsx src/server.ts &   # :8787
cd frontend && npm run dev                          # :5173
```

- [ ] **Step 2: 全鏈路 happy path**

供應者上傳（textarea 一次、檔案一次）→ 確認 dataset 顯示且 blobId 非 pending（DevTools 看 `/encrypt` 回應）→ grant → 建方案 → 付款（確認 localStorage 有 `walcoop_ticket_<campaignId>`）→ 切服務商結算 → **確認跳出錢包簽 personal message** → 模型輸出顯示 → settle 成功 → 查看分潤。

- [ ] **Step 3: Monkey test（負向，證明 gating）**

1. 空資料上傳 → 應擋（前端錯誤）。
2. 超大檔（>9MB）→ 應擋。
3. **竄改 ticket**：在 console `localStorage.setItem('walcoop_ticket_<cid>','0x'+'0'.repeat(64))` 後結算 → **Seal 解密應被 `seal_approve` 拒絕**，UI 顯示「鏈上未授權，無法解密」（驗證 §5 金句）。
4. 後端關閉後結算 → toast 提示 backend 錯誤、畫面不卡死。

- [ ] **Step 4: 記錄結果到 progress.md，commit（若有微調）**

---

## Self-review note

- Spec §2/§3/§5/§6 全有對應 task（1–3 後端、4–8 前端、9 測試）。
- §4 依賴：`@mysten/seal`（Task 4）、`cors`（Task 3）、`VITE_BACKEND_URL`（Task 4）。
- §7 GTM、§8 風險為記錄性，不在本計畫實作；SessionKey 用 `SuiGrpcClient`（Task 4 seal.ts）對齊 review 要求。
- 型別一致：`createdDetailed`（Task 7/8 用，來自先前 useExecute 已實作的 `{id,owner}[]`）、`OwnerKind` 值 `'Shared'|'Address'|'Immutable'` 一致。
- ⚠️ 風險點（執行時驗）：`SessionKey.create({suiClient: SuiGrpcClient})` 相容性；不相容則改傳 `@mysten/sui/client` 的 client。
