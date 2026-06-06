# Threat Model — Sui Retail Data Coop

範圍：核心金流（campaign 注資 / 分潤結算）、授權（AccessTicket / Seal）、資料完整性。方法：STRIDE + Sui 特有攻擊面。

## 資產
- `Campaign.budget`（鎖定資金，`Balance<T>`）
- dataset 明文（Seal 加密後存 Walrus）
- 分潤正確性與不可竄改的 `UsageRecord`
- `ProviderCap` / `PublisherCap`

## 攻擊向量與緩解

| # | 向量 | 類型 | 攻擊情境 | 緩解 |
|---|------|------|----------|------|
| 1 | 偽造 AccessTicket 解密 | Spoofing / 授權繞過 | 攻擊者自製假 ticket 物件騙 Seal 下發 key | `seal_approve` 收 `&AccessTicket` 真實物件引用；ticket 由合約 `issue_access_ticket` 鑄造並 transfer，無法偽造 UID；額外驗 `sender == ticket.provider` |
| 2 | 過期後續用 ticket | Elevation | provider 在 campaign 結束後仍解密 | `seal_approve` 檢 `clock.timestamp_ms < expiry_ms`；ticket 有 `expiry_ms` |
| 3 | 跨 dataset 越權 | Tampering | 持 dataset A 的 ticket 解 dataset B | `ticket_covers(ticket, inner_id)` 驗 id 在 `dataset_ids` 範圍 |
| 4 | 偽造 usage_stats 結算 | Repudiation / 造假 | provider 報假分潤拿走預算 | `settle_campaign` 需 `ProviderCap`；`usage_stats_hash` + `report_blob_id` 上鏈，供應者可下載 Walrus 報表重算比對；爭議走鏈下仲裁 |
| 5 | 分潤權重溢位 / 不符 | 經濟漏洞 | `rev_weights` 加總 ≠ 10000 bps 導致多分或鎖款 | 結算前 `assert sum(weights)==10000`；分潤整數運算 + Move overflow 保護；餘額（rounding dust）歸 buyer |
| 6 | 重複結算 | 經濟漏洞 | 對同一 campaign settle 兩次 | `status` 狀態機，`assert status==Active`，settle 後設 `Settled`（`EAlreadySettled`） |
| 7 | 過期預算鎖死 | DoS | provider 不結算，buyer 資金卡死 | `cancel_campaign`：逾期且未 settle，buyer 取回 `budget` |
| 8 | 非 owner 改 dataset 換 blob | Tampering | 第三方把 dataset 指到惡意 blob | `update_dataset_meta` 驗 `sender == owner`；`version` 遞增可追溯 |
| 9 | 非 buyer 注資 / 提款 | 授權 | 他人操弄 campaign 資金 | `fund_campaign` 驗 `sender == buyer`；budget 僅 settle/cancel 路徑可動 |
| 10 | Seal session 重放 | Replay | 截獲 session 簽章重用 | SessionKey 有 `ttlMin`（10 分）；personal message 綁 address + packageId |
| 11 | 單一 key server 被攻破 | Info disclosure | 攻破一台 key server 解密全部 | threshold（如 2-of-3）IBE，單台不足以重建 DEM key |
| 12 | shared object 寫競爭 | DoS / 一致性 | 高頻改 Dataset 造成 consensus 壅塞 | 上下架/改價低頻；讀路徑（create_campaign 引用）不寫 Dataset |
| 13 | PII 誤上鏈 | 合規 | 零售商上傳含 PII 原始資料 | 僅接匿名化/聚合資料；pipeline 上傳前 schema 驗證；合約只存 `blob_id`/`schema_uri` |

## 殘留風險（接受 / 待 Phase）
- 分潤「貢獻度」MVP 用權重快照，非 Shapley，可能不完全公平 → Phase 2 改進。
- 鏈下仲裁機制（爭議 usage report）未合約化 → 商業版補。
- Model Worker 解密後在記憶體可見明文 → 商業版考慮 TEE（見 `sui-nautilus`）。
