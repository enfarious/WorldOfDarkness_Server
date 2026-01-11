/**
 * /emote command - Roleplay action (150 feet visible)
 */

import type { CommandDefinition, CommandContext, CommandResult, ParsedCommand } from '@/commands/types';

export const emoteCommand: CommandDefinition = {
  name: 'emote',
  aliases: ['me', 'em'],
  description: 'Perform a roleplay action (150 feet visible)',
  category: 'social',
  usage: '/emote <action>',
  examples: [
    '/emote looks around cautiously',
    '/me draws their weapon slowly',
    '/em crouches behind cover',
  ],

  parameters: {
    positional: [
      {
        type: 'string',
        required: true,
        description: 'The action to perform',
      },
    ],
  },

  handler: async (context: CommandContext, args: ParsedCommand): Promise<CommandResult> => {
    const action = args.positionalArgs.join(' ');

    if (!action || action.trim().length === 0) {
      return {
        success: false,
        error: 'You must provide an action to emote.',
      };
    }

    if (action.length > 500) {
      return {
        success: false,
        error: 'Emote too long (max 500 characters).',
      };
    }

    // Create emote event for broadcast
    return {
      success: true,
      message: `${context.characterName} ${action}`,
      broadcast: true,
      events: [
        {
          type: 'emote',
          data: {
            characterId: context.characterId,
            characterName: context.characterName,
            action,
            range: 150,  // feet
            position: context.position,
          },
        },
      ],
    };
  },
};
