# Sui Retail Data Coop — 系統架構規格書

| | |
|---|---|
| **版本** | v1.0 (2026-06-06) |
| **狀態** | 架構定案，準備進入開發 |
| **來源** | `BUSINESS_SPEC.md` |
| **目標網路** | Sui Testnet (Protocol 124, v1.72.2) → Mainnet |
| **核心決策** | Shared `Dataset` object / Seal threshold 加密 / 泛型 `Coin<T>` 付款 / capability-gated settle |

---

## 1. Executive Summary

Sui Retail Data Coop 是一個零售 × 品牌的可驗證 AI 資料聯盟。零售商把匿名化資料以 **Seal 加密**後存入 **Walrus**，在 **Sui** 上鑄造代表資料所有權的 `Dataset` 物件；品牌建立 `Campaign` 用泛型 `Coin<T>`（SUI / USDC）付款，合約簽發 `AccessTicket`；模型服務商憑 ticket 通過 Seal 的鏈上策略解密讀取資料，訓練後產生報表寫回 Walrus，由 capability 持有者觸發 `settle_campaign` 自動分潤。

**為什麼非 Walrus + Sui 不可（密碼學事實，非行銷話術）**：dataset 以 Seal threshold IBE 加密後存 Walrus，解密 key 的下發由一段 **`seal_approve` Move 函式**裁決——它直接讀 `AccessTicket` 的 `expiry` 與授權範圍。平台端**無法繞過合約**發 key。授權、分潤、access 強制是同一份合約的不同入口。

---

## 2. Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                       Web dApp (前端)                          │
│   Retailer 儀表板 │ Brand 市集/Campaign │ Provider 工作台      │
│            @mysten/dapp-kit + @mysten/seal (SessionKey)        │
└───────────────┬───────────────────────────┬──────────────────┘
                │ REST/GraphQL              │ wallet sign
                ▼                            ▼
┌──────────────────────────────┐   ┌────────────────────────────┐
│   Off-chain Backend (BFF)     │   │      Sui Move 合約          │
│  • Dataset Pipeline           │   │  data_coop::dataset         │
│  • Model Worker (Seal decrypt)│   │  data_coop::campaign        │
│  • Settlement Job (cron)      │   │  data_coop::access (seal)   │
│  • Seal key-server client      │   │  data_coop::settlement      │
└──────┬─────────────┬──────────┘   └──────────────┬─────────────┘
       │ Tatum       │ Walrus SDK                  │ events
       │ Sui RPC     │ writeBlob/readBlob          │
       ▼             ▼                             ▼
┌──────────────┐  ┌──────────────┐         ┌──────────────────┐
│  Tatum Sui   │  │   Walrus     │◀────────│  Seal Key Servers │
│  RPC/Storage │  │ (加密 blob)   │  policy │  (threshold IBE)  │
└──────────────┘  └──────────────┘         └──────────────────┘
```

依賴方向：前端 → BFF → (Tatum RPC | Walrus SDK | Seal)；合約不依賴鏈下，鏈下透過事件與 RPC 觀測合約。詳見 `docs/architecture/module-dependency.mmd`、`data-flow.mmd`。

---

## 3. Module Design (Move)

套件名 `data_coop`，四個模組 + 一個 capability 模組：

| 模組 | 職責 | 關鍵物件 |
|------|------|----------|
| `dataset` | 註冊/更新 dataset，管理所有權與定價 | `Dataset` (shared) |
| `campaign` | 建立、注資、生命週期 | `Campaign` (shared), `AccessTicket` (owned) |
| `access` | Seal 策略入口 `seal_approve` | （無狀態，讀 ticket） |
| `settlement` | 結算、分潤、使用紀錄 | `UsageRecord` (owned by provider/registry) |
| `acl` | capability 定義 | `PublisherCap`, `ProviderCap` |

模組依賴：`settlement → campaign → dataset`；`access → campaign`（讀 ticket）；`acl` 被全體引用。無循環依賴。

---

## 4. Data Models

### 4.1 Dataset（shared object）

```move
public struct Dataset has key {
    id: UID,
    owner: address,                 // 分潤收款人
    blob_id: vector<u8>,            // Walrus blob id（密文）
    seal_inner_id: vector<u8>,     // Seal identity 的 inner id
    schema_uri: vector<u8>,        // 欄位描述 blob（明文 manifest）
    pricing: Pricing,
    rev_share_bps: u16,            // 此 dataset 在多方組合中的權重（基點）
    listed: bool,
    version: u64,                  // 每次 update 遞增，對應 blob 版本
}

public struct Pricing has store, copy, drop {
    model: u8,        // 0=per_use 固定 / 1=per_training_hour / 2=per_volume
    unit_price: u64,  // 以付款幣最小單位計
}
```

> **shared 理由**：Brand 在 `create_campaign` 需直接引用多家零售商的 dataset 做市集組合，shared object 允許任意買方讀取與引用，寫操作（上下架/改價）走 consensus 但頻率低。

### 4.2 Campaign（shared object）+ AccessTicket（owned）

```move
public struct Campaign<phantom T> has key {
    id: UID,
    buyer: address,
    model_provider: address,
    dataset_ids: vector<ID>,
    budget: Balance<T>,            // 鎖定的預算
    rev_weights: vector<u16>,      // 與 dataset_ids 對齊的分潤權重快照
    status: u8,                    // 0=Pending 1=Active 2=Settled 3=Cancelled
    created_at_ms: u64,
}

public struct AccessTicket has key {
    id: UID,
    campaign_id: ID,
    dataset_ids: vector<ID>,
    provider: address,            // 僅此 provider 可用於 Seal 解密
    expiry_ms: u64,
}
```

> `Campaign` 泛型化 `<T>` 讓同一套合約支援 SUI 與 USDC；`budget` 用 `Balance<T>` 內部持有，避免 `Coin` 在 shared object 中的所有權問題。

### 4.3 UsageRecord（owned，結算憑證）

```move
public struct UsageRecord has key, store {
    id: UID,
    campaign_id: ID,
    dataset_ids: vector<ID>,
    usage_stats_hash: vector<u8>, // 報表內容 hash，供應者可重算驗證
    report_blob_id: vector<u8>,   // Walrus 報表 blob
    settled_amounts: vector<u64>, // 與 dataset_ids 對齊
    settled_at_ms: u64,
}
```

### 4.4 Capabilities

```move
public struct PublisherCap has key, store { id: UID }   // 發行 dataset 權（可選，MVP 可開放）
public struct ProviderCap has key, store {              // 結算權，發給 model_provider
    id: UID,
    provider: address,
}
```

---

## 5. Core Functions (API Spec)

```move
// dataset 模組
public fun register_dataset<T>(
    blob_id, seal_inner_id, schema_uri, pricing: Pricing,
    rev_share_bps: u16, ctx
): /* shares Dataset, emits DatasetRegistered */

public fun update_dataset_meta(ds: &mut Dataset, new_blob_id, new_version, ctx)
    // assert ctx.sender == ds.owner

// campaign 模組
public fun create_campaign<T>(
    dataset_ids: vector<ID>, model_provider: address, clock, ctx
): /* shares Campaign<T> status=Pending */

public fun fund_campaign<T>(c: &mut Campaign<T>, payment: Coin<T>, ctx)
    // assert sender == buyer; budget.join(payment.into_balance); status=Active

public fun issue_access_ticket<T>(
    c: &Campaign<T>, expiry_ms: u64, clock, ctx
): AccessTicket
    // assert status==Active; transfer ticket to c.model_provider

// access 模組（Seal 入口）
entry fun seal_approve(
    id: vector<u8>, ticket: &AccessTicket, clock: &Clock, ctx: &TxContext
)
    // 見 §6

// settlement 模組
public fun settle_campaign<T>(
    cap: &ProviderCap, c: &mut Campaign<T>,
    usage_stats_hash, report_blob_id,
    datasets: vector<&Dataset>, clock, ctx
): /* 拆 budget 給各 owner, status=Settled, emit Settled, mint UsageRecord */
```

---

## 6. Seal 存取控制（命門設計）

dataset 明文先以 Seal `Aes256Gcm` 加密，密文存 Walrus。Identity = `[package_id][seal_inner_id]`。解密時前端/後端構造一筆呼叫 `seal_approve` 的交易，key server 驗證通過才下發 share。

```move
module data_coop::access;

const ENoAccess: u64 = 1;
const EExpired:  u64 = 2;
const EWrongProvider: u64 = 3;

/// Seal 傳入 inner id（= 某 dataset 的 seal_inner_id），
/// 我們用 AccessTicket 證明呼叫者有權限。
entry fun seal_approve(
    id: vector<u8>,
    ticket: &AccessTicket,
    clock: &Clock,
    ctx: &TxContext,
) {
    // 1. 呼叫者必須是 ticket 指定的 provider
    assert!(tx_context::sender(ctx) == ticket.provider, EWrongProvider);
    // 2. ticket 未過期
    assert!(clock::timestamp_ms(clock) < ticket.expiry_ms, EExpired);
    // 3. id 對應的 dataset 必須在 ticket 授權範圍內
    assert!(ticket_covers(ticket, id), ENoAccess);
}
```

**TS 解密流程（Model Worker）**：

```typescript
const sessionKey = await SessionKey.create({ address, packageId, ttlMin: 10, suiClient });
// provider 簽 personal message 初始化 sessionKey
const tx = new Transaction();
tx.moveCall({ target: `${pkg}::access::seal_approve`,
  arguments: [tx.pure.vector('u8', innerId), tx.object(ticketId), tx.object(CLOCK)] });
const txBytes = await tx.build({ client: suiClient, onlyTransactionKind: true });
const plaintext = await sealClient.decrypt({ data: encryptedBytes, sessionKey, txBytes });
```

> **「非平台可繞過」證明**：key server 只認 `seal_approve` 的鏈上裁決。後端即使想偷發 key 也拿不到 threshold 個 share。這是 pitch 的核心 punchline。

---

## 7. Event System

```move
public struct DatasetRegistered has copy, drop { dataset_id: ID, owner: address, version: u64 }
public struct CampaignCreated  has copy, drop { campaign_id: ID, buyer: address, n_datasets: u64 }
public struct CampaignFunded   has copy, drop { campaign_id: ID, amount: u64 }
public struct AccessTicketIssued has copy, drop { campaign_id: ID, provider: address, expiry_ms: u64 }
public struct CampaignSettled  has copy, drop { campaign_id: ID, report_blob_id: vector<u8>, total: u64 }
```

鏈下 Settlement Job 透過 Tatum Sui RPC 訂閱/輪詢這些事件驅動狀態機（見 §10）。

---

## 8. Error Handling

| Code | 常數 | 觸發 |
|------|------|------|
| 1 | `ENoAccess` | dataset 不在 ticket 授權內 |
| 2 | `EExpired` | ticket 過期 |
| 3 | `EWrongProvider` | 非授權 provider 解密 |
| 10 | `ENotOwner` | 非 owner 改 dataset |
| 11 | `ENotBuyer` | 非 buyer 注資 |
| 12 | `ECampaignNotActive` | 狀態不符 |
| 13 | `EAlreadySettled` | 重複結算 |
| 14 | `EWeightMismatch` | rev_weights 與 dataset_ids 長度不符 |
| 15 | `EInsufficientBudget` | 預算不足以結算 |

---

## 9. Security Considerations

詳見 `docs/security/threat-model.md`。摘要：

- **金流**：`budget` 用 `Balance<T>` 鎖在 Campaign，`settle_campaign` 需 `ProviderCap` + 驗證 `datasets` 引用與 `dataset_ids` 一致，分潤用整數最小單位、餘額歸 buyer，Move 內建 overflow 保護。
- **Access**：Seal threshold（如 2-of-3）即使單一 key server 被攻破也不洩密；`seal_approve` 三重檢查（provider / expiry / scope）。
- **DoS**：過期未結算 Campaign 由 `cancel_campaign` 讓 buyer 取回 `budget`。
- **資料造假**：`usage_stats_hash` 上鏈，供應者可下載 Walrus 報表重算比對。

---

## 10. Off-chain 服務與資料層

| 服務 | 技術 | 職責 |
|------|------|------|
| BFF / API Gateway | Node + GraphQL | 封裝 Tatum RPC / Walrus SDK / Seal |
| Dataset Pipeline | Walrus SDK + Seal | 接檔 → Seal 加密 → `writeBlob` → `register_dataset` |
| Model Worker | Seal decrypt + toy model | 憑 `AccessTicket` 解密讀 blob → 訓練 → 報表上 Walrus → `settle_campaign` |
| Settlement Job | Tatum RPC event poll | 監控 Campaign 狀態，逾期 cancel |

**資料存取策略**（Protocol 124）：當前狀態查詢用 **gRPC**（GA）；前端列表/篩選用 **GraphQL**（beta）；歷史分潤分析/聚合走自建 **indexer**（見 `sui-indexer`）。JSON-RPC 已 deprecated（2026-04 移除），Tatum 端確認走 gRPC/GraphQL。

**Walrus SDK 關鍵呼叫**：
```typescript
const { blobId } = await client.walrus.writeBlob({ blob: encrypted, deletable: false, epochs: N, signer });
const bytes = await client.walrus.readBlob({ blobId });
```

---

## 11. Testing Strategy

| 層級 | 範圍 |
|------|------|
| Move 單元測試 | 各 entry function 正常路徑 + 每個 error code（`#[expected_failure]`） |
| Move 情境測試 | 完整 Flow A→B→C 在 `test_scenario` 下跑通，含多 dataset 分潤 |
| Monkey/極端測試 | 0 預算、過期 ticket、重複 settle、權重溢位、單一 dataset 佔 100% bps、空 dataset_ids |
| 整合測試 (TS) | Seal 加解密往返、Walrus write/read 往返、Tatum RPC 送交易 |
| E2E | 前端 → 後端 → 鏈 → Walrus 一條龍 demo |

紅隊向量（核心金流）：access control bypass（偽 ticket）、settle 偽造 hash、integer overflow（bps 加總 ≠ 10000）、過期預算鎖死、Seal session 重放。

---

## 12. Deployment Plan

1. `sui move build` → `sui move test` 全綠。
2. Testnet `publish`，保留 `UpgradeCap`（Phase 0/1 需可升級）。
3. 部署/設定 Seal key servers（testnet 用官方測試 key server）。
4. 設定 Tatum Sui RPC endpoint（gRPC）、Walrus testnet publisher。
5. 前端接 `packageId` / Seal `packageId` / key server ids。
6. Mainnet：升級流程走 `sui-deployer`，UpgradeCap 治理待定。

---

## 13. Gas Optimization

- `Campaign` 的 `dataset_ids`/`rev_weights` 用 `vector` 而非動態 field，結算一次讀完。
- `settle_campaign` 批次分潤，避免每 dataset 一筆交易。
- Dataset manifest（明文 schema）存 Walrus，鏈上只放 `schema_uri`，減少 object size。
- 事件取代鏈上歷史查詢，分析交給 indexer。

---

## Appendix

- **SDK**：`@mysten/sui`（`Transaction` 非 `TransactionBlock`）、`@mysten/seal`、`@mysten/walrus`、`@mysten/dapp-kit`。
- **版本**：Sui Testnet v1.72.2 / Protocol 124；Walrus testnet-v1.43.1；Seal `/mystenlabs/seal`。
- **下一步**：以 `sui-developer` 實作合約，`sui-tester` 補測試。建議開發順序：`acl` → `dataset` → `campaign` → `access` → `settlement`。
```

