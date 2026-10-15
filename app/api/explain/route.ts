import { NextResponse } from 'next/server';

// ============================================================================
// AI Provider Abstraction
// ----------------------------------------------------------------------------
// Three interchangeable backends. Groq is fast cloud. Hugging Face is open-
// weight hosting. Ollama is 100% local inference (no data leaves the machine).
//
// The LLM is an EXPLAINER ONLY. It receives structured JSON from the
// deterministic risk engine and translates it to plain English. It cannot
// alter the verdict, invent findings, or influence the score.
// ============================================================================

const SYSTEM_PROMPT = `You are a Web3 security explainer. You will receive a JSON risk report from a deterministic engine.
Your ONLY job is to translate this JSON into a clear, concise, 2-3 sentence explanation for a non-technical user.
DO NOT change the verdict. DO NOT invent new risks. DO NOT add warnings not present in the JSON.
If the verdict is SAFE, explain why. If BLOCK or REVIEW, explain the specific findings and what the user should do.`;

interface AIProvider {
  name: string;
  explain: (riskReport: any) => Promise<string>;
}

// ---------------------------------------------------------------------------
// Provider: Groq (cloud, fast, closed infra / open-weight model)
// ---------------------------------------------------------------------------
async function groqExplain(riskReport: any): Promise<string> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new Error('GROQ_API_KEY missing');

  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'openai/gpt-oss-120b',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: JSON.stringify(riskReport) },
      ],
      temperature: 0.1,
      max_tokens: 150,
    }),
  });

  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error?.message || `Groq error ${res.status}`);
  }

  const data = await res.json();
  return data.choices?.[0]?.message?.content?.trim() || 'Unable to generate explanation.';
}

// ---------------------------------------------------------------------------
// Provider: Hugging Face Inference API (open-weight model hosting)
// ---------------------------------------------------------------------------
async function huggingfaceExplain(riskReport: any): Promise<string> {
  const apiKey = process.env.HUGGINGFACE_API_KEY;
  const model = process.env.HUGGINGFACE_MODEL || 'meta-llama/Llama-3.3-70B-Instruct';
  if (!apiKey) throw new Error('HUGGINGFACE_API_KEY missing');

  const res = await fetch(`https://api-inference.huggingface.co/models/${model}/v1/chat/completions`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: JSON.stringify(riskReport) },
      ],
      temperature: 0.1,
      max_tokens: 150,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`HuggingFace error ${res.status}: ${err}`);
  }

  const data = await res.json();
  return data.choices?.[0]?.message?.content?.trim() || 'Unable to generate explanation.';
}

// ---------------------------------------------------------------------------
// Provider: Ollama (100% local, no data leaves the device)
// ---------------------------------------------------------------------------
async function ollamaExplain(riskReport: any): Promise<string> {
  const baseUrl = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
  const model = process.env.OLLAMA_MODEL || 'llama3.2';

  const res = await fetch(`${baseUrl}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      stream: false,
      options: { temperature: 0.1 },
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: JSON.stringify(riskReport) },
      ],
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Ollama error ${res.status}: ${err}`);
  }

  const data = await res.json();
  return data.message?.content?.trim() || 'Unable to generate explanation.';
}

// ---------------------------------------------------------------------------
// Provider registry
// ---------------------------------------------------------------------------
const PROVIDERS: Record<string, AIProvider> = {
  groq: { name: 'groq', explain: groqExplain },
  huggingface: { name: 'huggingface', explain: huggingfaceExplain },
  ollama: { name: 'ollama', explain: ollamaExplain },
};

// ============================================================================
// Route Handler
// ============================================================================
export async function POST(req: Request) {
  try {
    const { riskReport } = await req.json();

    if (!riskReport) {
      return NextResponse.json({ error: 'Missing risk report' }, { status: 400 });
    }

    const providerKey = (process.env.AI_PROVIDER || 'groq').toLowerCase();
    const provider = PROVIDERS[providerKey];

    if (!provider) {
      return NextResponse.json(
        { error: `Unknown AI_PROVIDER: ${providerKey}. Use groq, huggingface, or ollama.` },
        { status: 500 }
      );
    }

    console.log(`[/api/explain] Using provider: ${provider.name}`);

    const explanation = await provider.explain(riskReport);
    return NextResponse.json({ explanation, provider: provider.name });

  } catch (error: any) {
    console.error('[/api/explain] Error:', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
