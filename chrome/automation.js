'use strict';
/**
 * Guarded automation contract: plan -> dry-run -> approval -> receipt.
 * This module performs no browser action by itself. Callers pass handlers and
 * the engine refuses unconsented context, unapproved actions and destructive
 * steps. It is not yet wired to a shipping automation UI.
 */
const VaayvuAutomation = (() => {
  const guard = typeof require === 'function' ? require('./ai-guard.js') : globalThis.VaayvuAiGuard;
  const MAX_STEPS = 20;
  const MAX_TEXT = 2000;

  const clean = (value, max = MAX_TEXT) => String(value ?? '').replace(/\s+/g, ' ').trim().slice(0, max);

  function plan(steps, { consent = false, pageUrl = '' } = {}) {
    if (!Array.isArray(steps) || !steps.length || steps.length > MAX_STEPS) throw new Error('Use 1–20 automation steps.');
    const planned = steps.map((step, index) => {
      const action = clean(step?.action, 64);
      const detail = clean(step?.detail, MAX_TEXT);
      const decision = guard.agentDecision(action, { approved: false });
      const injection = guard.detectInjection(detail);
      const destructive = ['delete', 'purchase', 'pay', 'send-message', 'submit-payment', 'change-password'].includes(action);
      const unknown = /Unknown action is blocked/i.test(decision.reason || '');
      const blocked = destructive || unknown || injection.detected || (!decision.allowed && !decision.requiresApproval);
      return {
        index,
        action,
        detail,
        allowed: decision.allowed,
        requiresApproval: decision.requiresApproval && !blocked,
        blocked,
        reason: injection.detected ? 'Prompt injection detected in the step.' : decision.reason,
      };
    });
    return {
      id: 'plan-' + Date.now().toString(36),
      createdAt: Date.now(),
      consent: consent === true,
      pageUrl: clean(pageUrl, 8192),
      steps: planned,
      dryRun: true,
      executable: consent === true && planned.every((step) => !step.blocked || step.requiresApproval === false),
    };
  }

  function approve(value, { approvedBy = '' } = {}) {
    if (!value || value.dryRun !== true) throw new Error('Approve a dry-run plan first.');
    if (value.steps.some((step) => step.blocked && !step.requiresApproval)) throw new Error('The plan contains blocked steps.');
    if (!clean(approvedBy, 120)) throw new Error('Record who approved the plan.');
    return {
      planId: value.id,
      token: 'approval-' + Date.now().toString(36),
      approvedBy: clean(approvedBy, 120),
      approvedAt: Date.now(),
      actions: value.steps.filter((step) => step.requiresApproval).map((step) => step.action),
      singleUse: true,
    };
  }

  async function execute(value, approval, { consent = false, handlers = {}, url = '' } = {}) {
    if (!value || value.dryRun !== true) throw new Error('A dry-run plan is required.');
    if (consent !== true) throw new Error('Explicit context consent is required.');
    if (!value.consent) throw new Error('The plan was created without context consent.');
    if (!clean(url, 8192) || (value.pageUrl && url !== value.pageUrl)) throw new Error('Context does not match the approved page.');
    if (value.steps.some((step) => step.blocked && !step.requiresApproval)) throw new Error('Blocked steps cannot execute.');
    const needsApproval = value.steps.some((step) => step.requiresApproval);
    if (needsApproval && (!approval || approval.planId !== value.id || !approval.token)) throw new Error('Approval is required.');
    const receipt = {
      planId: value.id,
      approvedBy: approval?.approvedBy || '',
      startedAt: Date.now(),
      results: [],
    };
    for (const step of value.steps) {
      if (step.blocked) {
        receipt.results.push({ action: step.action, status: 'blocked', reason: step.reason });
        continue;
      }
      const handler = handlers[step.action];
      if (typeof handler !== 'function') {
        receipt.results.push({ action: step.action, status: 'skipped', reason: 'No handler supplied.' });
        continue;
      }
      try {
        await handler(step.detail);
        receipt.results.push({ action: step.action, status: 'done' });
      } catch (error) {
        receipt.results.push({ action: step.action, status: 'failed', reason: clean(error?.message, 200) });
      }
    }
    receipt.finishedAt = Date.now();
    receipt.ok = receipt.results.every((result) => result.status !== 'failed');
    return receipt;
  }

  return { MAX_STEPS, plan, approve, execute };
})();
if (typeof module !== 'undefined') module.exports = VaayvuAutomation;
