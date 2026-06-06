export * from './types';
export * from './errors';
export {
  DataCoopClient,
  parseDataset,
  parseCampaign,
  parseAccessTicket,
  parseUsageRecord,
} from './dataCoop';

/** Package id — set from env after deployment. */
export const PACKAGE_ID = (import.meta as any).env?.VITE_DATA_COOP_PACKAGE_ID ?? '0x0';
