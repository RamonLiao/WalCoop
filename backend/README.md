# WalCoop Backend — Walrus + Seal pipeline

Off-chain pipeline that completes Flow A/B's off-chain half. All Sui RPC goes
through the **Tatum gateway** (API key stays server-side).

## What it does

**Dataset Pipeline** (`POST /datasets`)
1. `register_dataset` (placeholder) → get the Dataset object id
2. Seal-encrypt the data under `id = dataset object id` (matches `access::seal_approve`)
3. store ciphertext on **Walrus** (`writeBlob`)
4. `update_blob` to bind the Dataset to the real Walrus blob

**Model Worker** (`POST /settle`)
1. `SessionKey.create` (signed by the provider keypair)
2. per dataset: build the `seal_approve` PTB → key servers dry-run it → `readBlob` + Seal `decrypt`
3. toy-train → write report to Walrus
4. `settle_campaign` (begin → pay×N → finish) — revenue split on-chain

## Setup

```bash
cp .env.example .env   # fill TATUM_API_KEY, SUI_PRIVATE_KEY, PROVIDER_CAP_ID
npm install
npm run typecheck
npm start              # express on :8787
# or one-shot:
npm run pipeline -- publish "每日銷售彙總" data.csv 1 60
```

## Requirements / honest status

- ✅ Typecheck clean; runtime-verified: Tatum transport + Seal/Walrus client
  construction (real checkpoint read through Tatum).
- ⚠️ Live publish/settle needs the backend keypair funded with **testnet SUI +
  WAL** (`walrus get-wal --context testnet`), and a **ProviderCap** granted to
  the backend address (and that address set as the campaign's `model_provider`).
- ⚠️ The `signAndExecuteTransaction` result-shape and created-object extraction
  use a tolerant adapter (`contracts.ts`) — verify against the live effects
  shape on first run.
