/**
 * Command registry - stores and manages all slash commands
 */

import { logger } from '@/utils/logger';
import type {
  CommandDefinition,
  CommandCategory,
  CompletionSuggestion,
  CommandContext,
} from './types';

export class CommandRegistry {
  private commands: Map<string, CommandDefinition> = new Map();
  private aliases: Map<string, string> = new Map(); // alias -> command name
  private categorizedCommands: Map<CommandCategory, Set<string>> = new Map();

  /**
   * Register a new command
   */
  register(definition: CommandDefinition): void {
    const { name, aliases = [], category } = definition;

    // Check for conflicts
    if (this.commands.has(name)) {
      throw new Error(`Command '${name}' is already registered`);
    }

    for (const alias of aliases) {
      if (this.aliases.has(alias)) {
        throw new Error(`Alias '${alias}' is already registered`);
      }
    }

    // Store command
    this.commands.set(name, definition);

    // Store aliases
    for (const alias of aliases) {
      this.aliases.set(alias, name);
    }

    // Categorize
    if (!this.categorizedCommands.has(category)) {
      this.categorizedCommands.set(category, new Set());
    }
    this.categorizedCommands.get(category)!.add(name);

    logger.debug({ name, aliases, category }, 'Command registered');
  }

  /**
   * Get command definition by name or alias
   */
  get(nameOrAlias: string): CommandDefinition | undefined {
    // Try direct lookup
    const direct = this.commands.get(nameOrAlias);
    if (direct) return direct;

    // Try alias lookup
    const commandName = this.aliases.get(nameOrAlias);
    if (commandName) {
      return this.commands.get(commandName);
    }

    return undefined;
  }

  /**
   * Check if command exists
   */
  has(nameOrAlias: string): boolean {
    return this.commands.has(nameOrAlias) || this.aliases.has(nameOrAlias);
  }

  /**
   * Get all command names
   */
  getAllNames(): string[] {
    return Array.from(this.commands.keys());
  }

  /**
   * Get all commands in a category
   */
  getByCategory(category: CommandCategory): CommandDefinition[] {
    const names = this.categorizedCommands.get(category);
    if (!names) return [];

    return Array.from(names)
      .map(name => this.commands.get(name)!)
      .filter(Boolean);
  }

  /**
   * Get all categories
   */
  getCategories(): CommandCategory[] {
    return Array.from(this.categorizedCommands.keys());
  }

  /**
   * Get completion suggestions for partial command
   */
  getCompletions(partial: string, context?: CommandContext): CompletionSuggestion[] {
    const lowerPartial = partial.toLowerCase();
    const suggestions: CompletionSuggestion[] = [];

    // Search commands
    for (const [name, def] of this.commands.entries()) {
      if (name.startsWith(lowerPartial)) {
        suggestions.push({
          value: `/${name}`,
          description: def.description,
          category: def.category,
          score: 100 - (name.length - lowerPartial.length), // Shorter = higher score
        });
      }
    }

    // Search aliases
    for (const [alias, commandName] of this.aliases.entries()) {
      if (alias.startsWith(lowerPartial)) {
        const def = this.commands.get(commandName)!;
        suggestions.push({
          value: `/${alias}`,
          description: `Alias for ${commandName}: ${def.description}`,
          category: def.category,
          score: 90 - (alias.length - lowerPartial.length),
        });
      }
    }

    // Sort by score descending
    suggestions.sort((a, b) => (b.score || 0) - (a.score || 0));

    return suggestions.slice(0, 10);  // Top 10
  }

  /**
   * Get help text for a command
   */
  getHelp(commandName: string): string | null {
    const cmd = this.get(commandName);
    if (!cmd) return null;

    let help = `**/${cmd.name}**\n`;
    help += `${cmd.description}\n\n`;

    if (cmd.aliases && cmd.aliases.length > 0) {
      help += `Aliases: ${cmd.aliases.map(a => `/${a}`).join(', ')}\n\n`;
    }

    if (cmd.usage) {
      help += `Usage: ${cmd.usage}\n\n`;
    }

    if (cmd.examples && cmd.examples.length > 0) {
      help += 'Examples:\n';
      for (const example of cmd.examples) {
        help += `  ${example}\n`;
      }
      help += '\n';
    }

    if (cmd.parameters) {
      if (cmd.parameters.positional && cmd.parameters.positional.length > 0) {
        help += 'Positional Parameters:\n';
        for (const [i, param] of cmd.parameters.positional.entries()) {
          const required = param.required !== false ? '[required]' : '[optional]';
          help += `  ${i + 1}. ${param.type} ${required}`;
          if (param.description) {
            help += ` - ${param.description}`;
          }
          help += '\n';
        }
        help += '\n';
      }

      if (cmd.parameters.named && Object.keys(cmd.parameters.named).length > 0) {
        help += 'Named Parameters:\n';
        for (const [key, param] of Object.entries(cmd.parameters.named)) {
          const required = param.required ? '[required]' : '[optional]';
          help += `  ${key}: ${param.type} ${required}`;
          if (param.description) {
            help += ` - ${param.description}`;
          }
          if (param.default !== undefined) {
            help += ` (default: ${param.default})`;
          }
          help += '\n';
        }
        help += '\n';
      }
    }

    if (cmd.cooldown) {
      help += `Cooldown: ${cmd.cooldown}ms\n`;
    }

    return help.trim();
  }

  /**
   * Get help text for a category
   */
  getCategoryHelp(category: CommandCategory): string {
    const commands = this.getByCategory(category);

    if (commands.length === 0) {
      return `No commands in category '${category}'`;
    }

    let help = `**${category.toUpperCase()} COMMANDS**\n\n`;

    for (const cmd of commands) {
      help += `/${cmd.name}`;
      if (cmd.aliases && cmd.aliases.length > 0) {
        help += ` (${cmd.aliases.map(a => `/${a}`).join(', ')})`;
      }
      help += `\n  ${cmd.description}\n\n`;
    }

    return help.trim();
  }

  /**
   * Get general help text (all categories)
   */
  getGeneralHelp(): string {
    let help = '**AVAILABLE COMMANDS**\n\n';

    for (const category of this.getCategories()) {
      const commands = this.getByCategory(category);
      help += `**${category.toUpperCase()}** (${commands.length} commands)\n`;
      help += `  Use /help ${category} for details\n\n`;
    }

    help += 'Use /help <command> for detailed command help';

    return help.trim();
  }

  /**
   * Clear all registered commands (for testing)
   */
  clear(): void {
    this.commands.clear();
    this.aliases.clear();
    this.categorizedCommands.clear();
  }

  /**
   * Get command count
   */
  getCount(): number {
    return this.commands.size;
  }
}
