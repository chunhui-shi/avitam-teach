import Anthropic from '@anthropic-ai/sdk';

// v4-designed: a provider abstraction for the teaching assistant.
//
// The assistant talks to one model provider today. Putting it behind an
// interface means swapping providers, adding a fallback when one is down, or
// stubbing it in a test is a change of *implementation*, not of the route. The
// route asks for a completion; it doesn't know or care who answers.

export interface AssistantMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface AssistantCompleteOptions {
  maxTokens?: number;
}

export interface AssistantProvider {
  complete(
    system: string,
    messages: AssistantMessage[],
    opts?: AssistantCompleteOptions
  ): Promise<string>;
}

class AnthropicProvider implements AssistantProvider {
  private client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  async complete(
    system: string,
    messages: AssistantMessage[],
    opts: AssistantCompleteOptions = {}
  ): Promise<string> {
    const response = await this.client.messages.create({
      // The caller owns the output budget (Layer 3 of the assistant's defense);
      // the provider honors it. 512 is the default if the caller doesn't say.
      model: 'claude-3-5-haiku-20241022',
      max_tokens: opts.maxTokens ?? 512,
      system,
      messages,
    });
    return response.content[0].type === 'text' ? response.content[0].text : '';
  }
}

export const assistant: AssistantProvider = new AnthropicProvider();
