import { logger } from '@/utils/logger';
import { db } from '@/database';
import { MessageBus, ZoneRegistry } from '@/messaging';
import { DistributedWorldManager } from '@/world/DistributedWorldManager';

interface ZoneServerConfig {
  serverId: string;
  tickRate: number;
  redisUrl?: string;
  assignedZones?: string[]; // Specific zones to manage, empty = all zones
}

/**
 * Zone Server - processes game logic for assigned zones
 *
 * Receives player actions via Redis, processes them, and publishes results
 * Does NOT handle WebSocket connections - that's the Gateway's job
 */
export class ZoneServer {
  private messageBus: MessageBus;
  private zoneRegistry: ZoneRegistry;
  private worldManager: DistributedWorldManager | null = null;

  private tickRate: number;
  private tickInterval: NodeJS.Timeout | null = null;
  private lastTickTime: number = 0;

  constructor(private config: ZoneServerConfig) {
    this.tickRate = config.tickRate;
    this.messageBus = new MessageBus(config.redisUrl);
    this.zoneRegistry = new ZoneRegistry(this.messageBus, config.serverId);
  }

  async start(): Promise<void> {
    logger.info({ serverId: this.config.serverId }, 'Starting Zone Server');

    // Connect to database
    logger.info('Connecting to database...');
    await db.connect();

    // Connect to Redis
    logger.info('Connecting to Redis...');
    await this.messageBus.connect();

    // Start heartbeat
    this.zoneRegistry.startHeartbeat();

    // Initialize world manager with assigned zones
    this.worldManager = new DistributedWorldManager(
      this.messageBus,
      this.zoneRegistry,
      this.config.serverId,
      this.config.assignedZones || []
    );

    await this.worldManager.initialize();

    // Start game loop
    this.startGameLoop();

    logger.info({
      serverId: this.config.serverId,
      zones: this.config.assignedZones?.length || 'all',
      tickRate: this.tickRate
    }, 'Zone Server fully initialized');
  }

  private startGameLoop(): void {
    const tickIntervalMs = 1000 / this.tickRate;
    this.lastTickTime = Date.now();

    this.tickInterval = setInterval(() => {
      const now = Date.now();
      const deltaTime = (now - this.lastTickTime) / 1000;
      this.lastTickTime = now;

      this.tick(deltaTime);
    }, tickIntervalMs);

    logger.info(`Game loop started at ${this.tickRate} ticks per second`);
  }

  private tick(deltaTime: number): void {
    // Update world simulation
    if (this.worldManager) {
      this.worldManager.update(deltaTime);
    }

    // TODO: Update other systems
    // - Combat system
    // - AI/Wildlife
    // - Status effects
  }

  async shutdown(): Promise<void> {
    logger.info('Shutting down Zone Server...');

    // Stop game loop
    if (this.tickInterval) {
      clearInterval(this.tickInterval);
      this.tickInterval = null;
    }

    // Shutdown world manager
    if (this.worldManager) {
      await this.worldManager.shutdown();
    }

    // Cleanup registry
    await this.zoneRegistry.cleanup();

    // Disconnect from Redis
    await this.messageBus.disconnect();

    // Disconnect from database
    await db.disconnect();

    logger.info('Zone Server shutdown complete');
  }

  /**
   * Get server statistics
   */
  getStats() {
    if (!this.worldManager) {
      return {
        serverId: this.config.serverId,
        zones: 0,
        players: 0,
      };
    }

    const worldStats = this.worldManager.getStats();

    return {
      serverId: this.config.serverId,
      zones: worldStats.loadedZones,
      players: worldStats.totalPlayers,
    };
  }
}
