/**
 * /move command - Move in a direction or toward a target
 */

import type { CommandDefinition, CommandContext, CommandResult, ParsedCommand } from '@/commands/types';

export const moveCommand: CommandDefinition = {
  name: 'move',
  aliases: ['walk', 'go'],
  description: 'Move in a direction or toward a target',
  category: 'movement',
  usage: '/move <direction|target> [heading:<degrees>] [to:<entity>] [range:<melee|short|medium|long>]',
  examples: [
    '/move north',
    '/move heading:45',
    '/move to:ant.worker.1',
    '/move to:Merchant range:short',
  ],

  parameters: {
    positional: [
      {
        type: 'string',
        required: false,
        description: 'Direction (n/s/e/w/ne/nw/se/sw) or target entity',
      },
    ],
    named: {
      heading: {
        type: 'number',
        required: false,
        description: 'Move at specific heading (0-360 degrees)',
      },
      to: {
        type: 'entity',
        required: false,
        description: 'Move toward entity',
      },
      range: {
        type: 'enum',
        required: false,
        enumValues: ['melee', 'short', 'medium', 'long'],
        description: 'Desired range from target (melee=5ft, short=20ft, medium=50ft, long=150ft)',
      },
    },
  },

  handler: async (context: CommandContext, args: ParsedCommand): Promise<CommandResult> => {
    const direction = args.positionalArgs[0];
    const heading = args.namedArgs.heading;
    const target = args.namedArgs.to;
    const range = args.namedArgs.range || 'melee';

    // Validate: must provide either direction, heading, or target
    if (!direction && !heading && !target) {
      return {
        success: false,
        error: 'Usage: /move <direction>, /move heading:<degrees>, or /move to:<entity>',
      };
    }

    // Parse direction to heading
    let finalHeading: number | undefined;

    if (heading) {
      const headingNum = parseInt(heading, 10);
      if (isNaN(headingNum) || headingNum < 0 || headingNum >= 360) {
        return {
          success: false,
          error: 'Heading must be between 0-359 degrees',
        };
      }
      finalHeading = headingNum;
    } else if (direction) {
      // Convert cardinal direction to heading
      const directionMap: Record<string, number> = {
        n: 0, north: 0,
        ne: 45, northeast: 45,
        e: 90, east: 90,
        se: 135, southeast: 135,
        s: 180, south: 180,
        sw: 225, southwest: 225,
        w: 270, west: 270,
        nw: 315, northwest: 315,
      };

      finalHeading = directionMap[direction.toLowerCase()];
      if (finalHeading === undefined) {
        return {
          success: false,
          error: `Invalid direction '${direction}'. Use: n, ne, e, se, s, sw, w, nw`,
        };
      }
    }

    // Convert range to distance
    const rangeDistances: Record<string, number> = {
      melee: 5,
      short: 20,
      medium: 50,
      long: 150,
    };

    const targetRange = rangeDistances[range] || 5;

    // Create movement event
    return {
      success: true,
      message: target
        ? `Moving toward ${target} (${range} range)...`
        : `Moving ${direction || `heading ${heading}`}...`,
      events: [
        {
          type: 'movement',
          data: {
            characterId: context.characterId,
            heading: finalHeading,
            target,
            targetRange,
            position: context.position,
            zoneId: context.zoneId,
          },
        },
      ],
    };
  },
};
