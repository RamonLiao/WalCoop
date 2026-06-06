# WalCoop

## Turn retail data into trusted AI revenue

**Slogan:** **From locked-up retail data to auditable AI income.**

WalCoop is a verifiable data co-operative for retailers, brands, and AI model providers. It lets retailers monetise anonymised first-party data without handing over raw customer records, while brands get trusted datasets for AI training, forecasting, and campaign insight.

The core business problem is simple: **retail data is valuable, fragmented, and hard to trust.** Retailers want to earn from it, brands need it for better AI, and neither side wants a black-box intermediary controlling access, usage records, or revenue sharing.

Our answer is a programmable data partnership layer built on **Sui + Walrus + Tatum**:

- 🧾 **Sui** records ownership, access rights, campaign funding, usage, and settlement.
- 🐘 **Walrus** stores encrypted dataset and report blobs with verifiable availability.
- 🔐 **Seal** gates decryption through on-chain access policy.
- ⚡ **Tatum** simplifies Sui RPC and storage access for hackathon-speed integration.

---

## Why This Matters

Retail media and first-party data partnerships are becoming major revenue channels, but today they rely heavily on private databases, spreadsheet reconciliation, opaque clean rooms, and trust-heavy commercial agreements.

WalCoop turns each dataset into an on-chain asset with a verifiable storage reference, programmable access, and automatic revenue sharing. A brand does not just buy a file; it buys a time-bound, auditable right to use a dataset for a specific campaign.

**The result:** retailers can sell data access with confidence, brands can audit what powered their AI outputs, and model providers can prove they used authorised datasets only.

---

## Use Cases

### 🛒 Retailer / DTC Brand

A retailer uploads anonymised sales, basket, loyalty, or product performance data. The platform encrypts the dataset, stores it on Walrus, and registers it on Sui as a `Dataset` object. The retailer can then list it in a marketplace and earn automatically whenever it is used in a campaign.

### 📣 Brand / Advertiser

A brand browses available datasets, selects retail partners, funds a campaign, and receives a model report such as demand forecasts, category trends, or audience insights. Every dataset used, every report reference, and every payment split is auditable on-chain.

### 🤖 AI / Analytics Provider

A model provider receives an `AccessTicket`, decrypts only the datasets authorised for that campaign, runs the model pipeline, uploads the output report to Walrus, and triggers settlement through the Sui contract.

---

## Target Users

| User | Pain Point | What They Gain |
|---|---|---|
| **Retailers and DTC brands** | First-party data is under-monetised, but raw sharing creates commercial and privacy risk. | New revenue from anonymised datasets, transparent usage records, and automated settlement. |
| **Brands and advertisers** | AI models need high-quality retail data, but current data partnerships are opaque and hard to compare. | Verifiable data provenance, multi-retailer campaigns, and auditable AI outputs. |
| **AI and analytics providers** | Data access is fragmented, manual, and difficult to prove to customers. | A programmable access layer with clear authorisation, expiry, and report publication. |
| **Retail media operators** | Revenue sharing and partner reporting are operationally heavy. | On-chain campaign settlement and tamper-resistant usage records. |

---

## Main Features

- 🧩 **Dataset registration**
  - Retailers register encrypted datasets as Sui `Dataset` objects.
  - Each object points to a Walrus blob and schema manifest.

- 🔐 **On-chain access control**
  - Campaign-specific `AccessTicket` objects define who can decrypt which datasets and until when.
  - Seal key release is governed by the Move `seal_approve` policy.

- 💰 **Campaign funding and settlement**
  - Brands fund campaigns with `Coin<T>` support for SUI or future stablecoin flows.
  - Settlement distributes revenue to dataset owners according to configured weights.

- 📊 **Verifiable AI reports**
  - Model output reports are uploaded to Walrus.
  - Report blob IDs and usage hashes are written back to Sui for auditability.

- 🧑‍💼 **Role-based dApp experience**
  - Retailer dashboard: upload, list, and track revenue.
  - Brand dashboard: discover datasets, create campaigns, and view reports.
  - Model provider dashboard: manage access tickets and execution status.

---

## System Architecture

```text
┌──────────────────────────────────────────────────────────────┐
│                         Web dApp                              │
│  Retailer Dashboard │ Brand Marketplace │ Model Provider Desk │
│        React + Sui dApp Kit + wallet transaction flows        │
└───────────────┬───────────────────────────┬──────────────────┘
                │ API calls                 │ wallet signing
                ▼                           ▼
┌──────────────────────────────┐   ┌────────────────────────────┐
│       Off-chain Backend       │   │       Sui Move Package      │
│  Dataset Pipeline             │   │  dataset / campaign         │
│  Model Worker                 │   │  access / settlement / acl  │
│  Settlement Job               │   │                            │
│  Tatum + Walrus + Seal client │   │  Dataset, Campaign,         │
└──────┬─────────────┬─────────┘   │  AccessTicket, UsageRecord  │
       │             │             └──────────────┬─────────────┘
       │ Tatum RPC   │ Walrus SDK                 │ events
       ▼             ▼                            ▼
┌──────────────┐  ┌──────────────┐        ┌──────────────────────┐
│  Sui Network │  │    Walrus    │◀──────▶│   Seal Key Servers    │
│  Settlement  │  │ Encrypted    │ policy │ Threshold decryption  │
│  Authorisation│ │ blobs/reports│        │                      │
└──────────────┘  └──────────────┘        └──────────────────────┘
```

### Core On-chain Objects

| Object | Purpose |
|---|---|
| `Dataset` | Represents a retailer-owned dataset, its Walrus blob, schema URI, pricing, version, and revenue share weight. |
| `Campaign<T>` | Holds the buyer, model provider, selected datasets, funded budget, and campaign status. |
| `AccessTicket` | Grants a model provider time-limited access to authorised datasets. |
| `UsageRecord` | Stores campaign usage evidence, report blob ID, settled amounts, and settlement timestamp. |

### Why Walrus + Sui Is Not Replaceable Here

This is not just decentralised file storage. The product depends on the combination of:

- **Large data off-chain:** datasets can be GB-scale or larger, so they cannot live directly on-chain.
- **Verifiable availability:** Walrus provides a verifiable data layer for dataset and report blobs.
- **Programmable rights:** Sui objects represent datasets, campaigns, tickets, and settlement records.
- **Policy-bound decryption:** Seal checks the on-chain `AccessTicket` before releasing decryption shares.
- **Automatic revenue sharing:** the same contract that grants access also settles usage.

---

## Hackathon Demo Flow

1. **Retailer uploads a CSV**
   - The dataset is encrypted and stored on Walrus.
   - A Sui `Dataset` object is registered with the Walrus blob ID.

2. **Brand creates a campaign**
   - The brand selects one or more datasets.
   - The campaign is funded on Sui.
   - An `AccessTicket` is issued to the model provider.

3. **Model provider runs analysis**
   - The worker decrypts authorised data through Seal.
   - A simple model or analytics job generates a report.
   - The report is uploaded to Walrus.

4. **Settlement is triggered**
   - `settle_campaign` writes a `UsageRecord`.
   - Funds are split automatically between dataset owners.
   - The brand can verify which datasets produced the report.

---

## Repository Structure

```text
.
├── BUSINESS_SPEC.md                  # Full business specification
├── docs/
│   ├── deployment.md                 # Testnet deployment record
│   ├── security/threat-model.md      # Threat model and residual risks
│   └── specs/                        # Technical architecture spec
├── frontend/                         # React + Vite dApp
└── move/                             # Sui Move smart contracts and tests
```

---

## Current Testnet Deployment

| Field | Value |
|---|---|
| **Network** | Sui Testnet |
| **Package ID** | `0xb83403fe50e856b02c4b844cb9cc0cf2a8fe822161fdaf6619ae259fc0c8f286` |
| **Explorer** | https://suiscan.xyz/testnet/object/0xb83403fe50e856b02c4b844cb9cc0cf2a8fe822161fdaf6619ae259fc0c8f286 |

See [`docs/deployment.md`](docs/deployment.md) for the full deployment record.

---

## Local Development

### Move Contracts

```bash
cd move
sui move build
sui move test
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Environment variables are documented in `frontend/.env.example`.

---

## Roadmap

### Phase 0 — Hackathon MVP

- ✅ Move objects for datasets, campaigns, access tickets, usage records, and settlement.
- ✅ Testnet package deployment.
- 🔄 End-to-end demo flow from dataset upload to campaign settlement.
- 🔄 Frontend marketplace and role-based dashboards.
- 🔄 Toy model worker that proves authorised Walrus data was used.

### Phase 1 — Alpha

- Multi-dataset campaign composition across several retailers.
- More flexible pricing: per use, per volume, or per training hour.
- Stronger marketplace filters by category, region, time window, and schema.
- Provider and retailer dashboards with revenue, usage, and campaign charts.
- Pilot with sandbox data from 1-2 retailers or DTC brands.

### Phase 2 — Beta

- Production-grade AI workflows for demand forecasting, promotion simulation, and campaign insight.
- Standardised retail data schemas for product, basket, region, and channel data.
- Indexer-backed analytics for historical usage and revenue reporting.
- Integration with retail media networks, CDPs, and clean-room operators.
- Stablecoin settlement and stronger multi-party governance for upgrade authority.

### Phase 3 — Commercial Network

- A verified data marketplace for retail AI partnerships.
- Dataset certification and quality scoring.
- Enterprise audit exports for procurement, compliance, and model governance.
- Cross-market expansion beyond retail into supply chain and commerce intelligence.

---

## Judge Takeaway

**WalCoop solves the trust gap in AI data partnerships.** Retailers keep control, brands get verifiable data provenance, model providers receive programmable access, and revenue sharing happens automatically on-chain.

It is a hackathon-friendly MVP with a credible path to a commercial data infrastructure product.
