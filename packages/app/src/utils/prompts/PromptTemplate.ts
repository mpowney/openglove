import { readFile } from 'fs/promises';
import { resolve } from 'path';

export type PromptTemplatePlaceholders = Record<string, string> | Array<Record<string, string>>;

function normalisePlaceholders(placeholders: PromptTemplatePlaceholders): Record<string, string> {
  if (!Array.isArray(placeholders)) {
    return placeholders;
  }

  return placeholders.reduce<Record<string, string>>((acc, current) => ({ ...acc, ...current }), {});
}

function toPlaceholder(token: string): string {
  if (token.startsWith('{') && token.endsWith('}')) {
    return token;
  }

  return `{${token}}`;
}

export class PromptTemplate {
  private readonly promptFileName: string;
  private readonly templatePath: string;
  private placeholders: Record<string, string> = {};

  constructor(promptFileName: string, templatePath = 'prompts/') {
    this.promptFileName = promptFileName;
    this.templatePath = templatePath;
  }

  setPlaceholders(placeholders: PromptTemplatePlaceholders): this {
    this.placeholders = {
      ...this.placeholders,
      ...normalisePlaceholders(placeholders)
    };

    return this;
  }

  async render(): Promise<string> {
    const resolvedPath = resolve(process.cwd(), this.templatePath, this.promptFileName);
    const templateContent = await readFile(resolvedPath, 'utf8');

    return Object.entries(this.placeholders).reduce((content, [token, value]) => {
      return content.split(toPlaceholder(token)).join(String(value));
    }, templateContent);
  }
}