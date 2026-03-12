import OpenAI from 'openai';
import { DEFAULT_OPENAI_MODEL, OPENAI_MAX_TOKENS, GENERATION_MAX_RETRIES } from '@damac/shared';

export interface GenerationConfig {
  apiKey: string;
  model?: string;
  maxTokens?: number;
}

export interface GenerationInput {
  systemPrompt: string;
  codebaseSummary: string;
  templatePrompt: string;
}

export class GenerationService {
  private client: OpenAI;
  private model: string;
  private maxTokens: number;

  constructor(config: GenerationConfig) {
    this.client = new OpenAI({ apiKey: config.apiKey });
    this.model = config.model || DEFAULT_OPENAI_MODEL;
    this.maxTokens = config.maxTokens || OPENAI_MAX_TOKENS;
  }

  async *generateStream(input: GenerationInput): AsyncGenerator<string, { tokensIn: number; tokensOut: number }> {
    const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
      {
        role: 'system',
        content: [
          'You are a senior technical writer specializing in enterprise Technical Design Documents.',
          'Produce publication-ready technical documentation, not an AI-style response.',
          'Follow the template instructions exactly, but do not echo instructional labels, rubric text, annotations, or parenthetical guidance into the final document.',
          'Output raw Markdown directly. Do NOT wrap the output in ```markdown``` code fences or any other code block wrapper.',
          'Start directly with the final Markdown content.',
          input.systemPrompt,
        ].filter(Boolean).join(' '),
      },
      {
        role: 'user',
        content: `${input.templatePrompt}\n\n---\n\n${input.codebaseSummary}`,
      },
    ];

    let lastError: Error | null = null;
    let tokensIn = 0;
    let tokensOut = 0;

    for (let attempt = 0; attempt < GENERATION_MAX_RETRIES; attempt++) {
      try {
        const stream = await this.client.chat.completions.create({
          model: this.model,
          messages,
          max_completion_tokens: this.maxTokens,
          temperature: 0.3,
          stream: true,
          stream_options: { include_usage: true },
        });

        for await (const chunk of stream) {
          if (chunk.usage) {
            tokensIn = chunk.usage.prompt_tokens || 0;
            tokensOut = chunk.usage.completion_tokens || 0;
          }
          const content = chunk.choices?.[0]?.delta?.content;
          if (content) {
            yield content;
          }
        }

        return { tokensIn, tokensOut };
      } catch (error: any) {
        lastError = error;
        if (error?.status === 429 || error?.status >= 500) {
          const waitMs = Math.min(1000 * Math.pow(2, attempt), 10000);
          await new Promise((resolve) => setTimeout(resolve, waitMs));
          continue;
        }
        throw error;
      }
    }

    throw lastError || new Error('Generation failed after retries');
  }

  async generate(input: GenerationInput): Promise<{ content: string; tokensIn: number; tokensOut: number }> {
    let content = '';
    let usage = { tokensIn: 0, tokensOut: 0 };

    const gen = this.generateStream(input);
    while (true) {
      const result = await gen.next();
      if (result.done) {
        usage = result.value;
        break;
      }
      content += result.value;
    }

    return { content, ...usage };
  }
}
