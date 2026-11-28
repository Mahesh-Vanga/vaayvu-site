# Guarded automation and intelligent assistance (P25)

P25 covers dry-run plans, explicit approval, receipts, context consent and
prompt-injection handling. The contract is executable; no shipping executor is
wired to the screens.

## Contract

`chrome/automation.js`:

1. **Plan** — 1–20 steps. Each step is classified:
   - read-only (`summarize`, `compare`, `explain`, `find`, `cite`) runs without
     approval;
   - approval actions (`fill-form`, `download`, `navigate`, `share`, `copy`,
     `bookmark`, `draft-email`) need a named approver;
   - destructive actions (`delete`, `purchase`, `pay`, `send-message`,
     `submit-payment`, `change-password`) and unknown actions are blocked.
2. **Dry run** — returns the classification without side effects.
3. **Approve** — records who approved, refuses blocked plans, issues a
   single-use token.
4. **Execute** — requires:
   - explicit `consent: true`;
   - the plan was created with consent;
   - the URL matches the planned page;
   - approval for any approval-required step;
   - no blocked steps.
5. **Receipt** — records action, status and reason only. Page text and step
   details are never copied into the receipt.

The engine performs no action by itself. Handlers are supplied by a caller, so
this is a policy/contract layer, not a fake executor.

## No unconsented context

- A plan without consent is not executable.
- Execution rejects a missing consent flag, a mismatched URL or a plan created
  without consent.
- The AI guard (P13) already blocks private pages, redacts secrets and caps
  context.

## Prompt injection

- Step details run through `VaayvuAiGuard.detectInjection`.
- An injected step is blocked and cannot be approved.
- The P13 server tests keep page text wrapped as untrusted JSON with no tools.

## Receipts

Receipts contain `planId`, approver, timestamps, action names, statuses and
short reasons. They do not contain the page text or step detail, so a receipt
cannot leak selected context.

## Shipping gap

The workflow library, builder, dry-run, monitor, approval and receipt screens
(`s-486`–`s-491`) are **contracts**. There is no shipping automation runtime,
scheduler or action executor. The module is the policy layer a future runtime
must call.

## Exit gate

| Gate item | State |
|---|---|
| Dry-run | **Green** |
| Approval | **Green** (named, single-use, blocked-plan refusal) |
| Receipts | **Green** (no page text) |
| No unconsented context | **Green** |
| Prompt-injection tests | **Green** |
| Shipping executor | **Gap** |
| Gate met | **Yes, locally** for the contract |

P25's named gate is green at the contract level. A real automation executor is
still a product gap.
