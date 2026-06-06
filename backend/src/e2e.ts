// End-to-end demo: one funded keypair plays every role (the Move contracts
// allow it). Exercises the full stack — Seal encrypt, Walrus store, and every
// on-chain step (register → update_blob → grant cap → create → fund → issue →
// decrypt → settle) through the Tatum gateway.
//
// PREREQUISITES (manual):
//   • backend/.env filled: TATUM_API_KEY, DATA_COOP_PACKAGE_ID,
//     SUI_PRIVATE_KEY (the DEPLOYER key — it owns PublisherCap), PUBLISHER_CAP_ID
//   • that address funded with testnet SUI AND WAL:
//       sui client faucet ; walrus get-wal --context testnet
//
// Run:  npm run e2e
import { ADDRESS } from './clients.js';
import { PACKAGE_ID } from './config.js';
import {
  grantProviderCap,
  createCampaign,
  fundCampaign,
  issueAccessTicket,
} from './contracts.js';
import { publishDataset, runModelWorker } from './pipeline.js';

const PUBLISHER_CAP_ID = process.env.PUBLISHER_CAP_ID;
const ONE_SUI = 1_000_000_000n;
const explorer = (id: string) => `https://suiscan.xyz/testnet/object/${id}`;
const step = (n: number, msg: string) => console.log(`\n[${n}] ${msg}`);

async function main() {
  if (!PUBLISHER_CAP_ID) throw new Error('Set PUBLISHER_CAP_ID in .env (deployer owns it)');
  console.log('signer / all roles :', ADDRESS);
  console.log('package            :', PACKAGE_ID);

  step(1, 'Publish dataset (Seal encrypt → Walrus → register + update_blob)…');
  const sales = '商品A,120\n商品A,80\n商品B,40\n商品C,30\n商品A,15\n';
  const { datasetId, blobId } = await publishDataset({
    name: '每日銷售彙總 (e2e)',
    data: new TextEncoder().encode(sales),
    unitPrice: ONE_SUI, // price floor = 1 SUI
    revShareBps: 10_000, // single dataset → 100%
  });
  console.log('  dataset :', explorer(datasetId));
  console.log('  walrus  :', blobId);

  step(2, 'Grant ProviderCap to self (model provider)…');
  const providerCapId = await grantProviderCap(PUBLISHER_CAP_ID, ADDRESS);
  console.log('  cap     :', explorer(providerCapId));

  step(3, 'Create campaign (self as model_provider) over the dataset…');
  const campaignId = await createCampaign(ADDRESS, [datasetId]);
  console.log('  campaign:', explorer(campaignId));

  step(4, 'Fund campaign (1 SUI ≥ price floor) → Active…');
  await fundCampaign(campaignId, ONE_SUI);

  step(5, 'Issue AccessTicket to provider…');
  const ticketId = await issueAccessTicket(campaignId, BigInt(Date.now() + 3_600_000));
  console.log('  ticket  :', explorer(ticketId));

  step(6, 'Model worker: Seal decrypt → toy-train → report → settle…');
  const { reportBlobId, digest } = await runModelWorker({
    campaignId,
    ticketId,
    providerCapId,
    datasets: [{ datasetId, walrusBlobId: blobId }],
  });
  console.log('  report  :', reportBlobId);
  console.log('  settle tx:', `https://suiscan.xyz/testnet/tx/${digest}`);

  console.log('\n✅ e2e complete — UsageRecord is frozen; revenue split on-chain.');
  console.log('   Verify payouts in the dApp Reports tab (campaign:', campaignId, ').');
}

main().catch((e) => {
  console.error('\n❌ e2e failed:', e.message ?? e);
  process.exit(1);
});
