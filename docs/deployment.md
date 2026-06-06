# Deployment Record — data_coop

## Testnet (Phase 0)

| | |
|---|---|
| **Date** | 2026-06-06 |
| **Network** | Sui Testnet (protocol 125) |
| **Package ID** | `0xb83403fe50e856b02c4b844cb9cc0cf2a8fe822161fdaf6619ae259fc0c8f286` |
| **UpgradeCap** | `0xcd5ec3ab61c1d2a6172aba55aad091aae695eeb947d6899a7cfd1d5877be7318` |
| **PublisherCap** | `0x68116443a48120b0b040a3763a897dfc28ff65e0b5f7ed11ab8d09acbde45bd6` |
| **Publish digest** | `B8GN1Hsmi5hf9XwtxdLgN5SfbYQTiQ4Sxv5okmArL5mJ` |
| **Deployer / admin** | `0x1509b5fdf09296b2cf749a710e36da06f5693ccd5b2144ad643b3a895abcbc4c` |
| **Gas cost** | ~0.0748 SUI |

### Cap custody (Phase 0 = single-sig)
- `UpgradeCap` and `PublisherCap` are both held by the deployer address.
- **Before mainnet**: transfer `UpgradeCap` to a multisig (see threat-model residual risks).

### Explorer
- https://suiscan.xyz/testnet/object/0xb83403fe50e856b02c4b844cb9cc0cf2a8fe822161fdaf6619ae259fc0c8f286

### Upgrade command (when needed)
```bash
cd move
sui client upgrade --gas-budget 200000000 \
  --upgrade-capability 0xcd5ec3ab61c1d2a6172aba55aad091aae695eeb947d6899a7cfd1d5877be7318
```

> CLI note: local CLI protocol is 122 vs network 125 — publish succeeded, but
> consider updating the CLI before the next upgrade to avoid dependency
> verification errors.
