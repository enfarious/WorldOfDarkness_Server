import { logger } from '@/utils/logger';
import type { MessageBus } from './MessageBus';

export interface ZoneAssignment {
  zoneId: string;
  serverId: string;
  serverHost: string;
  assignedAt: number;
}

export interface PlayerLocation {
  characterId: string;
  zoneId: string;
  socketId: string;
  serverId: string;
  lastUpdate: number;
}

/**
 * Zone Registry - tracks which zones are hosted on which servers
 *
 * Uses Redis for shared state between Gateway and Zone servers
 */
export class ZoneRegistry {
  private readonly ZONE_ASSIGNMENT_PREFIX = 'zone:assignment:';
  private readonly PLAYER_LOCATION_PREFIX = 'player:location:';
  private readonly SERVER_HEARTBEAT_PREFIX = 'server:heartbeat:';
  private readonly HEARTBEAT_INTERVAL = 5000; // 5 seconds
  private readonly HEARTBEAT_TIMEOUT = 15000; // 15 seconds

  private heartbeatInterval: NodeJS.Timeout | null = null;

  constructor(
    private messageBus: MessageBus,
    private serverId: string
  ) {}

  /**
   * Start heartbeat for this server
   */
  startHeartbeat(): void {
    this.heartbeatInterval = setInterval(async () => {
      await this.sendHeartbeat();
    }, this.HEARTBEAT_INTERVAL);

    logger.info({ serverId: this.serverId }, 'Zone registry heartbeat started');
  }

  /**
   * Stop heartbeat
   */
  stopHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  /**
   * Send heartbeat to indicate server is alive
   */
  private async sendHeartbeat(): Promise<void> {
    const client = this.messageBus.getClient();
    const key = `${this.SERVER_HEARTBEAT_PREFIX}${this.serverId}`;

    await client.setEx(key, Math.floor(this.HEARTBEAT_TIMEOUT / 1000), Date.now().toString());
  }

  /**
   * Register that this server is hosting a zone
   */
  async assignZone(zoneId: string, serverHost: string): Promise<void> {
    const client = this.messageBus.getClient();
    const key = `${this.ZONE_ASSIGNMENT_PREFIX}${zoneId}`;

    const assignment: ZoneAssignment = {
      zoneId,
      serverId: this.serverId,
      serverHost,
      assignedAt: Date.now(),
    };

    await client.set(key, JSON.stringify(assignment));

    logger.info({ zoneId, serverId: this.serverId }, 'Zone assigned to server');
  }

  /**
   * Unregister a zone from this server
   */
  async unassignZone(zoneId: string): Promise<void> {
    const client = this.messageBus.getClient();
    const key = `${this.ZONE_ASSIGNMENT_PREFIX}${zoneId}`;

    await client.del(key);

    logger.info({ zoneId, serverId: this.serverId }, 'Zone unassigned from server');
  }

  /**
   * Get which server is hosting a zone
   */
  async getZoneAssignment(zoneId: string): Promise<ZoneAssignment | null> {
    const client = this.messageBus.getClient();
    const key = `${this.ZONE_ASSIGNMENT_PREFIX}${zoneId}`;

    const data = await client.get(key);
    if (!data) return null;

    return JSON.parse(data) as ZoneAssignment;
  }

  /**
   * Update player location in registry
   */
  async updatePlayerLocation(characterId: string, zoneId: string, socketId: string): Promise<void> {
    const client = this.messageBus.getClient();
    const key = `${this.PLAYER_LOCATION_PREFIX}${characterId}`;

    const location: PlayerLocation = {
      characterId,
      zoneId,
      socketId,
      serverId: this.serverId,
      lastUpdate: Date.now(),
    };

    // Set with 1 hour expiration (auto-cleanup for disconnected players)
    await client.setEx(key, 3600, JSON.stringify(location));
  }

  /**
   * Get player location from registry
   */
  async getPlayerLocation(characterId: string): Promise<PlayerLocation | null> {
    const client = this.messageBus.getClient();
    const key = `${this.PLAYER_LOCATION_PREFIX}${characterId}`;

    const data = await client.get(key);
    if (!data) return null;

    return JSON.parse(data) as PlayerLocation;
  }

  /**
   * Remove player from registry (on disconnect)
   */
  async removePlayer(characterId: string): Promise<void> {
    const client = this.messageBus.getClient();
    const key = `${this.PLAYER_LOCATION_PREFIX}${characterId}`;

    await client.del(key);

    logger.debug({ characterId }, 'Player removed from registry');
  }

  /**
   * Get all zone assignments
   */
  async getAllZoneAssignments(): Promise<ZoneAssignment[]> {
    const client = this.messageBus.getClient();
    const pattern = `${this.ZONE_ASSIGNMENT_PREFIX}*`;

    const keys = await client.keys(pattern);
    const assignments: ZoneAssignment[] = [];

    for (const key of keys) {
      const data = await client.get(key);
      if (data) {
        assignments.push(JSON.parse(data) as ZoneAssignment);
      }
    }

    return assignments;
  }

  /**
   * Check if a server is alive based on heartbeat
   */
  async isServerAlive(serverId: string): Promise<boolean> {
    const client = this.messageBus.getClient();
    const key = `${this.SERVER_HEARTBEAT_PREFIX}${serverId}`;

    const exists = await client.exists(key);
    return exists === 1;
  }

  /**
   * Get all active servers
   */
  async getActiveServers(): Promise<string[]> {
    const client = this.messageBus.getClient();
    const pattern = `${this.SERVER_HEARTBEAT_PREFIX}*`;

    const keys = await client.keys(pattern);
    return keys.map(key => key.replace(this.SERVER_HEARTBEAT_PREFIX, ''));
  }

  /**
   * Clean up this server's assignments on shutdown
   */
  async cleanup(): Promise<void> {
    this.stopHeartbeat();

    // Remove all zone assignments for this server
    const assignments = await this.getAllZoneAssignments();
    for (const assignment of assignments) {
      if (assignment.serverId === this.serverId) {
        await this.unassignZone(assignment.zoneId);
      }
    }

    logger.info({ serverId: this.serverId }, 'Zone registry cleaned up');
  }
}
