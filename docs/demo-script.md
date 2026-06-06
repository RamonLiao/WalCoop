# WalCoop — Demo Recording Script (2–3 min)

> Single wallet plays all three roles (deployer == backend signer == wallet).
> Switch roles with the top-right dropdown. Network: **Sui Testnet**, reads via **Tatum**.
> Have the wallet unlocked and funded before recording.

**Pre-flight (don't record):** `cd frontend && npm run dev` → open the URL, connect wallet, switch role to **Data Provider**, hard-refresh once so Tatum reads are warm.

---

## 0:00–0:20 — Hook (Landing page, role = Data Provider)

**On screen:** Landing hero.

> "This is WalCoop — a data co-operative on Sui and Walrus. Retailers turn anonymised
> sales data into a *verifiable* AI asset, brands buy it transparently, and every
> contributor gets paid by on-chain rules — not a black-box report."

Point at the three steps: **List → Campaign → Settle**. Note the **Powered by Tatum** chip.

## 0:20–0:50 — List a dataset (role = Data Provider)

1. Top nav → **Dataset Marketplace**.
2. In **Register your dataset**: Name = `Daily product sales summary, UK`, Unit price `1`, Revenue share `50`.
3. Click **List dataset** → approve in wallet.

> "As a retailer I register a dataset. Only anonymised, aggregated data is listed —
> the raw PII never leaves my systems. The dataset is now a shared object on Sui."

Wait for the toast **"Dataset registered on Sui"** and the new card to appear (Listed, Rev share 50%).

## 0:50–1:10 — Authorise a model provider (role = Data Provider, Admin panel)

1. Top nav → **Usage Records**.
2. **Issue a model-provider authorisation**: PublisherCap auto-selected; provider = **Myself**.
3. Click **Issue ProviderCap** → approve. Copy the new ProviderCap id (shown).

> "The platform admin issues a ProviderCap — this is the capability that lets a model
> provider settle a campaign later. Access control is enforced on-chain."

## 1:10–1:50 — Create & fund a campaign (switch role → Brand)

1. Switch role (top-right) → **Brand**.
2. Top nav → **Campaigns** → **Create a campaign**.
3. Model provider = **Myself**. Tick the dataset just listed. Note **Floor total**.
4. Click **Create campaign** → approve. Status shows **Awaiting Payment**.
5. On the new card, click **Pay & authorise** → approve.

> "As a brand I bundle datasets into a campaign, name the model provider, then pay.
> One transaction funds the budget *and* issues a time-limited access licence — so the
> provider can decrypt the data, and only for as long as the licence is valid."

Status flips to **Active**.

## 1:50–2:30 — Settle & verify (switch role → Model Provider)

1. Switch role → **Model Provider**.
2. On the campaign card, ProviderCap auto-selected → click **Settle revenue share** → approve.

> "The model provider settles. Revenue is split automatically to every data provider,
> and a frozen UsageRecord receipt is written on-chain."

3. Toast **"Settlement complete"**. Click **View revenue breakdown →**.
4. On **Usage Records**: show the table — Dataset → Revenue share in SUI.

> "Anyone can pull this UsageRecord and verify exactly who got paid what. That's the
> whole point — trust is settled on-chain, not asserted in a PDF."

## 2:30–2:45 — Close

> "Retail data, made verifiable and fairly monetised — on Sui, with Walrus for storage
> and Tatum for reads. That's WalCoop."

---

## Recording tips
- Keep the wallet pop-up quick: pre-approve / use a low-friction wallet.
- If a card doesn't appear instantly, the Tatum read node lags one checkpoint — the app
  auto-refetches after ~1.5s; just wait, don't click again.
- Record at 1280×800+ so the sidebar stays visible (below 980px it collapses).
- Total hands-on time ≈ 6 wallet approvals; rehearse once to stay under 3 min.
