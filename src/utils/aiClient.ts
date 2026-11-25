import type { AISettings, DiagnosticItem } from '../types/ide';

export function buildSafeLatexPrompt(
  userPrompt: string,
  activeFileName: string,
  activeFileContent: string,
  diagnostics: DiagnosticItem[]
): string {
  const errorLines = diagnostics
    .filter((d) => d.severity === 'error')
    .slice(0, 8)
    .map((d) => `- [${d.file}${d.line ? `:${d.line}` : ''}] ${d.message}`)
    .join('\n');

  return [
    `Você é o copiloto Safe-Context do ForjaTeX (IDE LaTeX).`,
    `Regras estritas:`,
    `1. Não invente pacotes ou chaves \\cite{} inexistentes.`,
    `2. Preserve o preâmbulo existente a menos que o usuário peça alteração.`,
    `3. Quando fornecer código LaTeX pronto para aplicar, envolva-o em um bloco \`\`\`latex ... \`\`\`.`,
    ``,
    `Arquivo ativo: ${activeFileName}`,
    errorLines ? `Erros atuais de compilação:\n${errorLines}` : `Sem erros de compilação ativos.`,
    ``,
    `Conteúdo atual (trecho relevante):`,
    `\`\`\`latex`,
    activeFileContent.slice(0, 6000),
    `\`\`\``,
    ``,
    `Pedido do usuário: ${userPrompt}`,
  ].join('\n');
}

export function extractLatexBlock(text: string): string | undefined {
  const match = text.match(/```(?:latex|tex)?\s*\n([\s\S]*?)```/i);
  return match ? match[1].trim() : undefined;
}

export async function sendAiRequest(settings: AISettings, fullPrompt: string): Promise<string> {
  if (settings.provider !== 'ollama' && !settings.apiKey.trim()) {
    throw new Error('Configure sua API Key nas Configurações para usar o painel de IA.');
  }

  if (settings.provider === 'gemini') {
    const model = settings.model || 'gemini-2.5-flash';
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(settings.apiKey.trim())}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: fullPrompt }] }],
      }),
    });
    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Gemini API (${res.status}): ${errText.slice(0, 220)}`);
    }
    const data = await res.json();
    return data?.candidates?.[0]?.content?.parts?.[0]?.text || 'Sem resposta do modelo.';
  }

  if (settings.provider === 'anthropic') {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': settings.apiKey.trim(),
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model: settings.model || 'claude-3-5-sonnet-latest',
        max_tokens: 2048,
        messages: [{ role: 'user', content: fullPrompt }],
      }),
    });
    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Anthropic API (${res.status}): ${errText.slice(0, 220)}`);
    }
    const data = await res.json();
    return data?.content?.[0]?.text || 'Sem resposta do modelo.';
  }

  if (settings.provider === 'ollama') {
    const base = (settings.customEndpoint || 'http://localhost:11434').replace(/\/$/, '');
    const res = await fetch(`${base}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: settings.model || 'llama3.2',
        prompt: fullPrompt,
        stream: false,
      }),
    });
    if (!res.ok) {
      throw new Error(`Ollama (${res.status}): verifique se o Ollama está rodando localmente.`);
    }
    const data = await res.json();
    return data?.response || 'Sem resposta do Ollama.';
  }

  // OpenAI or Custom OpenAI-compatible
  const endpoint =
    settings.provider === 'custom' && settings.customEndpoint.trim()
      ? settings.customEndpoint.trim()
      : 'https://api.openai.com/v1/chat/completions';

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${settings.apiKey.trim()}`,
    },
    body: JSON.stringify({
      model: settings.model || 'gpt-4o-mini',
      messages: [{ role: 'user', content: fullPrompt }],
    }),
  });
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`OpenAI/Custom API (${res.status}): ${errText.slice(0, 220)}`);
  }
  const data = await res.json();
  return data?.choices?.[0]?.message?.content || 'Sem resposta do modelo.';
}
