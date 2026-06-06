# 前後端 Pipeline 接通 — 設計書

> 日期：2026-06-07
> 狀態：設計確認，待寫實作計畫
> 目標：讓「資料真的被加密上 Walrus、被 Seal 解密、解密被鏈上 `seal_approve` 放行、模型跑出結果」在前端可操作可見，而非只簽鏈上交易。
> 架構決策：**生產正確（前端錢包簽鏈上、後端無金鑰鏈下算力）**，本版用「方向 1（附加新 endpoint）」落地，GTM 收斂到「方向 2（後端零簽署）」。

---

## 1. 架構原則

- **前端錢包簽署所有鏈上交易**（register / updateBlob / grant / create / fund+issueTicket / settle）。
- **後端 = 無金鑰的 Seal / Walrus 鏈下算力**。新增 endpoint 不持私鑰、不簽任何鏈上交易。
- 舊的 `POST /datasets`、`POST /settle`（持 `SUI_PRIVATE_KEY` 會簽）**本版保留**給 CLI / e2e 回歸測試，**標記 GTM 前必須移除**（見 §7）。
- 信任邊界：瀏覽器簽的 Seal `SessionKey` 是有 TTL 的限期通行證；後端拿它只能在期限內解密「被 `seal_approve` 放行」的 dataset，**簽不了任何轉帳/結算**。

---

## 2. 後端新增 endpoint（皆不簽鏈上、啟用 CORS）

### `POST /encrypt`
- Body：`{ datasetId: string, dataB64: string }`
- 動作：`sealClient.encrypt({ threshold, packageId, id: datasetId, data })` → `walrusWrite(encryptedObject)`
- 回傳：`{ blobId: string }`
- 不簽鏈上。

### `POST /decrypt-train`
- Body：`{ sessionKey: ExportedSessionKey, ticketId: string, campaignId: string, datasets: { datasetId: string, blobId: string }[] }`
- 動作（逐 dataset）：`buildSealApproveTxBytes(datasetId, ticketId)` → `walrusClient.readBlob({ blobId })` → `SessionKey.import(sessionKey, suiClient)` → `sealClient.decrypt({ data, sessionKey, txBytes })` → `toyModel(plaintext)`；彙整報告 → `walrusWrite(report)`
- 回傳：`{ reportBlobId: string, usageStatsHashHex: string, modelOutput: object }`
- 不簽鏈上（移除 `runModelWorker` 內的 `settleCampaign` 呼叫；settle 由前端錢包簽）。

### 重構
把 `publishDataset` / `runModelWorker` 的**鏈下部分**抽成共用純函式，新舊 endpoint 共用、避免邏輯重複：
- `sealEncryptStore(datasetId, data) → blobId`
- `decryptTrainReport(sessionKey, ticketId, datasets) → { reportBlobId, usageStatsHash, modelOutput }`

舊 `publishDataset` / `runModelWorker` 改為「呼叫共用函式 + 用後端 keypair 補簽」，維持 e2e 行為不變。

### CORS
`cors` middleware，允許前端 origin（dev：`http://localhost:5173`）。

---

## 3. 前端流程改動

### (a) Dataset 上傳（`pages/Marketplace.tsx`，角色＝供應者）
UI 新增：textarea（貼 CSV/JSON 文字）**＋** 檔案上傳（讀 bytes）雙通道。
提交流程：
1. 錢包簽 `registerDataset`(placeholder blob) → 從 `createdDetailed` 取 `datasetId`（owner = Shared）
2. `POST /encrypt { datasetId, data }` → `blobId`
3. 錢包簽 `updateBlob(datasetId, blobId_bytes, sealInnerId = datasetId bytes)`
4. `addIds('dataset', ...)` + invalidate

### (b) 付款步驟 — 捕捉 AccessTicket id（`pages/Campaigns.tsx`）
fund tx（`fundCampaign` + `issueAccessTicket`）的 `createdDetailed` 取 AccessTicket（owner = Address）→ 存 localStorage（key 綁 campaignId）。settle 需要它。

### (c) 結算（角色＝服務商）— 真的用資料
1. 瀏覽器：`SessionKey.create({ address, packageId, ttlMin: 10, suiClient })` → `getPersonalMessage()` → dapp-kit `useSignPersonalMessage` 簽 → `setPersonalMessageSignature(sig)` → `export()`
2. `POST /decrypt-train { sessionKey, ticketId, campaignId, datasets:[{datasetId, blobId}] }` → `{ reportBlobId, usageStatsHash, modelOutput }`
   - dataset 的 blobId 來自前端已讀到的 `Dataset.blobId`
3. 錢包簽 `settleCampaign`(真 `reportBlobId` + 真 `usageStatsHash`，取代目前 placeholder)
4. UI 顯示模型輸出 + reportBlobId；保留「查看分潤明細 →」跳轉

> **SUI best-practice（架構 review）**：步驟 1 的 `SessionKey.create({ suiClient })` 與後端 `buildSealApproveTxBytes` 一律用 **`SuiGrpcClient`（GA）**，不可接 Tatum JSON-RPC（已棄用，見 §7）。

---

## 4. 新依賴與設定

- 前端新增 `@mysten/seal`（僅用 `SessionKey`）；dapp-kit `useSignPersonalMessage`
- 前端 env `VITE_BACKEND_URL`（預設 `http://localhost:8787`）
- 後端 `cors` middleware

---

## 5. 錯誤處理（demo 重點）

- **Seal 解密被 `seal_approve` 拒絕** → UI 明確顯示「鏈上未授權，無法解密」。這是證明存取控制在鏈上生效的關鍵畫面（評審金句）。
- 後端離線 / CORS 失敗 → toast 提示，不讓畫面卡死。
- 檔案大小限制（後端 `express.json` 10mb；過大前端先擋）。
- Walrus 讀寫已有 retry（沿用）。
- **encrypt→updateBlob 原子性**：register→`/encrypt`→`updateBlob` 跨「鏈上+鏈下+鏈上」三段。若 `/encrypt` 成功但 `updateBlob` 被拒簽/失敗 → dataset 卡 placeholder、Walrus 留孤兒 blob。處理：暫存 `{datasetId, blobId}`，UI 提供「重試綁定」只重送 `updateBlob`，**不重新加密上傳**（避免重複寫 Walrus）。

---

## 6. 測試

- 後端：`/encrypt`、`/decrypt-train` 單元測試（mock Seal/Walrus）；保留並跑既有 e2e 回歸。
- 前端：手動 e2e 全鏈路 + Monkey test：空資料、超大檔、**用錯的 ticket → 解密應被拒**（負向測試證明 gating）。

---

## 7. GTM 終態方向（下一版大改，本次只記錄）

> **本版是 hackathon 可跑版；GTM 必須收斂成以下終態。判準：「對外 API 被打爆，攻擊者能不能簽出一筆交易？」答案必須是「不能」。**

| 項目 | 本版（hackathon） | GTM 終態 |
|---|---|---|
| **READ 路徑協定（首要）** | Tatum **JSON-RPC**（`sui_getObject` / `suix_getOwnedObjects`） | **遷移到 gRPC**。風險 **high**：JSON-RPC 已 deprecated、Quorum Driver 已停、官方計畫 2026/4 移除。修法橫跨前後端（`lib/tatum.ts`/`chain.ts` 的讀取改 gRPC equivalents） |
| 後端簽署 endpoint | 保留舊 `/datasets`、`/settle`（持熱私鑰） | **刪除**；請求路徑上不存在任何可簽交易的熱私鑰（= 方向 2） |
| 平台 admin 簽署（核發 ProviderCap） | deployer 熱 key 簽 | **multisig / KMS**，不可熱簽 |
| Tatum API key | 打包進前端 bundle | **後端 proxy**，key 不外洩 |
| UpgradeCap | deployer 單簽 | 轉 **multisig** |
| Seal key servers | Mysten testnet open-mode | mainnet 正式 key server set + 重評 threshold 策略 |
| Walrus blob 壽命 | `WALRUS_EPOCHS=3` | 付費續存 + 過期監控，否則資料消失 |
| CLI / e2e 簽署 | 後端 keypair | 改用本地 dev key / 測試錢包，不共用生產後端 |

**遷移路徑**：本版（方向 1，附加新 endpoint + 前端切換）→ 驗證 → 刪除舊簽署 endpoint（方向 2 後半）+ 上述 GTM 項目。「先加後刪」確保不破壞已驗證流程。

---

## 8. 風險

- `SessionKey.create` 的 `suiClient: SealCompatibleClient` 是否相容 dapp-kit gRPC client → 實作時先驗證，必要時改用 `@mysten/sui` client 建立。
- `@mysten/seal` 進前端 bundle 的體積（評估可接受）。
- SessionKey TTL（10 min）足夠單次操作；逾時需重簽。

---

## 9. 不做（YAGNI）

- 多 dataset 組合分潤的進階定價（Phase 2）。
- 真實（非 toy）模型訓練——本版維持 `toy-topk-v0`，但流程已是真 Seal 解密的真實資料。
- 前端直接整合 Walrus 讀寫（一律經後端，符合接通目標）。
