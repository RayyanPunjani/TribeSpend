import type { CategoryRule, ParsedStatement } from '@/types'
import type { AIProvider } from './aiProvider'
import { buildParsingPrompt, extractJSON, mergeStatements } from './aiProvider'
import { chunkText } from './pdfExtractor'

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages'

async function callAnthropic(apiKey: string, model: string, prompt: string): Promise<string> {
  console.log('Anthropic request body:', JSON.stringify({
    model,
    max_tokens: 8000,
    stream: false,
    messages: [{ role: 'user', content: prompt.substring(0, 100) + '...' }],
  }, null, 2))

  const resp = await fetch(ANTHROPIC_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: model || 'claude-sonnet-4-20250514',
      max_tokens: 8000,
      stream: false,
      messages: [{ role: 'user', content: prompt }],
    }),
    signal: AbortSignal.timeout(120_000),
  })

  if (!resp.ok) {
    const text = await resp.text()
    throw new Error(`Anthropic API error ${resp.status}: ${text}`)
  }

  const data = await resp.json()
  return data.content?.[0]?.text ?? ''
}

/**
 * Anthropic's API does not send CORS headers, so direct browser fetch calls
 * will always be blocked. We validate the key format instead of making a
 * live network call.
 */
export function testAnthropicConnection(apiKey: string): Promise<'valid_format' | 'invalid_format'> {
  const looksValid = /^sk-ant-[a-zA-Z0-9_-]{20,}$/.test(apiKey.trim())
  return Promise.resolve(looksValid ? 'valid_format' : 'invalid_format')
}

export class AnthropicProvider implements AIProvider {
  name = 'Anthropic Claude'
  private apiKey: string
  private model: string

  constructor(apiKey: string, model: string) {
    this.apiKey = apiKey
    this.model = model
  }

  async parseStatement(
    rawText: string,
    categoryRules: CategoryRule[],
  ): Promise<ParsedStatement> {
    const chunks = chunkText(rawText, 50000) // Claude has large context

    if (chunks.length === 1) {
      const prompt = buildParsingPrompt(rawText, categoryRules)
      const response = await callAnthropic(this.apiKey, this.model, prompt)
      return extractJSON(response)
    }

    const results: ParsedStatement[] = []
    for (let i = 0; i < chunks.length; i++) {
      const chunkPrompt = buildParsingPrompt(
        `[Part ${i + 1} of ${chunks.length}]\n${chunks[i]}`,
        i === 0 ? categoryRules : [],
      )
      const response = await callAnthropic(this.apiKey, this.model, chunkPrompt)
      try {
        results.push(extractJSON(response))
      } catch {
        console.warn(`Failed to parse chunk ${i + 1}, skipping`)
      }
    }

    if (results.length === 0) throw new Error('All chunks failed to parse')
    return mergeStatements(results)
  }
}
