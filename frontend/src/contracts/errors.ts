// Maps Move abort messages (from `#[error]` constants) to user-facing strings.
// With `#[error]` annotations the CLI/RPC surfaces the byte message; we key on
// the constant name per module so the UI can show something human-readable.

export const MOVE_ERRORS: Record<string, Record<string, string>> = {
  dataset: {
    ENotOwner: 'Only the dataset owner can modify this dataset.',
    EInvalidRevShare: 'Revenue share must be between 1 and 10000 (basis points).',
    EInvalidPricingModel: 'Unknown pricing model.',
  },
  campaign: {
    ENotBuyer: 'Only the campaign creator (buyer) can perform this action.',
    ECampaignNotActive: 'The campaign is not active yet (payment required first).',
    EAlreadyFinalized: 'The campaign has already been settled or cancelled.',
    EEmptyBasket: 'A campaign must include at least one dataset.',
    EDatasetNotListed: 'This dataset is not listed yet.',
    EExpiryInPast: 'The licence expiry time must be in the future.',
    EUnderfunded: 'The budget is below the basket floor price; access licence cannot be issued.',
  },
  access: {
    EWrongProvider: 'Only the authorised model provider can decrypt.',
    EExpired: 'The access licence has expired.',
    ENoAccess: 'This dataset is not within the licensed scope.',
  },
  settlement: {
    EProviderMismatch: 'The ProviderCap does not match the model provider named in the campaign.',
    EDatasetOrderMismatch: 'The dataset order does not match what was recorded in the campaign.',
    EIncompleteSettlement: 'Not all datasets have been paid; settlement cannot complete.',
  },
};

/**
 * Best-effort extraction of a friendly message from a thrown Sui execution
 * error. Falls back to the raw message.
 */
export function parseMoveError(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);
  for (const mod of Object.keys(MOVE_ERRORS)) {
    for (const [name, friendly] of Object.entries(MOVE_ERRORS[mod])) {
      if (msg.includes(name)) return friendly;
    }
  }
  return msg;
}
