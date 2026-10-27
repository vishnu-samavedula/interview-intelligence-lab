/** Narrow display normalization for conventional US annual-salary shorthand.
 * Never changes extraction field assignment or source quotes; raw model output remains in the audit.
 */
export function normalizeSalary(fieldId, value, evidence = [], responses = new Map()) {
  if (!['current_salary', 'target_salary'].includes(fieldId) || typeof value !== 'string') return value;
  const context = evidence.map(item => {
    const response = responses.get(item.turn_id ?? item.turnId);
    return `${response?.interviewer || ''} ${response?.candidate || item.quote || ''}`;
  }).join(' ');
  const text = `${value} ${context}`;
  // These units/currencies make an implicit US annual-thousands assumption unsafe.
  if (/[€£₹¥]|\b(?:EUR|GBP|INR|JPY|CAD|AUD|CNY|euro|euros|pounds|rupees|Canadian|Australian)\b/i.test(text)
    || /\b(?:hourly|monthly|weekly|daily|allowance|stipend)\b|\/(?:hr|hour|mo|month|wk|week|day)\b|\bper\s+(?:hour|month|week|day)\b|\ban?\s+hour\b/i.test(text)) return value;
  if (!/\b(?:annual|annually|yearly|salary|salaries|base|compensation|comp|earn|earning)\b|\bper\s+year\b|\bfor\s+(?:a\s+)?move\b/i.test(text)) return value;
  // Operate only on amounts at the start or introduced as a salary/base amount.
  // This leaves bonuses, percentages, years and other later numbers untouched.
  const amount = '(?:\\$\\s*)?(\\d{2,3}(?:\\.\\d+)?)(\\s*(?:k|thousand)\\b)?';
  const pattern = new RegExp(`(^|\\b(?:around|about|approximately|base(?:\\s+of)?|salary(?:\\s+of)?|target(?:ing)?|between|earn(?:ing)?|comp(?:ensation)?(?:\\s+of)?|in(?:\\s+the)?)\\s+)${amount}(?:\\s*(?:to|[-–—])\\s*${amount})?`, 'gi');
  const normalized = value.replace(pattern, (match, prefix, first, firstUnit, second, secondUnit, offset, original) => {
    const after = original.slice(offset + match.length);
    if (/^\s*(?:%|percent\b)/i.test(after)) return match;
    // Do not partially match a full amount or a unit/currency we do not handle.
    if (/^[\d,.]/.test(after) || /^\s*(?:million|USD\b|dollars?\b)/i.test(after) && !firstUnit && !secondUnit) return match;
    const nums = [first, ...(second ? [second] : [])].map(Number);
    if (nums.some(n => n < 50 || n >= 500)) return match;
    const money = n => '$' + Math.round(n * 1000).toLocaleString('en-US');
    return prefix + nums.map(money).join('–');
  });
  return normalized;
}
