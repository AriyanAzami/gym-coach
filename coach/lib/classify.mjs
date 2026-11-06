/* Turns a failed run's log into one of a fixed set of phrases.

   The coach's log may contain training data, so it is never printed and never
   stored. But "the job failed" with no reason is useless when the cause is an
   expired token. Classifying solves both: the log is matched against known
   signatures and only the matched category — a constant string from the list
   below, chosen before any log existed — leaves this function.

   Anything unrecognised is "unclassified". It is never summarised, never
   excerpted and never echoed. */

export const CATEGORIES = [
  'claude authentication failed',
  'claude quota or rate limit',
  'a command was missing',
  'a tool was refused by the permission rules',
  'hit the turn limit without finishing',
  'timed out',
  'the plan never passed the validator',
  'the coach wrote nothing',
  'unclassified',
];

/* Order matters: the first match wins, so the more specific causes come first. */
const SIGNATURES = [
  [/invalid api key|authentication_error|oauth token|unauthorized|\b401\b|not logged in|please run .?claude (auth )?login/i,
    'claude authentication failed'],
  [/credit balance|quota|rate.?limit|\b429\b|usage limit/i,
    'claude quota or rate limit'],
  [/\bENOENT\b|command not found|: not found|is not recognized as/i,
    'a command was missing'],
  [/requested permissions|permission denied to use|not allowed to use|has not been granted/i,
    'a tool was refused by the permission rules'],
  [/max.?turns|reached the turn limit/i,
    'hit the turn limit without finishing'],
  [/timed out|timeout|ETIMEDOUT/i,
    'timed out'],
  [/problems? to fix:|\bvalidate\.mjs\b.*\bfail/i,
    'the plan never passed the validator'],
];

export function classifyFailure(log) {
  if (!log || String(log).trim() === '') return 'the coach wrote nothing';
  const text = String(log);
  for (const [pattern, category] of SIGNATURES) {
    if (pattern.test(text)) return category;
  }
  return 'unclassified';
}
