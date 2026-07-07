/**
 * lib/googleai.js
 *
 * Shared factory for the @google/genai Vertex AI client.
 * Credential priority:
 *   1. GOOGLE_SERVICE_ACCOUNT_JSON env var  (production / Vercel)
 *   2. GOOGLE_APP_CREDENTIALS file path     (local dev fallback)
 *
 * Returns null if credentials or project are missing so callers can
 * degrade gracefully instead of throwing at startup.
 */

import { GoogleGenAI } from '@google/genai';
import path            from 'path';
import { readFileSync } from 'fs';

/**
 * Parse credentials from environment.
 * Returns { credentials, error } — exactly one will be non-null.
 */
function resolveCredentials() {
  if (process.env.GOOGLE_SERVICE_ACCOUNT_JSON) {
    try {
      return { credentials: JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON), error: null };
    } catch {
      return { credentials: null, error: 'GOOGLE_SERVICE_ACCOUNT_JSON is not valid JSON.' };
    }
  }

  if (process.env.GOOGLE_APP_CREDENTIALS) {
    try {
      const credPath = path.resolve(process.cwd(), process.env.GOOGLE_APP_CREDENTIALS);
      return { credentials: JSON.parse(readFileSync(credPath, 'utf8')), error: null };
    } catch {
      return { credentials: null, error: `Cannot read service account file: ${process.env.GOOGLE_APP_CREDENTIALS}` };
    }
  }

  return {
    credentials: null,
    error: 'No credentials found. Set GOOGLE_SERVICE_ACCOUNT_JSON (production) or GOOGLE_APP_CREDENTIALS (local dev).',
  };
}

/**
 * Build and return a GoogleGenAI client configured for Vertex AI.
 *
 * @returns {{ ai: GoogleGenAI|null, project: string|null, location: string, error: string|null }}
 */
export function buildGoogleAIClient() {
  const project  = process.env.GOOGLE_CLOUD_PROJECT   || null;
  const location = process.env.GOOGLE_CLOUD_LOCATION  || 'us-central1';

  if (!project) {
    return { ai: null, project: null, location, error: 'GOOGLE_CLOUD_PROJECT is not set.' };
  }

  const { credentials, error } = resolveCredentials();
  if (!credentials) {
    return { ai: null, project, location, error };
  }

  const ai = new GoogleGenAI({
    vertexai: true,
    project,
    location,
    googleAuthOptions: {
      credentials,
      scopes: ['https://www.googleapis.com/auth/cloud-platform'],
    },
  });

  return { ai, project, location, error: null };
}
