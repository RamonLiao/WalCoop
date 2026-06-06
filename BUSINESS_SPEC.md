# Sui Retail Data Coop — 商業規格書（正式版 v1.0）

> 一句話定位：**把零售業的「第一方數據合作（first-party data partnership）」做成一個可驗證的資料聯盟——讓品牌安心用這些資料訓練 AI，又讓資料擁有者拿到透明、自動的分潤。**
>
> 技術底座：**Sui（結算與授權邏輯）+ Walrus（可驗證資料層）+ Tatum（RPC / Storage API 接入）**。
>
> 文件範圍：本規格書以 hackathon → PoC → 商業實驗的路線撰寫，可直接作為 pitch deck / README / 技術藍圖的母本。

---

## 0. 文件導讀

| 章節 | 內容 | 讀者 |
|------|------|------|
| 1 | 為什麼非 Walrus + Sui 不可（value proposition） | 評審 / 投資人 |
| 2 | 市場機會與垂直選擇 | 評審 / BD |
| 3 | 產品定位與角色 | 全體 |
| 4 | 使用流程（User Flow） | PM / 工程 |
| 5 | 功能規格（on-chain / off-chain / 前端） | 工程 |
| 6 | 商業模式與單位經濟 | 商務 / 財務 |
| 7 | 非功能需求 | 工程 / 法務 |
| 8 | 所需資源（人力與技術） | PM |
| 9 | Product Roadmap | 全體 |
| 10 | 延伸產品線（同平台的其他 Walrus 殺手級用法） | 策略 |
| 11 | 風險與緩解 | 評審 / 法務 |
| 附錄 | 資料 schema、API 端點、引用來源 | 工程 |

---

## 1. 核心價值主張：為什麼「非 Walrus + Sui 不可」

這是整個 pitch 的命門。所有功能都從這裡推導。

### 1.1 Walrus 真正的超能力（不是「便宜的 S3」）

| 能力 | 傳統 web2（S3 / cloud） | Walrus + Sui |
|------|------------------------|--------------|
| **資料可驗證 + 可程式化** | 只能相信雲端服務商口頭承諾「資料還在、沒被改」 | blob 的可用性 / 完整性以加密證明掛在 Sui 上，合約可直接判斷「這份資料是否存在、是否完整」 |
| **資料即一級資產** | 檔案就是檔案，access control 在平台手裡 | blob 對應一個 Sui object，可被轉移、拆分、組合；合約可用這些 object 做 access control 與計費邏輯（storage as a first-class asset） |
| **可預測的去中心化成本** | 單價低但無可驗證性、平台可改可刪 | 約 **0.023 USD/GB/月**，去掉 token 價格波動後可算長期成本，單價接近雲端卻多了去中心化與可驗證性 |
| **版本與不可篡改** | log 可被平台事後改寫、重算報表 | 每個 snapshot 的 blob-id + hash 上鏈，技術上禁止事後造假 |

> **設計原則**：不要把 Walrus 當硬碟。要讓「沒有 Walrus + 鏈上邏輯就做不到 / 做不好」這件事在每個功能上都非常明顯。

### 1.2 本產品的「非 Walrus 不行」之處

1. **分潤邏輯必須依賴「可被合約理解的資料可用性與版本」**，而不是相信中心化資料庫的紀錄。誰貢獻了什麼資料、何時被誰用過，必須鏈上有完整、不可竄改的紀錄。
2. **dataset 體積大（GB～TB 級）**，用一般鏈上儲存不可能；用單一雲服務又沒有去中心化證明。這正好是 Walrus 雙方折衷的位置——大檔案、長期保存、可驗證的可用性。
3. **「使用憑證」必須是可程式化資產**：模型方買的是「使用權」（一個 Sui object）而非 raw data 下載權，憑證可設定到期、可被合約驗證、可在不同 dapp 間組合。

### 1.3 對外一句話 Pitch

> 「我們把零售『一方數據合作』做成一個可驗證的資料聯盟，讓品牌安心訓練 AI，又讓資料擁有者得到透明的分潤。我們不是拿 Walrus 當硬碟，我們是用 Walrus 的『可驗證 + 可程式化資料層』來解決零售數據合作的信任問題。」

---

## 2. 市場機會與垂直選擇

### 2.1 整體盤面（為什麼 Data Coop 有潛力）

- **AI 資料服務市場**：2025 約 **34.2 億美金**，預估 2034 年達 **128.7 億**，年複合成長率約 15%。
- **AI 資料管理市場**：2025 約 **382.7 億美金**，2034 年成長至約 **2349.5 億**，CAGR 超過 22%。

在這麼大的盤子裡，「**誰擁有資料、資料怎麼共享、怎麼可信地給 AI 用**」是共通痛點——這正是 Data Coop 切入的縫。

### 2.2 垂直排序（依「市場大 × AI+區塊鏈成熟度高 × 評審心理門檻低」）

| 排序 | 垂直 | 市場規模 / 訊號 | 為何選 / 不選 |
|------|------|----------------|---------------|
| **首選** | 零售 / 數位廣告 / Retail Media | Retail Media Networks 毛利 **70–80%**，已成零售新高利潤來源；data clean room 已大量落地 | 市場大、成長快、已接受「新資料基礎設施」，行銷圈對「更透明的數據合作」聽得懂也開始接受。心理門檻最低。 |
| 次選 | 醫療 / 臨床試驗資料共享 | AI 最大金礦之一，多篇研究談 blockchain 當醫療資料共享層 | 最敏感、合規風險高、導入週期長，評審會覺得「這要很多年」。長期有價值但不適合 hackathon。 |
| 第三 | 供應鏈 / 製造 IoT 資料網 | 區塊鏈供應鏈市場 2025 約 39.6 億 → 2033 約 955.2 億，CAGR 近 **49%** | 主流仍偏「貨物流動追蹤」而非「data coop 給模型訓練」，需要更多教育成本，新穎但理解成本略高。 |

### 2.3 結論：收斂為「零售 & 品牌的 AI Data Coop for 第一方數據合作」

理由：
- 市場本身正熱（first-party data / retail media / data partnership），有大量資料可引用，評審容易理解產品真有機會長大。
- 零售與廣告對「用 blockchain 做資料透明 / 反詐欺」已有不少案例，心理門檻相對低——我們只要做「更好的 data coop infra」，而不是從零教育整個產業。
- 跟 Walrus 官方「為 AI 時代打造可驗證 data market」的敘事高度吻合，適合作為 showcase。

---

## 3. 產品定位與角色

### 3.1 產品名稱（暫定）

**Sui Retail Data Coop** — 基於 Sui + Walrus 的零售 & 品牌 AI 資料合作平台。

### 3.2 三方角色

| 角色 | 英文 | 身份 | 痛點 / 動機 |
|------|------|------|-------------|
| 零售商 / DTC 品牌 | **Data Provider** | 擁有大量第一方購買、瀏覽、Loyalty 資料 | 想變現但不想把 raw data 完全交給第三方；已在做或準備做 Retail Media Network |
| 品牌方 / 廣告主 | **Data Consumer** | 需要高品質零售端行為資料做受眾建模、廣告歸因 | 不想被單一 walled garden 鎖死，希望在多個零售夥伴間建立可驗證、可比較的資料合作 |
| AI / 分析服務商 | **Model Provider** | 提供 demand forecasting、推薦引擎、廣告優化模型 | 需要合法取得多家零售匿名化資料以提升模型品質；希望客戶能 audit 資料來源、增加信任度 |

> 三方可由同一平台 UI 切換角色；在 hackathon MVP 中可由同一錢包扮演多角。

---

## 4. 使用流程（User Flow）

### Flow A：零售商上傳資料 & 發行 Dataset 資產

1. **資料準備（off-chain）**：零售商在自有系統做去識別化與聚合，產生如「每日商品銷售彙總」「客群特徵統計」等 CSV/Parquet。**PII 留在零售商系統內，平台只接收匿名化/聚合後資料。**
2. **上傳 Walrus**（透過後端 + Tatum Storage API）：後端呼叫 Tatum 的 Walrus/Storage API，把 dataset 上傳為 Walrus blob，回傳 `blob_id` / object id。
3. **Sui 上註冊 dataset**：透過 Tatum Sui RPC 呼叫 Move 合約 `register_dataset`，鑄造一個 `Dataset` object，包含 `owner`、`blob_id`、`schema_meta`、`pricing_model`、`rev_share_config`。回傳 on-chain dataset ID（可視為 dataset NFT）。
4. **供應者儀表板顯示 dataset**：名稱、價格、欄位描述、是否已上架。

### Flow B：品牌方購買「使用權」並請求模型訓練

1. **瀏覽資料市集**：品牌登入前端，瀏覽 dataset 列表（來自鏈上 `Dataset` objects），可依品類、國家、時間範圍、資料量篩選。
2. **建立「資料方案」訂單**：選擇若干 dataset、設定用途（如「預測 Q3 某品類需求」）、使用期間、預算。前端呼叫 `create_campaign`，生成 `Campaign` object，關聯多個 dataset ID，記錄預算與分潤比例。
3. **支付與授權**：品牌用 SUI 或穩定幣付款，合約把金額鎖在 `Campaign` object，並給模型服務商一個 `AccessTicket` object（dataset 使用憑證）。
4. **模型服務商觸發訓練**：後端依 `AccessTicket` 上列的 dataset IDs，逐一從 Walrus 讀取 blob（安全的 server-side pipeline）。訓練完成後，產生報表與評估結果，打包成 JSON/HTML 上傳 Walrus，得到 `report_blob_id`。
5. **寫回使用報告與分潤**：後端透過 Tatum RPC 呼叫 `settle_campaign`——在鏈上 `UsageRecord` 記錄用了哪些 dataset、訓練輪數、`report_blob_id`，並按 `rev_share_config` 把預算拆給各 dataset owner。
6. **品牌查看結果**：前端看到模型報告摘要（從 `report_blob_id` 拉）、使用了哪些 dataset（鏈上記錄）、每個 dataset 對結果的貢獻度（可先簡化）。

### Flow C：資料供應者查看收益與使用紀錄

1. **登入供應者儀表板**：從鏈上拉供應者名下的 `Dataset` objects 與 `UsageRecord`。
2. **查看 dataset 被用在哪些 campaign、賺了多少**：每筆使用紀錄對應一個 Walrus usage 報表 blob，可點擊檢視詳細統計（被讀取次數、在模型中的權重）。

---

## 5. 功能規格（Functional Requirements）

### 5.1 On-chain（Sui / Move）模組

**主要物件**

| Object | 欄位 | 說明 |
|--------|------|------|
| `Dataset` | `id`, `owner`, `blob_id` (Walrus), `schema_uri`, `pricing_model`, `rev_share_config` | 可視為 dataset NFT；可轉移、拆分、組合 |
| `Campaign` | `id`, `buyer`, `model_provider`, `dataset_ids[]`, `budget`, `status` (Pending/Active/Settled) | 資料方案訂單，鎖定預算 |
| `AccessTicket` | `campaign_id`, `dataset_ids[]`, `expiry` | 授權模型服務商在有效期內存取對應 Walrus blob |
| `UsageRecord` | `campaign_id`, `dataset_ids[]`, `usage_stats_hash`, `report_blob_id`, `settled_amounts[]` | 使用與分潤的不可改紀錄 |

**主要 entry functions（簡化版）**

```move
register_dataset(blob_id, schema_meta, pricing, rev_share)
update_dataset_meta(dataset_id, ...)
create_campaign(dataset_ids[], budget, model_provider)
fund_campaign(campaign_id, payment_asset)
issue_access_ticket(campaign_id)
settle_campaign(campaign_id, usage_stats_hash, report_blob_id)
```

> **核心原則**：合約不需要知道 dataset 內容，只負責「誰擁有什麼、授權給誰、什麼時候用過、如何分錢」；blob 實體留在 Walrus。

### 5.2 Off-chain 後端服務

| 服務 | 職責 |
|------|------|
| **API Gateway / BFF** | 封裝 Tatum Sui RPC / Walrus API 調用，提供前端簡單 REST/GraphQL 介面 |
| **Dataset Pipeline** | 接零售商上傳的檔案 → 呼叫 Tatum Storage/Walrus API 上傳 blob → 拿到 `blob_id` 後呼叫 `register_dataset` |
| **Model Worker**（MVP 可 mock） | 接收 `AccessTicket` → 依 dataset 列表從 Walrus 下載資料 → 跑簡化訓練（或 mock 模型）→ 產出報表 JSON → 上傳 Walrus → 呼叫 `settle_campaign` |
| **Cron / Job** | 監控 `Campaign` 狀態（透過 Tatum RPC 讀事件）→ 決定何時自動結算或關閉過期 Campaign |

### 5.3 前端（Web dApp）

- **角色切換**：Retailer / Brand / Model Provider
- **Retailer 儀表板**：上傳 dataset（檔案交後端）、查看 dataset 列表、每個 dataset 的收益與使用紀錄
- **Brand 儀表板**：探索 dataset、市集列表、建立 campaign、查看模型報告與分潤去向
- **Model Provider 儀表板**：查看收到的 `AccessTicket`、模型執行狀態、成功/失敗紀錄
- **錢包整合**：Sui 錢包（Sui Wallet / Ethos）登入、付款、簽署交易
- **語言包裝**：面向傳統使用者，避免「加密貨幣術語」，改用「資料供應者 / 方案 / 資料使用紀錄」

---

## 6. 商業模式與單位經濟（新增，正式版重點）

> 推測：以下數字為 hackathon 後商業實驗的假設模型，需以實際試點校準。

### 6.1 收入來源

| 來源 | 說明 | 預設費率（推測） |
|------|------|------------------|
| **平台 take-rate** | 每筆 campaign 成交額抽成 | 5–15% |
| **Dataset 上架 / 認證費** | 供應者驗證與標準化欄位服務 | 月費或一次性 |
| **進階 audit / 報表** | 給品牌的歸因與貢獻度分析 | 加值訂閱 |

### 6.2 成本結構（Walrus 是可算的關鍵）

- **儲存成本**：Walrus 約 0.023 USD/GB/月。一個 100GB dataset 長期保存 ≈ 2.3 USD/月，可預測、可直接寫進定價。
- **鏈上 gas**：register / campaign / settle 等交易，Sui 低 gas，可估算每筆 campaign 鏈上成本。
- **Model Worker 運算**：MVP 用 toy model 成本趨近零；商業版按 GPU 時數計。

### 6.3 分潤邏輯

`rev_share_config` 在 `Dataset` 上定義，`settle_campaign` 時按各 dataset 對 campaign 的貢獻（MVP 可先用「等權」或「資料量加權」）自動拆分預算給各 owner——**不需信任平台帳務**，分帳由合約執行。

### 6.4 定價模型選項（pricing_model）

- 每次使用固定費用
- 按 training 小時數
- 按 dataset 數量或資料量分級（Alpha 階段引入）

---

## 7. 非功能需求（Non-functional）

| 面向 | 需求 |
|------|------|
| **可驗證性 & 不可竄改** | 所有 dataset 註冊、campaign 建立、分潤事件皆在 Sui 上紀錄；對應 raw/aggregated data 在 Walrus，有可驗證的可用性與版本控制 |
| **成本與可擴展性** | Walrus 固定 USD/GB/月，適合長期保留 dataset；儲存成本接近傳統雲卻多了去中心化與可驗證優勢 |
| **隱私與合規**（hackathon 版可簡化） | 只接收匿名化/聚合後資料；PII 留在零售商系統內。商業版需補 DPA、地區合規（GDPR/CCPA） |
| **易用性** | 前端避免加密術語，用「資料供應者 / 方案 / 資料使用紀錄」等語言包裝 |
| **可審計性** | 監管或客戶可從鏈上拿到對應 Walrus blob，重建「誰在什麼時候用了哪份 dataset 的哪個版本」 |

---

## 8. 所需資源（人力與技術）

### 8.1 人力角色

| 角色 | 職責 | hackathon 必要性 |
|------|------|------------------|
| 全端 / 前端工程師 | dApp 前端、錢包整合、UI/UX | 必要 |
| Move / Sui 智能合約工程師 | 設計實作 Dataset / Campaign 等合約，熟悉 Sui object 模型 | 必要 |
| 後端工程師 | 串接 Tatum Sui RPC、Walrus Storage API，做 dataset pipeline、model worker mock、job | 必要 |
| 資料科學 / AI 工程師 | 設計一個簡單但說得過去的模型 demo（如根據歷史銷售預測未來某品類需求） | 可選（加分） |

### 8.2 技術與外部服務

| 服務 | 用途 |
|------|------|
| **Tatum** | Sui RPC Endpoint（mainnet/testnet）發送/讀取交易與事件；Walrus / Storage API 上傳 dataset、報表、usage logs |
| **Walrus** | dataset blob 的儲存層：大檔案、長期保存、可驗證的可用性 |
| **Sui 錢包與 SDK** | TypeScript SDK for Sui + Walrus（官方 Walrus TS SDK），實作前端交易呼叫流程 |
| **雲端（可選）** | 一個輕量 server / serverless backend 跑 dataset pipeline、model worker |

---

## 9. Product Roadmap（以 hackathon → PoC 為主）

### Phase 0：Hackathon MVP（現在 ~ 提交）

**目標**：demo 一個 end-to-end 流程，即使很多東西簡化/硬編也沒關係。

- **合約**：`register_dataset`、`create_campaign`、`fund_campaign`、`settle_campaign` 四個主要 flow。
- **Walrus**：成功把一個 dataset 上傳 Walrus 拿到 blob-id 並寫進 `Dataset`；訓練報表（可簡單統計）上傳 Walrus，寫進 `UsageRecord`。
- **前端**：簡單市集 UI — Retailer 上傳一個 CSV，Brand 選這個 dataset 建 campaign、付款、按「執行模型」按鈕，看到結果與分潤變動。
- **後端**：Model worker 用一個 toy model（如算 Top K 暢銷商品）即可，只要能證明「有用到 Walrus 上的資料」。

### Phase 1：Alpha（hackathon 後 1–3 個月）

- 支援多 dataset 組合，讓 brand 真正可以選多家零售商的資料。
- 引入簡單 pricing 模型（按 dataset 數量或資料量分級）。
- 增加 dashboard 視覺化（趨勢圖、地區分布、campaign 效果）。
- 與 1–2 家小型電商 / 品牌試點（即便是沙盒資料）。

### Phase 2：Beta / 商業實驗（3–12 個月）

- 支援更多資料 schema、標準欄位（品類、地區、通路）。
- 引入更正式的 AI 模型（需求預測、促銷模擬等）。
- 與現有 AdTech / CDP / Clean Room 合作，作為「可驗證 dataset registry + settlement 層」。

---

## 10. 延伸產品線（同平台的其他 Walrus 殺手級用法）

> 這些共用同一套原語（dataset blob + usage log + 合約結算），可作為平台的延伸模組或第二曲線，不是競品。

| # | 產品 | 商業痛點（web2 難解） | Walrus + Sui 解法 | punchline |
|---|------|----------------------|-------------------|-----------|
| 2 | **Proof-of-Metrics SaaS** | SaaS / 廣告平台報 KPI（曝光、點擊、DAU）時客戶無法驗證「數字是否來自真實 raw log」 | 每天把匿名化事件 log 打包上傳 Walrus，合約記錄每天 blob-id + hash；報表從 snapshot 解出來算，客戶可自行重算驗證 | 「我們的 metrics 是用 Walrus+Sui 做 cryptographic attestation，技術上不可能事後改造去年任一天的 raw log。」 |
| 3 | **可合約控制的訂閱內容 + 二級市場** | 內容創作者依賴 Patreon/OnlyFans/Substack，抽成高、規則隨時改、訂閱權不能再交易、平台倒閉內容全失 | 內容（影片/PDF/音檔）上 Walrus；訂閱憑證是 Sui 資產，可解鎖 N 個 blob、到期自動失效、可轉售/租借/拆分；解密 key 由合約授權後 off-chain key server 下發 | 「存取權限完全在可驗證的鏈上合約，誰都能 audit，且可在不同 dapp 間組合（訂閱憑證可當貸款抵押）。」 |
| 4 | **AI 黑盒決策審計** | 金融機構用 AI/agent 做投資建議甚至自動下單，監管與客戶不信任「模型憑什麼這樣下單、出事誰負責」 | AI agent 每次決策輸出（input prompt、模型版本、風控結果）序列化成 blob 上 Walrus，blob-id 綁定該筆交易 on-chain record；監管可從鏈上重建「當時模型看到什麼、為何做這決策」 | 「我們讓 AI 的決策完全可審計，從技術層防止事後洗白。」 |

---

## 11. 風險與緩解

> Red Team 視角（核心邏輯：金流、授權、分潤）。

| 風險 | 類型 | 緩解 |
|------|------|------|
| 模型服務商拿到 `AccessTicket` 後外洩 raw data | 授權濫用 | 憑證設 `expiry`；server-side pipeline 不暴露 raw blob 給前端；商業版加 watermark / TEE |
| `settle_campaign` 被偽造 usage_stats_hash | 資料造假 | usage report blob 上 Walrus 可被供應者下載重算驗證；hash 上鏈不可改 |
| 分潤計算溢位 / 四捨五入侵蝕 | integer overflow / 經濟漏洞 | Move 內建 overflow 保護；分潤用整數最小單位，餘額處理明確定義 |
| 過期 Campaign 鎖死預算 | DoS / 資金鎖定 | Cron job 監控狀態，逾期可由 buyer 取回未結算預算 |
| 假 dataset / 灌水資料 | 資料品質 | Alpha 引入認證費 + 標準欄位驗證；供應者信譽分 |
| 合規：誤收 PII | 法律風險 | 只接匿名化/聚合資料，上傳前 schema 驗證；商業版加 DPA |

---

## 附錄 A：Walrus blob schema（草案）

```jsonc
// dataset blob（zip/parquet + manifest）
{
  "dataset_id": "0x...",
  "schema": { "fields": [{ "name": "sku", "type": "string" }, ...] },
  "rows": 1234567,
  "period": "2026-Q1",
  "region": "TW",
  "channel": "ecommerce"
}

// usage report blob（settle 時產生）
{
  "campaign_id": "0x...",
  "datasets_used": ["0x...", "0x..."],
  "training_rounds": 3,
  "metrics": { "top_k": [...], "model_version": "toy-v0" },
  "contribution": { "0x...": 0.6, "0x...": 0.4 }
}
```

## 附錄 B：Tatum / Sui API 端點（最小 demo flow）

| 步驟 | API |
|------|-----|
| 上傳 dataset | Tatum Walrus/Storage API → `blob_id` |
| 註冊 dataset | Tatum Sui RPC → `register_dataset` |
| 建立 / 注資 campaign | Tatum Sui RPC → `create_campaign` / `fund_campaign` |
| 讀 campaign 事件 | Tatum Sui RPC（event subscription / polling） |
| 結算 | Tatum Sui RPC → `settle_campaign` |

## 附錄 C：引用來源

**Walrus / Sui / Tatum 技術**
1. https://blog.sui.io/verifiable-ai-data-sui-stack/
2. https://www.mystenlabs.com/blog/announcing-walrus-a-decentralized-storage-and-data-availability-protocol
3. https://docs.wal.app
4. https://sdk.mystenlabs.com/walrus
5. https://communityone.io/servers/1441975503085895894/the-upside/news/walrus-predictable-pricing-023-gb-mo-2026-05-13/
6. https://blog.sui.io/celebrating-walrus-one-year-anniversary/
7. https://tatum.io/chain/sui
8. https://docs.tatum.io/reference/rpc-sui
9. https://tatum.io/blog/tatum-walrus

**市場 / 垂直分析**
10. https://www.intelmarketresearch.com/ai-data-service-market-36673
11. https://www.precedenceresearch.com/ai-data-management-market
12. https://finance.yahoo.com/news/big-data-artificial-intelligence-market-093900108.html
13. https://commercemediabrandsummit.wbresearch.com/blog/first-party-data-retail-media-success-strategy
14. https://www.decentriq.com/article/retail-data-partnerships
15. https://www.snsinsider.com/reports/blockchain-in-supply-chain-market-8971
16. https://chain.link/article/blockchain-healthcare-data-sharing
17. https://www.clinicaltrialsarena.com/news/blockchain-clinical-trials-2/

---

*文件版本 v1.0 — 整合自三份 Idea 來源（商規草稿、市場垂直分析、Walrus 非取代性論證）。下一步可將 Phase 0 拆成具體技術 checklist（合約 function 簽名、API 介面、前端頁面草圖）排開工順序。*
