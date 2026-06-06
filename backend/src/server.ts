import express from 'express';
import { publishDataset, runModelWorker } from './pipeline.js';
import { ADDRESS } from './clients.js';
import { PACKAGE_ID, PORT, NETWORK } from './config.js';

const app = express();
app.use(express.json({ limit: '10mb' }));

app.get('/health', (_req, res) => {
  res.json({ ok: true, network: NETWORK, packageId: PACKAGE_ID, backendAddress: ADDRESS });
});

// Dataset Pipeline: encrypt (Seal) → store (Walrus) → register/update (Sui via Tatum).
// Body: { name, data (utf-8 string), unitPriceSui, revSharePct }
app.post('/datasets', async (req, res) => {
  try {
    const { name, data, unitPriceSui, revSharePct } = req.body ?? {};
    if (!name || typeof data !== 'string') {
      return res.status(400).json({ error: 'name and data (string) required' });
    }
    const result = await publishDataset({
      name,
      data: new TextEncoder().encode(data),
      unitPrice: BigInt(Math.round(Number(unitPriceSui ?? 1) * 1e9)),
      revShareBps: Math.round(Number(revSharePct ?? 50) * 100),
    });
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: (e as Error).message });
  }
});

// Model Worker: decrypt (Seal) → toy-train → report (Walrus) → settle (Sui via Tatum).
// Body: { campaignId, ticketId, providerCapId, datasets:[{datasetId, walrusBlobId}] }
app.post('/settle', async (req, res) => {
  try {
    const { campaignId, ticketId, providerCapId, datasets } = req.body ?? {};
    if (!campaignId || !ticketId || !providerCapId || !Array.isArray(datasets)) {
      return res.status(400).json({ error: 'campaignId, ticketId, providerCapId, datasets[] required' });
    }
    const result = await runModelWorker({ campaignId, ticketId, providerCapId, datasets });
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: (e as Error).message });
  }
});

app.listen(PORT, () => {
  console.log(`WalCoop backend on :${PORT} — ${NETWORK} via Tatum, signer ${ADDRESS}`);
});
