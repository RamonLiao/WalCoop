// Demo runner: end-to-end Dataset Pipeline (encrypt → Walrus → Sui via Tatum).
//   npm run pipeline -- publish "每日銷售彙總" path/to/data.csv 1 60
//   npm run pipeline -- settle <campaignId> <ticketId> <providerCapId> <datasetId>:<blobId> ...
import { readFileSync } from 'node:fs';
import { publishDataset, runModelWorker } from './pipeline.js';
import { ADDRESS } from './clients.js';

const [cmd, ...rest] = process.argv.slice(2);

async function main() {
  if (cmd === 'publish') {
    const [name, file, price = '1', pct = '50'] = rest;
    const data = file ? new Uint8Array(readFileSync(file)) : new TextEncoder().encode('sku-a\nsku-a\nsku-b\n');
    const out = await publishDataset({
      name,
      data,
      unitPrice: BigInt(Math.round(Number(price) * 1e9)),
      revShareBps: Math.round(Number(pct) * 100),
    });
    console.log('Published:', out);
  } else if (cmd === 'settle') {
    const [campaignId, ticketId, providerCapId, ...pairs] = rest;
    const datasets = pairs.map((p) => {
      const [datasetId, walrusBlobId] = p.split(':');
      return { datasetId, walrusBlobId };
    });
    const out = await runModelWorker({ campaignId, ticketId, providerCapId, datasets });
    console.log('Settled:', out);
  } else {
    console.log(`signer: ${ADDRESS}`);
    console.log('usage:\n  publish <name> <file> [priceSui] [revPct]\n  settle <campaignId> <ticketId> <providerCapId> <datasetId:blobId>...');
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
