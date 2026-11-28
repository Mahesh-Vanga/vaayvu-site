'use strict';
/**
 * Vaayvu AI guard — local-first context handling for opt-in AI.
 *
 * The guard never calls a model. It redacts obvious secrets, detects common
 * prompt-injection phrasing, enforces input/token budgets and gates agent
 * actions. The sync server still treats all page text as untrusted data.
 */
const VaayvuAiGuard = (() => {
  const MAX_PAGE_CHARS = 32000;
  const MAX_QUESTION_CHARS = 2000;
  const MAX_INPUT_TOKENS = 8000;
  const MAX_OUTPUT_TOKENS = 768;

  const SECRETS = [
    /-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/g,
    /\bBearer\s+[^\s]+/g,
    /\b(?:api[_-]?key|access[_-]?token|password|passwd|secret)\s*[:=][^\n]*/gi,
    /\b\d{4}[- ]?\d{4}[- ]?\d{4}[- ]?\d{4}\b/g,
    /\b\d{3}-\d{2}-\d{4}\b/g,
  ];

  const INJECTION = [
    /ignore (?:all |any )?(?:previous|prior|above) (?:instructions|rules|prompts)/i,
    /disregard (?:the )?(?:system|developer|previous) (?:prompt|instructions)/i,
    /reveal (?:the )?(?:system|developer) (?:prompt|message)/i,
    /you are now (?:a|an|the) /i,
    /(?:system|developer) message\s*:/i,
    /(?:send|upload|post|exfiltrate) (?:the |all )?(?:user )?(?:data|cookies|passwords|history|tokens)/i,
    /(?:call|invoke|run) (?:the )?(?:tool|function|command)\s*[:(]/i,
    /<\|(?:system|assistant|endoftext)\|>/i,
    /\[\/?(?:INST|SYS)\]/i,
  ];

  const READ_ONLY_ACTIONS = new Set([
    'summarize', 'compare', 'explain', 'find', 'translate-preview', 'cite',
  ]);
  const APPROVAL_ACTIONS = new Set([
    'fill-form', 'download', 'share', 'navigate', 'copy', 'bookmark', 'draft-email',
  ]);
  const DESTRUCTIVE_ACTIONS = new Set([
    'delete', 'purchase', 'pay', 'send-message', 'submit-payment', 'change-password',
  ]);

  const redact = (value) => {
    let text = typeof value === 'string' ? value : '';
    for (const pattern of SECRETS) text = text.replace(pattern, '[redacted]');
    return text.slice(0, MAX_PAGE_CHARS);
  };

  const detectInjection = (value) => {
    const text = typeof value === 'string' ? value : '';
    const matches = [];
    for (const pattern of INJECTION) {
      const found = text.match(pattern);
      if (found) matches.push(found[0].slice(0, 120));
    }
    return { detected: matches.length > 0, risk: matches.length > 1 ? 'high' : matches.length ? 'medium' : 'none', matches };
  };

  const estimateTokens = (value) => Math.ceil(String(value || '').length / 4);

  function costGate({ text = '', question = '', maxTokens = MAX_INPUT_TOKENS } = {}) {
    const q = String(question || '').trim();
    if (!q || q.length > MAX_QUESTION_CHARS) {
      return { allowed: false, reason: 'Use a question of 1–' + MAX_QUESTION_CHARS + ' characters.', tokens: 0 };
    }
    if (!text.trim()) return { allowed: false, reason: 'Select page text first.', tokens: 0 };
    const tokens = estimateTokens(text) + estimateTokens(q);
    if (tokens > maxTokens) {
      return { allowed: false, reason: 'Selected context is too large. Narrow the selection.', tokens };
    }
    return { allowed: true, reason: '', tokens, maxOutputTokens: MAX_OUTPUT_TOKENS };
  }

  function agentDecision(action, { approved = false } = {}) {
    const name = String(action || '');
    if (READ_ONLY_ACTIONS.has(name)) return { allowed: true, requiresApproval: false, reason: '' };
    if (DESTRUCTIVE_ACTIONS.has(name)) return { allowed: false, requiresApproval: true, reason: 'This action needs explicit human approval and is not run by the assistant.' };
    if (APPROVAL_ACTIONS.has(name)) {
      return approved
        ? { allowed: true, requiresApproval: true, reason: '' }
        : { allowed: false, requiresApproval: true, reason: 'Approve this action before it runs.' };
    }
    return { allowed: false, requiresApproval: true, reason: 'Unknown action is blocked.' };
  }

  function buildContext(value) {
    const text = redact(value);
    return {
      text,
      injection: detectInjection(text),
      tokens: estimateTokens(text),
      untrusted: true,
    };
  }

  return {
    MAX_PAGE_CHARS,
    MAX_QUESTION_CHARS,
    MAX_INPUT_TOKENS,
    MAX_OUTPUT_TOKENS,
    redact,
    detectInjection,
    estimateTokens,
    costGate,
    agentDecision,
    buildContext,
  };
})();
if (typeof module !== 'undefined' && module.exports) module.exports = VaayvuAiGuard;
