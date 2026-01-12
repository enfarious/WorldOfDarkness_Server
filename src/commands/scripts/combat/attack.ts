/**
 * /attack command - Basic attack (auto-attack starter)
 */

import type { CommandDefinition, CommandContext, CommandResult, ParsedCommand } from '@/commands/types';

export const attackCommand: CommandDefinition = {
  name: 'attack',
  aliases: ['atk'],
  description: 'Attack a target using basic attack',
  category: 'combat',
  usage: '/attack <target>',
  examples: [
    '/attack Old Merchant',
    '/atk bandit.1',
  ],

  parameters: {
    positional: [
      {
        type: 'string',
        required: true,
        description: 'Target name or ID',
      },
    ],
  },

  handler: async (_context: CommandContext, args: ParsedCommand): Promise<CommandResult> => {
    const target = args.positionalArgs.join(' ').trim();
    if (!target) {
      return {
        success: false,
        error: 'You must provide a target.',
      };
    }

    return {
      success: true,
      events: [
        {
          type: 'combat_action',
          data: {
            abilityId: 'basic_attack',
            target,
          },
        },
      ],
    };
  },
};
