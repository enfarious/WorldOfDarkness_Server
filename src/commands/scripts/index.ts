/**
 * Command scripts index - auto-loads all command definitions
 */

import { CommandRegistry } from '../CommandRegistry';

// Import all command scripts
import { sayCommand } from './social/say';
import { tellCommand } from './social/tell';
import { emoteCommand } from './social/emote';
import { shoutCommand } from './social/shout';

import { lookCommand } from './perception/look';
import { listenCommand } from './perception/listen';
import { senseCommand } from './perception/sense';

import { helpCommand } from './system/help';
import { statsCommand } from './system/stats';
import { inventoryCommand } from './system/inventory';

import { moveCommand } from './movement/move';
import { stopCommand } from './movement/stop';

/**
 * Register all Phase 1 commands
 */
export function registerAllCommands(registry: CommandRegistry): void {
  // Social commands
  registry.register(sayCommand);
  registry.register(tellCommand);
  registry.register(emoteCommand);
  registry.register(shoutCommand);

  // Perception commands
  registry.register(lookCommand);
  registry.register(listenCommand);
  registry.register(senseCommand);

  // System commands
  registry.register(helpCommand);
  registry.register(statsCommand);
  registry.register(inventoryCommand);

  // Movement commands
  registry.register(moveCommand);
  registry.register(stopCommand);
}

/**
 * Get list of all registered command names (for documentation)
 */
export function getAllCommandNames(): string[] {
  return [
    // Social
    'say', 'tell', 'emote', 'shout',
    // Perception
    'look', 'listen', 'sense',
    // System
    'help', 'stats', 'inventory',
    // Movement
    'move', 'stop',
  ];
}
