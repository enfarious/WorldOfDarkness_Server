/**
 * /shout command - Loud speech (150 feet range)
 */

import type { CommandDefinition, CommandContext, CommandResult, ParsedCommand } from '@/commands/types';

export const shoutCommand: CommandDefinition = {
  name: 'shout',
  aliases: ['yell', 'y'],
  description: 'Shout to nearby characters (150 feet)',
  category: 'social',
  usage: '/shout <message>',
  examples: [
    '/shout Anyone out there?!',
    '/y Help!',
  ],

  parameters: {
    positional: [
      {
        type: 'string',
        required: true,
        description: 'The message to shout',
      },
    ],
  },

  handler: async (context: CommandContext, args: ParsedCommand): Promise<CommandResult> => {
    const message = args.positionalArgs.join(' ');

    if (!message || message.trim().length === 0) {
      return {
        success: false,
        error: 'You must provide a message to shout.',
      };
    }

    if (message.length > 500) {
      return {
        success: false,
        error: 'Message too long (max 500 characters).',
      };
    }

    return {
      success: true,
      message: `You shout: "${message}"`,
      broadcast: true,
      events: [
        {
          type: 'speech',
          data: {
            speakerId: context.characterId,
            speakerName: context.characterName,
            message,
            channel: 'shout',
            range: 150, // feet
            position: context.position,
          },
        },
      ],
    };
  },
};
