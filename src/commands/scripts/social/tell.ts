/**
 * /tell command - Private message to another player
 */

import type { CommandDefinition, CommandContext, CommandResult, ParsedCommand } from '@/commands/types';

export const tellCommand: CommandDefinition = {
  name: 'tell',
  aliases: ['whisper', 't', 'w'],
  description: 'Send a private message to another player',
  category: 'social',
  usage: '/tell <player> <message>',
  examples: [
    '/tell Shadowblade Meet me at the safehouse',
    '/t Alice Got the quest item',
  ],

  parameters: {
    positional: [
      {
        type: 'string',
        required: true,
        description: 'Target player name',
      },
      {
        type: 'string',
        required: true,
        description: 'Message to send',
      },
    ],
  },

  handler: async (context: CommandContext, args: ParsedCommand): Promise<CommandResult> => {
    if (args.positionalArgs.length < 2) {
      return {
        success: false,
        error: 'Usage: /tell <player> <message>',
      };
    }

    const targetName = args.positionalArgs[0];
    const message = args.positionalArgs.slice(1).join(' ');

    if (!message || message.trim().length === 0) {
      return {
        success: false,
        error: 'You must provide a message.',
      };
    }

    if (message.length > 500) {
      return {
        success: false,
        error: 'Message too long (max 500 characters).',
      };
    }

    // Create private message event
    return {
      success: true,
      message: `You tell ${targetName}: "${message}"`,
      events: [
        {
          type: 'private_message',
          data: {
            senderId: context.characterId,
            senderName: context.characterName,
            targetName,
            message,
          },
        },
      ],
    };
  },
};
