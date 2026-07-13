/**
 * AI Classification Pipeline
 *
 *   Step 1 — Custom rule-based algorithm → category, team, priority + confidence score
 *   Step 2 — Cache/DB check → if near-identical issue seen recently, reuse (skip AI call)
 *   Step 3 — High confidence: keep custom classification, call Vertex AI for draft only
 *             Low confidence:  call Vertex AI for full classification + draft
 *   Step 4 — Fallback to custom result + template draft if Vertex AI unavailable
 *
 * Uses @google/genai with Vertex AI backend (service account via GOOGLE_SERVICE_ACCOUNT_JSON)
 */

import { buildGoogleAIClient } from './googleai';

// ─── Constants ────────────────────────────────────────────────────────────────

const CATEGORIES = ['Billing', 'Bug', 'Feature Request', 'HR', 'Other'];
const TEAMS      = ['Development', 'Billing', 'HR', 'Support'];
const PRIORITIES = ['Low', 'Medium', 'High'];

const HIGH_CONFIDENCE_THRESHOLD = 0.70;

// ─── Step 1: Custom Rule-Based Classifier ────────────────────────────────────

const RULES = [
  {
    phrases: [
      'charged twice', 'double charge', 'duplicate charge', 'overcharged',
      'wrong amount', 'incorrect charge', 'payment failed', 'payment declined',
      'payment issue', 'refund request', 'refund my', 'billing error',
      'credit card', 'debit card', 'money back', 'subscription charge',
      'subscription cancelled', 'invoice payment', 'pay for', 'charged for',
    ],
    category: 'Billing', team: 'Billing', priority: 'High', weight: 3.0,
  },
  {
    phrases: [
      'not working', 'not loading', 'not showing', 'not displaying', 'not visible',
      'not found', 'cannot login', "can't login", 'login failed', 'login error',
      'page crash', 'app crash', 'crashes when', 'blank screen', 'white screen',
      'error 500', 'error 404', '500 error', '404 error', 'internal server error',
      'throws error', 'getting error', 'shows error', 'exception',
      'broken', 'not responding', 'keeps freezing', 'not opening',
      'fails to load', 'failed to', 'stuck on', 'missing data', 'data not',
      'records not', 'button not',
    ],
    category: 'Bug', team: 'Development', priority: 'High', weight: 3.0,
  },
  {
    phrases: [
      'feature request', 'please add', 'can you add', 'would like to have',
      'would be great', 'suggest adding', 'nice to have',
      'dark mode', 'add support for', 'add the ability', 'new feature',
      'could you implement', 'enhancement', 'improvement request',
    ],
    category: 'Feature Request', team: 'Development', priority: 'Low', weight: 2.5,
  },
  {
    phrases: [
      'leave request', 'annual leave', 'sick leave', 'maternity leave',
      'paternity leave', 'leave balance', 'leave approval', 'leave pending',
      'payroll issue', 'salary problem', 'salary discrepancy', 'wrong salary',
      'hr policy', 'hr team', 'onboarding', 'offboarding',
      'performance review', 'promotion request', 'contract issue', 'benefits',
    ],
    category: 'HR', team: 'HR', priority: 'Medium', weight: 3.0,
  },
  {
    phrases: [
      'how do i', 'how to', 'i need help', 'need assistance',
      'forgot password', 'password reset', 'reset my password', 'lost access',
      'account locked', 'cannot access', 'set up', 'configure',
      'getting started', 'user guide', 'documentation', 'tutorial',
    ],
    category: 'Other', team: 'Support', priority: 'Low', weight: 1.5,
  },
];

const PRIORITY_OVERRIDES = {
  High: ['urgent', 'critical', 'asap', 'immediately', 'emergency', 'blocking',
         'cannot work', 'production down', 'data loss', 'security issue', 'severe'],
  Low:  ['minor', 'not urgent', 'nice to have', 'eventually', 'low priority'],
};

function normalise(text) {
  return text.toLowerCase().replace(/[^a-z0-9\s]/g, ' ');
}

function countPhraseMatches(text, phrases) {
  const n = normalise(text);
  return phrases.filter(p => n.includes(p)).length;
}

function customClassify(subject, description) {
  const text   = `${subject} ${description}`;
  const scores = {};

  console.log('\n┌─────────────────────────────────────────────────────────');
  console.log(`│ [classifier] Rule-based scan`);
  console.log(`│ Subject     : "${subject}"`);
  console.log(`│ Description : "${description.substring(0, 80)}${description.length > 80 ? '…' : ''}"`);
  console.log('├─────────────────────────────────────────────────────────');

  for (const rule of RULES) {
    const matched = rule.phrases.filter(p => normalise(text).includes(p));
    if (matched.length > 0) {
      const contribution = matched.length * rule.weight;
      scores[rule.category] = (scores[rule.category] || 0) + contribution;
      console.log(`│  ✓ [${rule.category.padEnd(16)}] matched ${matched.length} phrase(s) × weight ${rule.weight} = +${contribution.toFixed(1)}`);
      console.log(`│    phrases: ${matched.map(p => `"${p}"`).join(', ')}`);
    } else {
      console.log(`│  ✗ [${rule.category.padEnd(16)}] no matches`);
    }
  }

  if (Object.keys(scores).length === 0) {
    console.log('│  → No rule matched → fallback: Other / Support / Medium / conf=0');
    console.log('└─────────────────────────────────────────────────────────\n');
    return { category: 'Other', team: 'Support', priority: 'Medium', confidence: 0 };
  }

  const sorted     = Object.entries(scores).sort((a, b) => b[1] - a[1]);
  const [topCat, topScore] = sorted[0];
  const totalScore = sorted.reduce((s, [, v]) => s + v, 0);
  const confidence = totalScore > 0 ? topScore / totalScore : 0;

  console.log('├─────────────────────────────────────────────────────────');
  console.log('│  Score board:');
  sorted.forEach(([cat, score]) => {
    const pct   = ((score / totalScore) * 100).toFixed(1);
    const bar   = '█'.repeat(Math.round(score / totalScore * 20));
    const arrow = cat === topCat ? ' ◄ winner' : '';
    console.log(`│    ${cat.padEnd(18)} ${score.toFixed(1).padStart(5)} pts  ${pct.padStart(5)}%  ${bar}${arrow}`);
  });

  const rule   = RULES.find(r => r.category === topCat);
  let priority = rule?.priority ?? 'Medium';

  const highOverrides = PRIORITY_OVERRIDES.High.filter(p => normalise(text).includes(p));
  const lowOverrides  = PRIORITY_OVERRIDES.Low.filter(p  => normalise(text).includes(p));

  if (highOverrides.length > 0) {
    priority = 'High';
    console.log(`│  ⚡ Priority override → High  (matched: ${highOverrides.map(p => `"${p}"`).join(', ')})`);
  } else if (lowOverrides.length > 0) {
    priority = 'Low';
    console.log(`│  ⬇ Priority override → Low   (matched: ${lowOverrides.map(p => `"${p}"`).join(', ')})`);
  } else {
    console.log(`│  Priority from rule: ${priority}`);
  }

  console.log('├─────────────────────────────────────────────────────────');
  console.log(`│  Result  : category=${topCat}  team=${rule?.team ?? 'Support'}  priority=${priority}`);
  console.log(`│  Confidence: ${(confidence * 100).toFixed(1)}%  (${topScore.toFixed(1)} / ${totalScore.toFixed(1)})`);
  console.log('└─────────────────────────────────────────────────────────\n');

  return { category: topCat, team: rule?.team ?? 'Support', priority, confidence };
}

// ─── Step 2: Cache / Near-Duplicate Check ────────────────────────────────────

function tokenise(text) {
  return text.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(Boolean);
}

function similarity(a, b) {
  const setA = new Set(tokenise(a));
  const setB = new Set(tokenise(b));
  const inter = new Set([...setA].filter(x => setB.has(x)));
  const union = new Set([...setA, ...setB]);
  return union.size === 0 ? 0 : inter.size / union.size;
}

export function findNearDuplicate(subject, description, existingTickets) {
  const newText = `${subject} ${description}`;
  for (const ticket of existingTickets) {
    if (similarity(newText, `${ticket.subject} ${ticket.description}`) >= 0.70) {
      console.log(`[classifier] Cache hit — reusing ticket ${ticket.id}`);
      return ticket;
    }
  }
  return null;
}

// ─── Step 3: Vertex AI via @google/genai ─────────────────────────────────────

function buildClient() {
  const { ai, error } = buildGoogleAIClient();
  if (!ai) {
    console.warn(`[classifier] Vertex AI client not configured: ${error}`);
  }
  return ai;
}

async function callVertexAI(subject, description, hintCategory = null, hintTeam = null) {
  const ai = buildClient();
  if (!ai) {
    console.warn('[classifier] ⚠ Vertex AI client not configured');
    return null;
  }

  const mode = hintCategory ? 'DRAFT ONLY (high-confidence hint)' : 'FULL CLASSIFICATION';
  console.log(`\n┌─ [classifier] Vertex AI call ─────────────────────────────`);
  console.log(`│  Mode    : ${mode}`);
  if (hintCategory) {
    console.log(`│  Hint    : category="${hintCategory}"  team="${hintTeam}"`);
  }
  console.log(`│  Subject : "${subject}"`);

  try {
    const hint = hintCategory
      ? `\nOur rule-based classifier is HIGHLY confident this is "${hintCategory}" → "${hintTeam}". Agree unless clearly wrong.`
      : '';

    const prompt = `You are a support ticket classifier for a B2B software company.

Team responsibilities:
- Development: bugs, UI errors, crashes, pages not loading/showing, feature requests, anything technical
- Billing: ONLY actual payment problems (wrong charges, refunds, payment failures, billing disputes)
- HR: leave requests, payroll/salary issues, HR policies, employee contracts, benefits
- Support: general how-to, password reset, account access, documentation

Critical rules:
1. "Invoice not showing in dashboard" = Development (UI/display bug, NOT a Billing issue)
2. "Charged twice / wrong charge / refund" = Billing (actual money problem)
3. Any crash, error, blank screen, missing data = Development${hint}

Return valid JSON matching this exact schema:
{
  "category": one of [${CATEGORIES.map(c => `"${c}"`).join(', ')}],
  "priority": one of [${PRIORITIES.map(p => `"${p}"`).join(', ')}],
  "assignedTeam": one of [${TEAMS.map(t => `"${t}"`).join(', ')}],
  "draftResponse": "professional 2-3 sentence empathetic response to the client"
}

Subject: ${subject}
Description: ${description}`;

    const response = await ai.models.generateContent({
      model:    'gemini-3.5-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: 'object',
          properties: {
            category:      { type: 'string', enum: CATEGORIES },
            priority:      { type: 'string', enum: PRIORITIES },
            assignedTeam:  { type: 'string', enum: TEAMS },
            draftResponse: { type: 'string' },
          },
          required: ['category', 'priority', 'assignedTeam', 'draftResponse'],
        },
        temperature: 0.1,
      },
    });

    const text   = response.text;
    const parsed = JSON.parse(text);

    console.log(`│  Result  : category=${parsed.category}  team=${parsed.assignedTeam}  priority=${parsed.priority}`);
    console.log(`│  Draft   : "${(parsed.draftResponse || '').substring(0, 60)}…"`);
    console.log(`└────────────────────────────────────────────────────────────\n`);

    return {
      category:      CATEGORIES.includes(parsed.category)     ? parsed.category     : 'Other',
      assignedTeam:  TEAMS.includes(parsed.assignedTeam)       ? parsed.assignedTeam : 'Support',
      priority:      PRIORITIES.includes(parsed.priority)      ? parsed.priority     : 'Medium',
      draftResponse: parsed.draftResponse || '',
    };
  } catch (err) {
    console.error(`│  ✗ ERROR : ${err.message}`);
    console.log(`└────────────────────────────────────────────────────────────\n`);
    return null;
  }
}

// ─── Fallback Draft ───────────────────────────────────────────────────────────

function fallbackDraft(category, subject) {
  const drafts = {
    Billing:           `Thank you for reaching out about a billing concern. Our billing team will review your account and respond within 1–2 business days.`,
    Bug:               `Thank you for reporting this issue with "${subject}". Our development team has been notified and will investigate promptly.`,
    'Feature Request': `Thank you for your suggestion regarding "${subject}". We've logged it for our product team to evaluate.`,
    HR:                `Thank you for contacting HR about "${subject}". Our HR team will respond within 1 business day.`,
    Other:             `Thank you for contacting support. A team member will review "${subject}" and respond within 24–48 hours.`,
  };
  return drafts[category] || drafts.Other;
}

// ─── Main Entry Point ─────────────────────────────────────────────────────────

export async function classifyTicket(subject, description, existingTickets = []) {

  // Step 2: Cache check
  const cached = findNearDuplicate(subject, description, existingTickets);
  if (cached) {
    console.log(`\n[classifier] 🗄 Cache hit — reusing classification from ticket #${cached.ticketNumber ?? cached.id}`);
    console.log(`             category=${cached.category}  team=${cached.assignedTeams?.[0]}  priority=${cached.priority}\n`);
    return {
      category:        cached.category,
      assignedTeam:    cached.assignedTeams?.[0] || cached.assignedTeam || 'Support',
      assignedTeams:   cached.assignedTeams || [cached.assignedTeam || 'Support'],
      priority:        cached.priority,
      draftResponse:   cached.draftResponse || fallbackDraft(cached.category, subject),
      source:          'cache',
      confidenceScore: null,
    };
  }

  // Step 1: Custom classifier
  const custom = customClassify(subject, description);
  const needsFullClassification = custom.confidence < HIGH_CONFIDENCE_THRESHOLD;

  if (needsFullClassification) {
    console.log(`[classifier] 🤖 Confidence ${(custom.confidence * 100).toFixed(1)}% < ${HIGH_CONFIDENCE_THRESHOLD * 100}% threshold → Vertex AI: FULL classification`);
  } else {
    console.log(`[classifier] ✅ Confidence ${(custom.confidence * 100).toFixed(1)}% ≥ ${HIGH_CONFIDENCE_THRESHOLD * 100}% threshold → Vertex AI: DRAFT only`);
  }

  // Step 3: Call Vertex AI
  const aiResult = await callVertexAI(
    subject, description,
    needsFullClassification ? null : custom.category,
    needsFullClassification ? null : custom.team,
  );

  if (aiResult) {
    if (needsFullClassification) {
      console.log(`[classifier] 📋 Final (vertex-ai): category=${aiResult.category}  team=${aiResult.assignedTeam}  priority=${aiResult.priority}`);
      return {
        category:        aiResult.category,
        assignedTeam:    aiResult.assignedTeam,
        assignedTeams:   [aiResult.assignedTeam],
        priority:        aiResult.priority,
        draftResponse:   aiResult.draftResponse,
        source:          'vertex-ai',
        confidenceScore: custom.confidence,
      };
    }
    console.log(`[classifier] 📋 Final (custom+vertex-draft): category=${custom.category}  team=${custom.team}  priority=${custom.priority}`);
    return {
      category:        custom.category,
      assignedTeam:    custom.team,
      assignedTeams:   [custom.team],
      priority:        custom.priority,
      draftResponse:   aiResult.draftResponse,
      source:          'custom+vertex-draft',
      confidenceScore: custom.confidence,
    };
  }

  // Step 4: Fallback
  console.warn(`[classifier] ⚠ Vertex AI unavailable — using custom-fallback`);
  console.log(`[classifier] 📋 Final (custom-fallback): category=${custom.category}  team=${custom.team}  priority=${custom.priority}`);
  return {
    category:        custom.category,
    assignedTeam:    custom.team,
    assignedTeams:   [custom.team],
    priority:        custom.priority,
    draftResponse:   fallbackDraft(custom.category, subject),
    source:          'custom-fallback',
    confidenceScore: custom.confidence,
  };
}
