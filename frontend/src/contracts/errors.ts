// Maps Move abort messages (from `#[error]` constants) to user-facing strings.
// With `#[error]` annotations the CLI/RPC surfaces the byte message; we key on
// the constant name per module so the UI can show something human-readable.

export const MOVE_ERRORS: Record<string, Record<string, string>> = {
  dataset: {
    ENotOwner: '只有資料擁有者可以修改這個 dataset。',
    EInvalidRevShare: '分潤比例必須介於 1 到 10000 (基點)。',
    EInvalidPricingModel: '未知的定價模型。',
  },
  campaign: {
    ENotBuyer: '只有方案建立者 (買方) 可以執行這個操作。',
    ECampaignNotActive: '方案尚未啟用 (需先付款)。',
    EAlreadyFinalized: '方案已結算或已取消。',
    EEmptyBasket: '方案至少要包含一個 dataset。',
    EDatasetNotListed: '該 dataset 尚未上架。',
    EExpiryInPast: '授權到期時間必須在未來。',
    EUnderfunded: '預算低於資料組合的底價，無法取得使用授權。',
  },
  access: {
    EWrongProvider: '只有被授權的模型服務商可以解密。',
    EExpired: '存取授權已過期。',
    ENoAccess: '該 dataset 不在授權範圍內。',
  },
  settlement: {
    EProviderMismatch: 'ProviderCap 與方案指定的模型服務商不符。',
    EDatasetOrderMismatch: 'dataset 順序與方案中記錄的不一致。',
    EIncompleteSettlement: '尚未付款給所有 dataset，無法完成結算。',
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
