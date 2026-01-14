/**
 * /move command - Move in a direction or toward a target
 *
 * Supports:
 *   /move north              - Walk north indefinitely
 *   /move north run          - Run north indefinitely
 *   /move north 10m          - Walk north for 10 meters then stop
 *   /move north run 10m      - Run north for 10 meters then stop
 *   /move to:Merchant        - Move toward entity until melee range
 *   /move to:Merchant range:short - Move toward entity until short range (20ft)
 *   /move to:100,50          - Move to coordinates (x,z)
 *   /move to:100,25,50       - Move to coordinates (x,y,z)
 */

import type { CommandDefinition, CommandContext, CommandResult, ParsedCommand } from '@/commands/types';
import type { MovementSpeed } from '@/network/protocol/types';

const DIRECTION_MAP: Record<string, number> = {
  n: 0, north: 0,
  ne: 45, northeast: 45,
  e: 90, east: 90,
  se: 135, southeast: 135,
  s: 180, south: 180,
  sw: 225, southwest: 225,
  w: 270, west: 270,
  nw: 315, northwest: 315,
};

const SPEED_VALUES: Record<string, MovementSpeed> = {
  walk: 'walk',
  jog: 'jog',
  run: 'run',
};

const RANGE_DISTANCES: Record<string, number> = {
  melee: 5,
  short: 20,
  medium: 50,
  long: 150,
};

/**
 * Parse coordinate string like "100,50" (x,z) or "100,25,50" (x,y,z)
 * Returns {x, y, z} or null if invalid
 */
function parseCoordinates(str: string): { x: number; y?: number; z: number } | null {
  const parts = str.split(',').map(p => p.trim());

  if (parts.length === 2) {
    // x,z format (y will be determined by terrain)
    const x = parseFloat(parts[0]);
    const z = parseFloat(parts[1]);
    if (isNaN(x) || isNaN(z)) return null;
    return { x, z };
  }

  if (parts.length === 3) {
    // x,y,z format
    const x = parseFloat(parts[0]);
    const y = parseFloat(parts[1]);
    const z = parseFloat(parts[2]);
    if (isNaN(x) || isNaN(y) || isNaN(z)) return null;
    return { x, y, z };
  }

  return null;
}

/**
 * Parse distance string like "10m", "10ft", "10" (defaults to meters)
 * Returns distance in meters (feet converted to meters)
 */
function parseDistance(str: string): number | null {
  const match = str.match(/^(\d+(?:\.\d+)?)(m|ft)?$/i);
  if (!match) return null;

  const value = parseFloat(match[1]);
  const unit = (match[2] || 'm').toLowerCase();

  // Convert feet to meters (1 foot ≈ 0.3048 meters)
  return unit === 'ft' ? value * 0.3048 : value;
}

export const moveCommand: CommandDefinition = {
  name: 'move',
  aliases: ['walk', 'go', 'run'],
  description: 'Move in a direction or toward a target',
  category: 'movement',
  usage: '/move <direction> [walk|jog|run] [distance] | /move to:<entity|x,z|x,y,z> [range:<melee|short|medium|long>]',
  examples: [
    '/move north',
    '/move north run',
    '/move north 10m',
    '/move north run 10m',
    '/move to:Merchant',
    '/move to:Merchant range:short',
    '/move to:100,50',
    '/move to:100,25,50 run',
  ],

  parameters: {
    positional: [
      {
        type: 'string',
        required: false,
        description: 'Direction (n/s/e/w/ne/nw/se/sw), speed (walk/jog/run), or distance (e.g. 10m)',
      },
      {
        type: 'string',
        required: false,
        description: 'Speed (walk/jog/run) or distance (e.g. 10m)',
      },
      {
        type: 'string',
        required: false,
        description: 'Distance (e.g. 10m)',
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
    const target = args.namedArgs.to;
    const range = args.namedArgs.range || 'melee';
    const headingArg = args.namedArgs.heading;

    // Check if target is coordinates (x,z or x,y,z)
    let targetPosition: { x: number; y?: number; z: number } | undefined;
    let entityTarget: string | undefined;

    if (target) {
      const coords = parseCoordinates(target);
      if (coords) {
        targetPosition = coords;
      } else {
        entityTarget = target;
      }
    }

    // Parse positional args: could be direction, speed, or distance in any order
    let direction: string | undefined;
    let speed: MovementSpeed = 'walk';
    let distance: number | undefined;

    for (const arg of args.positionalArgs) {
      if (!arg) continue;
      const lower = arg.toLowerCase();

      // Check if it's a direction
      if (DIRECTION_MAP[lower] !== undefined) {
        direction = lower;
        continue;
      }

      // Check if it's a speed
      if (SPEED_VALUES[lower]) {
        speed = SPEED_VALUES[lower];
        continue;
      }

      // Check if it's a distance
      const parsedDistance = parseDistance(arg);
      if (parsedDistance !== null) {
        distance = parsedDistance;
        continue;
      }

      // Unknown arg - might be trying to target by name without to:
      return {
        success: false,
        error: `Unknown argument '${arg}'. Use direction (n/ne/e/se/s/sw/w/nw), speed (walk/jog/run), or distance (e.g. 10m)`,
      };
    }

    // Validate: must provide either direction, heading, target entity, or target position
    if (!direction && !headingArg && !entityTarget && !targetPosition) {
      return {
        success: false,
        error: 'Usage: /move <direction> [speed] [distance], /move to:<entity>, or /move to:<x,z>',
      };
    }

    // Parse heading from direction or explicit heading arg
    let finalHeading: number | undefined;

    if (headingArg) {
      const headingNum = parseInt(headingArg, 10);
      if (isNaN(headingNum) || headingNum < 0 || headingNum >= 360) {
        return {
          success: false,
          error: 'Heading must be between 0-359 degrees',
        };
      }
      finalHeading = headingNum;
    } else if (direction) {
      finalHeading = DIRECTION_MAP[direction];
    }

    // Convert range to distance (in feet, matching protocol)
    const targetRange = RANGE_DISTANCES[range] || 5;

    // Build response message
    let message: string;
    if (targetPosition) {
      const posStr = targetPosition.y !== undefined
        ? `(${targetPosition.x}, ${targetPosition.y}, ${targetPosition.z})`
        : `(${targetPosition.x}, ${targetPosition.z})`;
      const speedStr = speed !== 'walk' ? ` at a ${speed}` : '';
      message = `Moving to ${posStr}${speedStr}...`;
    } else if (entityTarget) {
      message = `Moving toward ${entityTarget} (${range} range)...`;
    } else {
      const dirStr = direction || `heading ${headingArg}`;
      const speedStr = speed !== 'walk' ? ` at a ${speed}` : '';
      const distStr = distance ? ` for ${distance.toFixed(1)}m` : '';
      message = `Moving ${dirStr}${speedStr}${distStr}...`;
    }

    // Create movement event
    return {
      success: true,
      message,
      events: [
        {
          type: 'movement_start',
          data: {
            characterId: context.characterId,
            zoneId: context.zoneId,
            startPosition: context.position,
            heading: finalHeading,
            speed,
            distance,           // undefined = move indefinitely
            target: entityTarget, // entity name/id to move toward
            targetPosition,     // coordinates to move toward
            targetRange,        // stop when this close to target (feet)
          },
        },
      ],
    };
  },
};
