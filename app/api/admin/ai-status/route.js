/**
 * GET /api/admin/ai-status
 * Tests Vertex AI connectivity via @google/genai and returns status.
 * Admin only.
 */

import { NextResponse }       from 'next/server';
import { getUserFromRequest } from '../../../../lib/auth';
import { buildGoogleAIClient } from '../../../../lib/googleai';

export async function GET(request) {
  const user = await getUserFromRequest(request);
  if (!user || user.role !== 'Admin') {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }

  const { ai, project, location, error: clientError } = buildGoogleAIClient();

  if (!ai) {
    return NextResponse.json({
      status:  'misconfigured',
      message: clientError,
    });
  }

  try {
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
      model:     'gemini-3.5-flash',
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
