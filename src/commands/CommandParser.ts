/**
 * Slash command parser
 *
 * Parses raw command strings into structured format:
 * - Extracts command name
 * - Separates positional vs named arguments
 * - Handles quoted strings
 * - Validates basic syntax
 */

import type { ParsedCommand } from './types';

export class CommandParser {
  /**
   * Parse a slash command string
   */
  parse(input: string): ParsedCommand {
    const trimmed = input.trim();

    // Must start with /
    if (!trimmed.startsWith('/')) {
      throw new Error('Commands must start with /');
    }

    // Remove leading slash
    const withoutSlash = trimmed.substring(1);

    // Split into tokens, respecting quoted strings
    const tokens = this.tokenize(withoutSlash);

    if (tokens.length === 0) {
      throw new Error('Empty command');
    }

    // First token is the command
    const command = tokens[0].toLowerCase();

    // Remaining tokens are arguments
    const argTokens = tokens.slice(1);

    // Separate positional vs named arguments
    const positionalArgs: string[] = [];
    const namedArgs: Record<string, string> = {};

    for (const token of argTokens) {
      if (token.includes(':')) {
        // Named argument (key:value)
        const colonIndex = token.indexOf(':');
        const key = token.substring(0, colonIndex);
        const value = token.substring(colonIndex + 1);

        if (key && value) {
          namedArgs[key] = value;
        }
      } else {
        // Positional argument
        positionalArgs.push(token);
      }
    }

    return {
      command,
      positionalArgs,
      namedArgs,
      rawInput: input,
    };
  }

  /**
   * Tokenize command string, respecting quoted strings
   */
  private tokenize(input: string): string[] {
    const tokens: string[] = [];
    let current = '';
    let inQuotes = false;
    let quoteChar = '';

    for (let i = 0; i < input.length; i++) {
      const char = input[i];

      // Handle quotes
      if (char === '"' || char === "'") {
        if (inQuotes) {
          if (char === quoteChar) {
            // End of quoted string
            inQuotes = false;
            quoteChar = '';
            // Don't include the quote
            continue;
          }
        } else {
          // Start of quoted string
          inQuotes = true;
          quoteChar = char;
          // Don't include the quote
          continue;
        }
      }

      // Handle whitespace
      if (char === ' ' && !inQuotes) {
        if (current) {
          tokens.push(current);
          current = '';
        }
        continue;
      }

      // Add character to current token
      current += char;
    }

    // Add final token
    if (current) {
      tokens.push(current);
    }

    return tokens;
  }

  /**
   * Validate command syntax (basic checks)
   */
  validate(parsed: ParsedCommand): void {
    // Command name must be alphanumeric + hyphen/underscore
    if (!/^[a-z0-9_-]+$/.test(parsed.command)) {
      throw new Error(`Invalid command name: ${parsed.command}`);
    }

    // Named arg keys must be alphanumeric + hyphen/underscore
    for (const key of Object.keys(parsed.namedArgs)) {
      if (!/^[a-z0-9_-]+$/i.test(key)) {
        throw new Error(`Invalid parameter name: ${key}`);
      }
    }
  }

  /**
   * Suggest command based on partial input
   */
  suggestCommand(partial: string, availableCommands: string[]): string[] {
    const lower = partial.toLowerCase();

    // Exact prefix match
    const prefixMatches = availableCommands.filter(cmd => cmd.toLowerCase().startsWith(lower));

    if (prefixMatches.length > 0) {
      return prefixMatches;
    }

    // Fuzzy match (contains substring)
    const fuzzyMatches = availableCommands.filter(cmd => cmd.toLowerCase().includes(lower));

    if (fuzzyMatches.length > 0) {
      return fuzzyMatches;
    }

    // Levenshtein distance (did you mean?)
    const suggestions = availableCommands
      .map(cmd => ({
        cmd,
        distance: this.levenshteinDistance(lower, cmd.toLowerCase()),
      }))
      .filter(x => x.distance <= 3)  // Max 3 character difference
      .sort((a, b) => a.distance - b.distance)
      .slice(0, 3)  // Top 3 suggestions
      .map(x => x.cmd);

    return suggestions;
  }

  /**
   * Calculate Levenshtein distance between two strings
   */
  private levenshteinDistance(a: string, b: string): number {
    if (a.length === 0) return b.length;
    if (b.length === 0) return a.length;

    const matrix: number[][] = [];

    for (let i = 0; i <= b.length; i++) {
      matrix[i] = [i];
    }

    for (let j = 0; j <= a.length; j++) {
      matrix[0][j] = j;
    }

    for (let i = 1; i <= b.length; i++) {
      for (let j = 1; j <= a.length; j++) {
        if (b.charAt(i - 1) === a.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1, // substitution
            matrix[i][j - 1] + 1,     // insertion
            matrix[i - 1][j] + 1      // deletion
          );
        }
      }
    }

    return matrix[b.length][a.length];
  }
}
