/**
 * AI Classification Pipeline
 *
 * Step 1: Rule-based keyword classifier with confidence scoring.
 * Step 2: If confidence is low, call Google Gemini for structured classification.
 * Step 3: Cache check - reuse existing classification for near-duplicate complaints.
 */

import { GoogleGenerativeAI, SchemaType } from '@google/generative-ai';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const CATEGORIES = ['Billing', 'Bug', 'Feature Request', 'HR', 'Other'];
const TEAMS = ['Development', 'Billing', 'HR', 'Support'];
const PRIORITIES = ['Low', 'Medium', 'High'];

/** Minimum confidence (0–1) required to skip Gemini */
const HIGH_CONFIDENCE_THRESHOLD = 0.65;

// ---------------------------------------------------------------------------
// Keyword Rule Map
// Each entry: { keywords, category, team, priority, weight }
// ---------------------------------------------------------------------------

const RULES = [
  // --- Billing ---
  {
    keywords: ['invoice', 'charge', 'payment', 'refund', 'billing', 'overcharged', 'duplicate charge', 'subscription', 'receipt', 'transaction', 'credit card', 'debit', 'money', 'cost', 'price', 'fee', 'bank'],
    category: 'Billing',
    team: 'Billing',
    priority: 'High',
    weight: 2,
  },
  // --- Bug ---
  {
    keywords: ['bug', 'crash', 'error', 'broken', 'not working', 'issue', 'glitch', 'freeze', 'hangs', 'failed', 'exception', 'cannot login', "can't login", 'login problem', 'loading', 'blank screen', 'timeout', '500', '404', 'unresponsive'],
    category: 'Bug',
    team: 'Development',
    priority: 'High',
    weight: 2,
  },
  // --- Feature Request ---
  {
    keywords: ['feature', 'request', 'add', 'suggestion', 'improve', 'enhancement', 'would be great', 'dark mode', 'would like', 'can you add', 'please add', 'wish', 'support for', 'integration'],
    category: 'Feature Request',
    team: 'Development',
    priority: 'Low',
    weight: 1.5,
  },
  // --- HR ---
  {
    keywords: ['leave', 'vacation', 'salary', 'payroll', 'hr', 'human resources', 'employee', 'onboarding', 'termination', 'contract', 'benefits', 'policy', 'sick leave', 'annual leave', 'manager', 'promotion', 'performance review'],
    category: 'HR',
    team: 'HR',
    priority: 'Medium',
    weight: 2,
  },
  // --- Support / General ---
  {
    keywords: ['help', 'support', 'question', 'how to', 'unable', 'access', 'account', 'password', 'reset', 'setup', 'configuration', 'guide', 'documentation', 'tutorial'],
    category: 'Other',
    team: 'Support',
    priority: 'Medium',
    weight: 1,
  },
];

// Priority keyword overrides
const PRIORITY_KEYWORDS = {
  High: ['urgent', 'critical', 'asap', 'immediately', 'emergency', 'blocking', 'cannot work', 'production down', 'severe'],
  Low: ['minor', 'low priority', 'whenever', 'not urgent', 'nice to have', 'eventually', 'suggestion'],
};

// ---------------------------------------------------------------------------
// Rule-Based Classifier
// ---------------------------------------------------------------------------

/**
 * Tokenise text: lowercase, remove punctuation, split into words.
 */
function tokenize(text) {
  return text.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(Boolean);
}

/**
 * Count how many keywords (or phrases) from a list appear in the text.
 */
function countMatches(text, keywords) {
  const lower = text.toLowerCase();
  return keywords.filter((kw) => lower.includes(kw)).length;
}

/**
 * Rule-based keyword classifier.
 * Returns { category, team, priority, confidence }
 */
function keywordClassify(subject, description) {
  const text = `${subject} ${description}`;
  const scores = {}; // category → weighted score

  for (const rule of RULES) {
    const matches = countMatches(text, rule.keywords);
    if (matches > 0) {
      const score = matches * rule.weight;
      scores[rule.category] = (scores[rule.category] || 0) + score;
    }
  }

  if (Object.keys(scores).length === 0) {
    return { category: 'Other', team: 'Support', priority: 'Medium', confidence: 0 };
  }

  // Pick category with highest score
  const sorted = Object.entries(scores).sort((a, b) => b[1] - a[1]);
  const [topCategory, topScore] = sorted[0];
  const totalScore = sorted.reduce((sum, [, s]) => sum + s, 0);
  const confidence = totalScore > 0 ? topScore / totalScore : 0;

  // Find the rule for this category to get default team/priority
  const rule = RULES.find((r) => r.category === topCategory);
  let team = rule ? rule.team : 'Support';
  let priority = rule ? rule.priority : 'Medium';

  // Override priority based on urgency keywords
  if (countMatches(text, PRIORITY_KEYWORDS.High) > 0) priority = 'High';
  else if (countMatches(text, PRIORITY_KEYWORDS.Low) > 0) priority = 'Low';

  return { category: topCategory, team, priority, confidence };
}

// ---------------------------------------------------------------------------
// Gemini Classifier (Structured Output)
// ---------------------------------------------------------------------------

/**
 * Call Google Gemini API with a JSON schema for structured output.
 * @param {string} subject
 * @param {string} description
 * @returns {Promise<{category, assignedTeam, priority, draftResponse}>}
 */
async function geminiClassify(subject, description) {
  if (!process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY === 'your-gemini-api-key-here') {
    console.warn('⚠️  GEMINI_API_KEY not set — using fallback classification');
    return null;
  }

  try {
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

    // JSON Schema for structured output
    const responseSchema = {
      type: SchemaType.OBJECT,
      properties: {
        category: {
          type: SchemaType.STRING,
          enum: CATEGORIES,
          description: 'The category of the support ticket',
        },
        priority: {
          type: SchemaType.STRING,
          enum: PRIORITIES,
          description: 'The urgency/priority of the ticket',
        },
        assignedTeam: {
          type: SchemaType.STRING,
          enum: TEAMS,
          description: 'The team best suited to handle this ticket',
        },
        draftResponse: {
          type: SchemaType.STRING,
          description: 'A professional, empathetic draft response for the customer',
        },
      },
      required: ['category', 'priority', 'assignedTeam', 'draftResponse'],
    };

    const model = genAI.getGenerativeModel({
      model: 'gemini-1.5-flash',
      generationConfig: {
        responseMimeType: 'application/json',
        responseSchema,
      },
    });

    const prompt = `You are a support ticket classifier for a software company.
    
Analyze the following support ticket and classify it:

Subject: ${subject}
Description: ${description}

Classify this ticket with:
- category: One of ${CATEGORIES.join(', ')}
- priority: One of ${PRIORITIES.join(', ')} based on urgency and impact
- assignedTeam: One of ${TEAMS.join(', ')} — Development handles bugs/features, Billing handles payments, HR handles employee matters, Support handles general questions
- draftResponse: A professional, empathetic response of 2-3 sentences acknowledging the issue and stating next steps`;

    const result = await model.generateContent(prompt);
    const text = result.response.text();
    const parsed = JSON.parse(text);

    return {
      category: parsed.category || 'Other',
      assignedTeam: parsed.assignedTeam || 'Support',
      priority: parsed.priority || 'Medium',
      draftResponse: parsed.draftResponse || '',
    };
  } catch (err) {
    console.error('Gemini API error:', err.message);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Near-Duplicate Detection
// ---------------------------------------------------------------------------

/**
 * Simple similarity score between two strings using word overlap (Jaccard index).
 * @param {string} a
 * @param {string} b
 * @returns {number} 0–1
 */
function textSimilarity(a, b) {
  const setA = new Set(tokenize(a));
  const setB = new Set(tokenize(b));
  const intersection = new Set([...setA].filter((x) => setB.has(x)));
  const union = new Set([...setA, ...setB]);
  return union.size === 0 ? 0 : intersection.size / union.size;
}

/**
 * Check existing tickets for a near-duplicate complaint.
 * @param {string} subject
 * @param {string} description
 * @param {Array} existingTickets - Array of ticket objects from DB
 * @returns {object|null} Matching ticket or null
 */
export function findNearDuplicate(subject, description, existingTickets) {
  const newText = `${subject} ${description}`;

  for (const ticket of existingTickets) {
    const existingText = `${ticket.subject} ${ticket.description}`;
    const similarity = textSimilarity(newText, existingText);

    // Threshold: 70% word overlap considered near-duplicate
    if (similarity >= 0.7) {
      return ticket;
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Main Classification Entry Point
// ---------------------------------------------------------------------------

/**
 * Classify a support ticket using the hybrid pipeline.
 *
 * Pipeline:
 *   1. Check existing tickets for near-duplicate → reuse classification
 *   2. Run keyword classifier → use if confidence ≥ HIGH_CONFIDENCE_THRESHOLD
 *   3. Call Gemini for structured output → use result
 *   4. Fall back to keyword result if Gemini fails
 *
 * @param {string} subject
 * @param {string} description
 * @param {Array} existingTickets - Recent tickets for duplicate check
 * @returns {Promise<{category, assignedTeam, priority, draftResponse, source}>}
 */
export async function classifyTicket(subject, description, existingTickets = []) {
  // Step 1: Near-duplicate check
  const duplicate = findNearDuplicate(subject, description, existingTickets);
  if (duplicate) {
    console.log('♻️  Reusing classification from near-duplicate ticket:', duplicate.id);
    return {
      category: duplicate.category,
      assignedTeam: duplicate.assignedTeam,
      priority: duplicate.priority,
      draftResponse: duplicate.draftResponse,
      source: 'duplicate',
    };
  }

  // Step 2: Keyword classification
  const keywordResult = keywordClassify(subject, description);
  console.log(`🔍 Keyword classifier: category=${keywordResult.category}, confidence=${keywordResult.confidence.toFixed(2)}`);

  if (keywordResult.confidence >= HIGH_CONFIDENCE_THRESHOLD) {
    // High confidence — generate a draft response locally
    const draftResponse = generateFallbackDraft(keywordResult.category, subject);
    return {
      category: keywordResult.category,
      assignedTeam: keywordResult.team,
      priority: keywordResult.priority,
      draftResponse,
      source: 'keyword',
    };
  }

  // Step 3: Low confidence → call Gemini
  console.log('🤖 Low confidence — calling Gemini API...');
  const geminiResult = await geminiClassify(subject, description);

  if (geminiResult) {
    return {
      ...geminiResult,
      source: 'gemini',
    };
  }

  // Step 4: Gemini failed — use keyword result as fallback
  console.log('⚠️  Gemini unavailable — using keyword fallback');
  const draftResponse = generateFallbackDraft(keywordResult.category, subject);
  return {
    category: keywordResult.category,
    assignedTeam: keywordResult.team,
    priority: keywordResult.priority,
    draftResponse,
    source: 'keyword-fallback',
  };
}

/**
 * Generate a simple template draft response based on category.
 * Used when Gemini is unavailable.
 */
function generateFallbackDraft(category, subject) {
  const drafts = {
    Billing: `Thank you for contacting us regarding your billing concern: "${subject}". Our billing team will review your account and respond within 1-2 business days.`,
    Bug: `Thank you for reporting this issue: "${subject}". Our development team has been notified and will investigate immediately. We will provide an update shortly.`,
    'Feature Request': `Thank you for your feature suggestion: "${subject}". We appreciate your feedback and have logged this request for our product team to review in future planning.`,
    HR: `Thank you for reaching out to HR regarding "${subject}". Our HR team will review your request and get back to you within 1 business day.`,
    Other: `Thank you for contacting our support team regarding "${subject}". A team member will review your request and respond within 24-48 hours.`,
  };
  return drafts[category] || drafts.Other;
}
