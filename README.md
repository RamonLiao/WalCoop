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

## Business Model

WalCoop monetises the growing market for AI-ready first-party retail data by taking a platform fee on verifiable data campaigns.

A brand funds a campaign, selects retailer datasets, and pays for time-bound, purpose-bound access rather than raw file ownership. The budget is locked on Sui, the model provider receives authorised access through `AccessTicket`, and settlement automatically splits revenue between dataset owners, model providers, and WalCoop.

**Why this can become venture-scale:** WalCoop is not a data broker selling files. It is a programmable settlement layer for AI data rights. As more retailers contribute datasets, brands get better coverage, model providers get easier access, and dataset reputation compounds into a network effect.

**Investor takeaway:** WalCoop is building the retail data co-op layer for the AI economy: marketplace GMV today, recurring workflow revenue tomorrow, and protocol-level data rights infrastructure long term.

Revenue streams: campaign take rate, SaaS subscriptions, enterprise onboarding, and dataset certification.

---

## Use Cases

- **Retailers and DTC brands** upload anonymised sales, basket, loyalty, or product performance data, then earn whenever their datasets are used.
- **Brands and advertisers** fund campaigns, select trusted retail datasets, and receive auditable AI reports for forecasting, category trends, or campaign insight.
- **AI and analytics providers** receive campaign-scoped access, run authorised model pipelines, publish reports, and get paid automatically.

---

## Main Features

- 🧩 **Dataset registration:** encrypted retailer datasets become Sui `Dataset` objects pointing to Walrus blobs and schema manifests.
- 🔐 **Policy-bound access:** campaign-specific `AccessTicket` objects define who can decrypt which datasets and when access expires.
- 💰 **Automatic settlement:** funded campaigns distribute revenue to dataset owners and model providers according to configured weights.
- 📊 **Verifiable AI reports:** output reports are uploaded to Walrus, with usage hashes and report blob IDs written back to Sui.
- 🧑‍💼 **Role-based dApp:** retailer, brand, and model provider dashboards map directly to the end-to-end commercial flow.

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

## Why Walrus + Sui Is Not Replaceable Here

This is not just decentralised file storage. The product depends on the combination of:

- **Large data off-chain:** datasets can be GB-scale or larger, so they cannot live directly on-chain.
- **Verifiable availability:** Walrus provides a verifiable data layer for dataset and report blobs.
- **Programmable rights:** Sui objects represent datasets, campaigns, tickets, and settlement records.
- **Policy-bound decryption:** Seal checks the on-chain `AccessTicket` before releasing decryption shares.
- **Automatic revenue sharing:** the same contract that grants access also settles usage.

Core objects include `Dataset`, `Campaign<T>`, `AccessTicket`, and `UsageRecord`. See [`docs/specs/`](docs/specs/) for deeper technical details.

---

## Hackathon Demo Flow

1. A retailer uploads an anonymised CSV, which is encrypted, stored on Walrus, and registered as a Sui `Dataset`.
2. A brand selects datasets, funds a campaign, and issues an `AccessTicket` to the model provider.
3. The model provider decrypts only authorised data through Seal, runs analysis, and uploads the report to Walrus.
4. `settle_campaign` writes a `UsageRecord`, splits funds automatically, and lets the brand verify which datasets produced the report.

---

## Repository Structure

- [`BUSINESS_SPEC.md`](BUSINESS_SPEC.md): original business specification.
- [`BUSINESS_SPEC.en-GB.md`](BUSINESS_SPEC.en-GB.md): UK English business specification for judges and investors.
- [`docs/`](docs/): deployment, security, and technical specs.
- [`frontend/`](frontend/): React + Vite dApp.
- [`move/`](move/): Sui Move smart contracts and tests.

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

- **Phase 0 — Hackathon MVP:** deployed Move package, dataset/campaign/access/settlement objects, role-based dApp, and demo worker flow.
- **Phase 1 — Alpha:** multi-retailer campaigns, richer pricing, marketplace filters, dashboards, and pilots with sandbox retail data.
- **Phase 2 — Beta:** production forecasting and campaign insight workflows, standard schemas, indexer-backed analytics, and stablecoin settlement.
- **Phase 3 — Commercial Network:** verified retail AI data marketplace with certification, enterprise audit exports, and expansion into adjacent commerce data verticals.

---

## Judge Takeaway

**WalCoop turns fragmented retail data into a verifiable AI revenue network.** Retailers keep control, brands buy auditable data rights, model providers receive programmable access, and WalCoop earns as campaign GMV and enterprise workflows scale.

It is a hackathon-friendly MVP with a credible path to a commercial data infrastructure product.
