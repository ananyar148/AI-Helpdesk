/**
 * GET /api/admin/ai-status
 * Tests Vertex AI connectivity via @google/genai and returns status.
 * Admin only.
 */

import { NextResponse }       from 'next/server';
import { getUserFromRequest } from '../../../../lib/auth';
import { GoogleGenAI }        from '@google/genai';
import path                   from 'path';
import { readFileSync }       from 'fs';

export async function GET(request) {
  const user = await getUserFromRequest(request);
  if (!user || user.role !== 'Admin') {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }

  const project  = process.env.GOOGLE_CLOUD_PROJECT;
  const location = process.env.GOOGLE_CLOUD_LOCATION || 'us-central1';
  const credFile = process.env.GOOGLE_APP_CREDENTIALS;

  // At least one credential source must be present
  const hasCredentials =
    !!process.env.GOOGLE_SERVICE_ACCOUNT_JSON || !!credFile;

  if (!project || !hasCredentials) {
    return NextResponse.json({
      status:  'misconfigured',
      message: !project
        ? 'GOOGLE_CLOUD_PROJECT is not set.'
        : 'No credentials found. Set GOOGLE_SERVICE_ACCOUNT_JSON (Vercel) or GOOGLE_APP_CREDENTIALS (local).',
    });
  }

  let credentials;
  try {
    // Primary: env var (Vercel / production)
    if (process.env.GOOGLE_SERVICE_ACCOUNT_JSON) {
      credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON);
    } else if (credFile) {
      const credPath = path.resolve(process.cwd(), credFile);
      credentials = JSON.parse(readFileSync(credPath, 'utf8'));
    } else {
      return NextResponse.json({
        status:  'misconfigured',
        message: 'Set GOOGLE_SERVICE_ACCOUNT_JSON (Vercel) or GOOGLE_APP_CREDENTIALS (local)',
      });
    }
  } catch (e) {
    return NextResponse.json({
      status:  'misconfigured',
      message: `Invalid credentials: ${e.message}`,
    });
  }

  try {
    const ai = new GoogleGenAI({
      vertexai: true,
      project,
      location,
      googleAuthOptions: {
        credentials,
        scopes: ['https://www.googleapis.com/auth/cloud-platform'],
      },
    });

    const start    = Date.now();
    const response = await ai.models.generateContent({
      model:    'gemini-3.5-flash',
      contents: 'Reply with exactly one word: ok',
      config:   { temperature: 0 },
    });
    const ms   = Date.now() - start;
    const text = response.text?.trim();

    return NextResponse.json({
      status:    'connected',
      message:   'Vertex AI is working correctly.',
      model:     'gemini-2.0-flash',
      project,
      location,
      latencyMs: ms,
      sample:    text,
    });
  } catch (err) {
    const msg  = err.message || '';
    const code = msg.includes('404') ? 'model_not_found'
               : msg.includes('403') ? 'permission_denied'
               : msg.includes('401') ? 'auth_failed'
               : msg.includes('DOCTYPE') ? 'invalid_region'
               : 'error';

    return NextResponse.json({
      status:   code,
      message:  msg.substring(0, 300),
      project,
      location,
    });
  }
}
