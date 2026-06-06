# WalCoop — Business Specification (UK English v1.0)

> One-line positioning: **WalCoop turns first-party retail data partnerships into a verifiable data co-operative, helping brands use trusted data for AI while giving data owners transparent, automatic revenue sharing.**
>
> Technical foundation: **Sui for settlement and authorisation logic, Walrus for verifiable data storage, and Tatum for RPC and storage API access.**
>
> Document scope: this specification is written for the hackathon → PoC → commercial pilot path. It can be used as the source material for the pitch deck, README, product roadmap, and technical plan.

---

## 0. Reader Guide

| Section | Content | Primary Reader |
|---|---|---|
| 1 | Why Walrus + Sui is essential | Judges / investors |
| 2 | Market opportunity and vertical focus | Judges / BD |
| 3 | Product positioning and roles | Everyone |
| 4 | User flows | PM / engineering |
| 5 | Functional requirements | Engineering |
| 6 | Business model and unit economics | Business / finance |
| 7 | Non-functional requirements | Engineering / legal |
| 8 | Required resources | PM |
| 9 | Product roadmap | Everyone |
| 10 | Extended product lines | Strategy |
| 11 | Risks and mitigations | Judges / legal |
| Appendix | Blob schema, API flow, references | Engineering |

---

## 1. Core Value Proposition: Why Walrus + Sui Is Essential

This is the centre of the pitch. Every feature should reinforce this point.

### 1.1 Walrus Is Not Just Cheap S3

| Capability | Traditional Web2 Storage | Walrus + Sui |
|---|---|---|
| **Verifiable and programmable data** | Users must trust the cloud provider that data still exists and has not changed. | Blob availability and integrity can be anchored to Sui, allowing contracts and applications to verify data existence and versioning. |
| **Data as a first-class asset** | A file is just a file, with access control owned by the platform. | A blob can be represented by a Sui object that supports ownership, transfer, access control, pricing, and settlement logic. |
| **Predictable decentralised cost** | Unit costs are low, but data availability and history are not independently verifiable. | At roughly **USD 0.023 per GB per month**, long-term storage costs are predictable while adding decentralisation and verifiability. |
| **Versioning and tamper resistance** | Logs and reports can be changed or recomputed by the platform after the fact. | Each dataset snapshot has a blob ID and hash recorded on-chain, making retrospective manipulation technically detectable. |

**Design principle:** do not present Walrus as a hard drive. Make it obvious that the product depends on a verifiable, programmable data layer combined with on-chain settlement.

### 1.2 Why This Product Needs Walrus

1. **Revenue sharing depends on verifiable data availability and versioning.** The platform must prove who contributed which dataset, when it was used, and which report was produced from it, without relying on a central database ledger.
2. **Datasets are too large for direct on-chain storage.** Retail data can be GB- to TB-scale. Walrus provides a practical middle ground: large-file storage with decentralised availability proofs.
3. **Usage rights must be programmable assets.** The model provider buys campaign-scoped usage rights, not ownership of raw data. Those rights need expiry, policy checks, and settlement hooks across applications.

### 1.3 External Pitch

> WalCoop turns first-party retail data partnerships into a verifiable data co-operative. Brands can use trusted data for AI, while retailers receive transparent revenue sharing. We are not using Walrus as storage alone; we are using Walrus + Sui as a programmable trust layer for data rights and settlement.

---

## 2. Market Opportunity and Vertical Focus

### 2.1 Why a Data Co-operative Can Become Valuable

- **AI data services market:** estimated at roughly **USD 3.42 billion in 2025**, growing to around **USD 12.87 billion by 2034**, with an estimated CAGR of about 15%.
- **AI data management market:** estimated at roughly **USD 38.27 billion in 2025**, growing to around **USD 234.95 billion by 2034**, with CAGR above 22%.

Across these markets, the unresolved problem is the same: **who owns the data, how it can be shared, and how buyers can trust that AI systems used authorised data**. WalCoop addresses that gap.

### 2.2 Vertical Prioritisation

| Priority | Vertical | Market Signal | Rationale |
|---|---|---|---|
| **Primary** | Retail / digital advertising / retail media | Retail media networks can generate gross margins of **70-80%** and have become a major profit centre for retailers. | Large market, fast growth, existing demand for data partnerships, and a low education barrier for judges and customers. |
| Secondary | Healthcare / clinical trial data sharing | AI has strong demand for high-quality medical data, and blockchain-based data sharing has been widely discussed. | Valuable long term, but privacy, compliance, and adoption cycles make it less suitable for a hackathon MVP. |
| Tertiary | Supply chain / manufacturing IoT data | Blockchain in supply chain is forecast to grow rapidly. | Interesting, but the dominant use case is goods traceability rather than data co-operatives for model training, which increases education cost. |

### 2.3 Conclusion

WalCoop should focus on **AI data co-operation for first-party retail and brand data**.

Reasons:

- Retail media, first-party data, and data partnerships are already strategic topics for retailers and brands.
- The market already understands clean rooms, data sharing, attribution, and transparency.
- The narrative aligns closely with the Sui/Walrus thesis of verifiable data markets for AI.

---

## 3. Product Positioning and Roles

### 3.1 Product Name

**WalCoop** — a Sui + Walrus data co-operative for retail AI partnerships.

### 3.2 Three-Sided Marketplace

| Role | Identity | Pain Point / Motivation |
|---|---|---|
| **Data Provider** | Retailer or DTC brand with first-party sales, basket, loyalty, or product performance data. | Wants to monetise data without handing raw records to a third party. |
| **Data Consumer** | Brand, advertiser, or retail media buyer. | Needs high-quality, multi-retailer data for forecasting, attribution, and audience insight, without relying on opaque intermediaries. |
| **Model Provider** | AI or analytics provider. | Needs authorised access to multiple datasets and a way to prove which data powered a report. |

The same wallet may play multiple roles in the hackathon MVP, but the commercial product should support role-specific dashboards and permissions.

---

## 4. User Flows

### Flow A: Retailer Uploads Data and Issues a Dataset Asset

1. **Data preparation:** the retailer de-identifies and aggregates data inside its own systems, producing files such as daily product sales, basket summaries, or audience segment statistics. **PII remains inside the retailer's environment; WalCoop only accepts anonymised or aggregated data.**
2. **Upload to Walrus:** the backend calls Tatum's Walrus/storage APIs, uploads the dataset as a Walrus blob, and receives a `blob_id`.
3. **Register dataset on Sui:** the frontend or backend uses Tatum Sui RPC to call `register_dataset`, minting a `Dataset` object containing `owner`, `blob_id`, `schema_meta`, `pricing_model`, and `rev_share_config`.
4. **Provider dashboard:** the retailer sees dataset name, schema, price, listing status, usage history, and revenue.

### Flow B: Brand Buys Usage Rights and Requests Model Output

1. **Browse the marketplace:** the brand views on-chain `Dataset` objects and filters by category, market, date range, schema, or volume.
2. **Create a campaign:** the brand selects one or more datasets, defines the use case, usage period, and budget, then calls `create_campaign`.
3. **Fund and authorise:** the brand pays in SUI or a future stablecoin. The campaign budget is locked in the `Campaign` object, and the model provider receives an `AccessTicket`.
4. **Run the model:** the model provider pipeline reads authorised dataset blobs from Walrus, runs the model or analytics workflow, then uploads a report JSON/HTML blob to Walrus.
5. **Settle and record usage:** the backend calls `settle_campaign`, creating a `UsageRecord` with dataset IDs, usage hash, report blob ID, and settlement amounts.
6. **View results:** the brand can inspect the AI report, verify which datasets were used, and see how funds were distributed.

### Flow C: Data Provider Tracks Revenue and Usage

1. The provider dashboard reads the provider's `Dataset` objects and related `UsageRecord` entries from Sui.
2. Each usage entry links to a Walrus report blob, showing campaign context, usage statistics, and the revenue share earned by the dataset owner.

---

## 5. Functional Requirements

### 5.1 On-chain Modules (Sui / Move)

**Core objects**

| Object | Fields | Purpose |
|---|---|---|
| `Dataset` | `id`, `owner`, `blob_id`, `schema_uri`, `pricing_model`, `rev_share_config` | Represents a retailer-owned dataset and its commercial terms. |
| `Campaign` | `id`, `buyer`, `model_provider`, `dataset_ids[]`, `budget`, `status` | Represents a funded data usage order. |
| `AccessTicket` | `campaign_id`, `dataset_ids[]`, `expiry` | Grants the model provider campaign-scoped dataset access. |
| `UsageRecord` | `campaign_id`, `dataset_ids[]`, `usage_stats_hash`, `report_blob_id`, `settled_amounts[]` | Stores tamper-resistant usage and settlement evidence. |

**Entry functions**

```move
register_dataset(blob_id, schema_meta, pricing, rev_share)
update_dataset_meta(dataset_id, ...)
create_campaign(dataset_ids[], budget, model_provider)
fund_campaign(campaign_id, payment_asset)
issue_access_ticket(campaign_id)
settle_campaign(campaign_id, usage_stats_hash, report_blob_id)
```

**Core principle:** the contract does not need to know dataset contents. It records ownership, authorisation, usage, and settlement; the actual data remains in Walrus.

### 5.2 Off-chain Backend Services

| Service | Responsibility |
|---|---|
| **API Gateway / BFF** | Wraps Tatum Sui RPC and Walrus API calls behind simple REST or GraphQL endpoints. |
| **Dataset Pipeline** | Accepts retailer uploads, stores files on Walrus, receives `blob_id`, and calls `register_dataset`. |
| **Model Worker** | Reads an `AccessTicket`, downloads authorised blobs, runs a toy or production model, uploads the report, and calls `settle_campaign`. |
| **Cron / Job Worker** | Monitors campaign status through events or polling and closes expired or completed campaigns. |

### 5.3 Frontend dApp

- **Role switching:** Retailer / Brand / Model Provider.
- **Retailer dashboard:** upload datasets, manage listings, view usage and revenue.
- **Brand dashboard:** browse datasets, create campaigns, fund campaigns, view reports and settlement.
- **Model Provider dashboard:** view access tickets, execute jobs, and track job status.
- **Wallet integration:** Sui wallet login, payments, and transaction signing.
- **Terminology:** avoid crypto-heavy wording for mainstream users; use terms such as data provider, campaign, data usage record, and report.

---

## 6. Business Model and Unit Economics

> Assumption: the figures below are hypotheses for post-hackathon commercial experiments and should be recalibrated with real pilots.

### 6.1 Revenue Sources

| Source | Description | Indicative Fee |
|---|---|---|
| **Platform take rate** | Commission on each funded campaign. | 5-15% initially; potentially 15-25% for managed marketplace flows. |
| **Dataset listing / certification** | Provider onboarding, schema standardisation, and quality checks. | Monthly or one-off fee. |
| **Advanced audit and reporting** | Attribution, contribution analysis, benchmark reports, and enterprise exports. | Subscription or add-on fee. |
| **Enterprise onboarding** | Private marketplace setup, anonymisation pipeline design, and integration support. | Setup fee plus support retainer. |

### 6.2 Cost Structure

- **Storage:** Walrus storage at roughly USD 0.023/GB/month makes long-term dataset cost predictable. A 100GB dataset costs about USD 2.30/month to store.
- **On-chain gas:** Sui transaction costs for registration, campaign creation, funding, and settlement are expected to be small enough to model per campaign.
- **Model worker compute:** the MVP can use a toy model with negligible cost; production workflows can be priced by GPU hours or analysis complexity.

### 6.3 Revenue Sharing Logic

`rev_share_config` is defined on each `Dataset`. When `settle_campaign` is called, the campaign budget is split automatically across dataset owners based on contribution logic. The MVP can use equal weighting or data-volume weighting; later versions can support attribution-based weighting.

The key business value is that **the platform does not need to be trusted as an accounting intermediary**. Settlement is enforced by the contract.

### 6.4 Pricing Model Options

- Fixed fee per dataset use.
- Fee per training hour.
- Tiered pricing by dataset volume, category, or number of datasets.
- Subscription access for enterprise customers with capped usage.

---

## 7. Non-functional Requirements

| Area | Requirement |
|---|---|
| **Verifiability and tamper resistance** | Dataset registration, campaign creation, usage, and settlement events must be recorded on Sui, with corresponding blobs stored on Walrus. |
| **Cost and scalability** | Walrus should support long-term dataset retention with predictable storage cost and verifiable availability. |
| **Privacy and compliance** | WalCoop should only accept anonymised or aggregated data. PII remains inside the retailer's systems. Commercial deployments require DPAs and regional compliance checks such as GDPR and CCPA. |
| **Usability** | The frontend should use business language and hide unnecessary crypto terminology from non-technical users. |
| **Auditability** | Customers and auditors should be able to reconstruct which dataset version was used, by whom, and for which report. |

---

## 8. Required Resources

### 8.1 Team Roles

| Role | Responsibility | Hackathon Need |
|---|---|---|
| Full-stack / frontend engineer | dApp frontend, wallet integration, UI/UX. | Required |
| Move / Sui smart contract engineer | Dataset, campaign, access, and settlement contracts. | Required |
| Backend engineer | Tatum Sui RPC, Walrus API, dataset pipeline, mock model worker, jobs. | Required |
| Data science / AI engineer | Simple but credible model demo, such as product demand or top-selling SKU analysis. | Optional but useful |

### 8.2 Technical Services

| Service | Use |
|---|---|
| **Tatum** | Sui RPC endpoint, transaction reads/writes, event access, and Walrus/storage API integration. |
| **Walrus** | Verifiable storage layer for dataset blobs, reports, and usage logs. |
| **Sui wallet and SDK** | Wallet login, transaction signing, and dApp flows. |
| **Cloud/serverless backend** | Lightweight dataset pipeline, model worker, and campaign job runner. |

---

## 9. Product Roadmap

### Phase 0: Hackathon MVP

Goal: demonstrate a complete end-to-end flow, even with simplified data and model logic.

- **Contracts:** `register_dataset`, `create_campaign`, `fund_campaign`, and `settle_campaign`.
- **Walrus:** upload a dataset blob, store the blob ID in `Dataset`, upload a report blob, and store it in `UsageRecord`.
- **Frontend:** simple marketplace where a retailer uploads a CSV, a brand funds a campaign, and the model worker produces a report and settlement.
- **Backend:** toy model worker, such as top-selling product analysis, proving that authorised Walrus data was used.

### Phase 1: Alpha

- Multi-dataset campaigns across multiple retailers.
- Simple pricing models by dataset count or data volume.
- Dashboard visualisations for trends, revenue, and campaign performance.
- Pilot with 1-2 small retailers, DTC brands, or sandbox datasets.

### Phase 2: Beta / Commercial Pilot

- Standard retail schemas for category, region, channel, product, and basket data.
- More credible AI workflows, such as demand forecasting or promotion simulation.
- Integration with adtech, CDP, or clean-room systems as a verifiable dataset registry and settlement layer.

---

## 10. Extended Product Lines

These products reuse the same primitives: dataset blobs, usage logs, access rights, and contract-based settlement. They are potential second curves, not direct competitors to WalCoop.

| # | Product | Web2 Pain Point | Walrus + Sui Solution | Punchline |
|---|---|---|---|---|
| 1 | **Proof-of-Metrics SaaS** | SaaS and ad platforms report KPIs such as impressions, clicks, and DAU, but customers cannot verify whether the numbers came from real raw logs. | Daily anonymised event logs are uploaded to Walrus; Sui records blob IDs and hashes; reports are computed from immutable snapshots. | Metrics can be cryptographically attested rather than merely reported. |
| 2 | **Contract-controlled subscriptions and secondary market** | Creators depend on centralised platforms with high fees, mutable rules, and non-transferable subscriptions. | Content lives on Walrus; subscription rights are Sui assets that unlock blobs, expire automatically, and can be resold or composed across dApps. | Access rights become programmable, auditable assets. |
| 3 | **AI black-box decision audit** | Financial institutions using AI agents need to prove why a model made a recommendation or trade. | Each AI decision input, model version, and risk result is stored as a Walrus blob and linked to an on-chain transaction record. | AI decisions become reconstructable and audit-ready. |

---

## 11. Risks and Mitigations

| Risk | Type | Mitigation |
|---|---|---|
| Model provider leaks raw data after receiving an `AccessTicket`. | Authorisation abuse | Use expiry, server-side pipelines, no raw blob exposure in the frontend, and later watermarking or TEE-based controls. |
| `settle_campaign` is called with a fabricated `usage_stats_hash`. | Data falsification | Store the usage report blob on Walrus so providers can recompute and verify it; hash is recorded on-chain. |
| Revenue sharing has rounding or overflow errors. | Economic bug | Use Move overflow protection, smallest integer units, and explicit remainder handling. |
| Expired campaigns lock funds. | DoS / fund lock | Cron job monitors status; buyer can reclaim unsettled budget after expiry. |
| Fake or low-quality datasets enter the marketplace. | Data quality | Add certification, schema validation, quality scores, and provider reputation. |
| PII is accidentally uploaded. | Legal risk | Accept only anonymised or aggregated data; validate schema before upload; add DPA and compliance workflow for commercial use. |

---

## Appendix A: Walrus Blob Schema Draft

```jsonc
// Dataset blob: zip/parquet + manifest
{
  "dataset_id": "0x...",
  "schema": { "fields": [{ "name": "sku", "type": "string" }] },
  "rows": 1234567,
  "period": "2026-Q1",
  "region": "TW",
  "channel": "ecommerce"
}

// Usage report blob generated at settlement
{
  "campaign_id": "0x...",
  "datasets_used": ["0x...", "0x..."],
  "training_rounds": 3,
  "metrics": { "top_k": [], "model_version": "toy-v0" },
  "contribution": { "0x...": 0.6, "0x...": 0.4 }
}
```

## Appendix B: Tatum / Sui API Flow for the Minimum Demo

| Step | API |
|---|---|
| Upload dataset | Tatum Walrus/storage API → `blob_id` |
| Register dataset | Tatum Sui RPC → `register_dataset` |
| Create and fund campaign | Tatum Sui RPC → `create_campaign` / `fund_campaign` |
| Read campaign events | Tatum Sui RPC event subscription or polling |
| Settle campaign | Tatum Sui RPC → `settle_campaign` |

## Appendix C: References

**Walrus / Sui / Tatum**

1. https://blog.sui.io/verifiable-ai-data-sui-stack/
2. https://www.mystenlabs.com/blog/announcing-walrus-a-decentralized-storage-and-data-availability-protocol
3. https://docs.wal.app
4. https://sdk.mystenlabs.com/walrus
5. https://communityone.io/servers/1441975503085895894/the-upside/news/walrus-predictable-pricing-023-gb-mo-2026-05-13/
6. https://blog.sui.io/celebrating-walrus-one-year-anniversary/
7. https://tatum.io/chain/sui
8. https://docs.tatum.io/reference/rpc-sui
9. https://tatum.io/blog/tatum-walrus

**Market / Vertical Analysis**

10. https://www.intelmarketresearch.com/ai-data-service-market-36673
11. https://www.precedenceresearch.com/ai-data-management-market
12. https://finance.yahoo.com/news/big-data-artificial-intelligence-market-093900108.html
13. https://commercemediabrandsummit.wbresearch.com/blog/first-party-data-retail-media-success-strategy
14. https://www.decentriq.com/article/retail-data-partnerships
15. https://www.snsinsider.com/reports/blockchain-in-supply-chain-market-8971
16. https://chain.link/article/blockchain-healthcare-data-sharing
17. https://www.clinicaltrialsarena.com/news/blockchain-clinical-trials-2/

---

*Document version v1.0. This English version is adapted from the original Chinese business specification and written in UK English for judges, investors, business development partners, and technical reviewers.*
