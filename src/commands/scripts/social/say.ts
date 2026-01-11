/**
 * /say command - Local speech (20 feet range)
 */

import type { CommandDefinition, CommandContext, CommandResult, ParsedCommand } from '@/commands/types';

export const sayCommand: CommandDefinition = {
  name: 'say',
  aliases: ['s'],
  description: 'Speak to nearby characters (20 feet)',
  category: 'social',
  usage: '/say <message>',
  examples: [
    '/say Hello everyone!',
    '/s Anyone seen any supplies around here?',
  ],

  parameters: {
    positional: [
      {
        type: 'string',
        required: true,
        description: 'The message to speak',
      },
    ],
  },

  handler: async (context: CommandContext, args: ParsedCommand): Promise<CommandResult> => {
    const message = args.positionalArgs.join(' ');

    if (!message || message.trim().length === 0) {
      return {
        success: false,
        error: 'You must provide a message to say.',
      };
    }

    if (message.length > 500) {
      return {
        success: false,
        error: 'Message too long (max 500 characters).',
      };
    }

    // Create speech event for broadcast
    return {
      success: true,
      message: `You say: "${message}"`,
      broadcast: true,
      events: [
        {
          type: 'speech',
          data: {
            speakerId: context.characterId,
            speakerName: context.characterName,
            message,
            channel: 'say',
            range: 20,  // feet
            position: context.position,
          },
        },
      ],
    };
  },
};
