import { logger } from '@/utils/logger';
import { ZoneService } from '@/database';
import { ZoneManager } from './ZoneManager';
import type { Server as SocketIOServer } from 'socket.io';
import type { Character } from '@prisma/client';

/**
 * Manages the entire game world - all zones and their entities
 */
export class WorldManager {
  private zones: Map<string, ZoneManager> = new Map();
  private io: SocketIOServer | null = null;
  private characterToZone: Map<string, string> = new Map(); // characterId -> zoneId for quick lookups
  private proximityRosterHashes: Map<string, string> = new Map(); // characterId -> roster hash (for dirty checking - legacy)
  private previousRosters: Map<string, any> = new Map(); // characterId -> previous roster (for delta calculation)

  /**
   * Set Socket.IO server for broadcasting
   */
  setIO(io: SocketIOServer): void {
    this.io = io;
  }

  /**
   * Initialize world manager - load all zones from database
   */
  async initialize(): Promise<void> {
    logger.info('Initializing world manager...');

    // Load all zones from database
    const allZones = await ZoneService.findAll();

    for (const zone of allZones) {
      const zoneManager = new ZoneManager(zone);
      await zoneManager.initialize();
      this.zones.set(zone.id, zoneManager);
    }

    logger.info(`World manager initialized with ${this.zones.size} zones`);
  }

  /**
   * Get or create zone manager for a zone
   */
  async getZoneManager(zoneId: string): Promise<ZoneManager | null> {
    // Return existing zone manager
    if (this.zones.has(zoneId)) {
      return this.zones.get(zoneId)!;
    }

    // Load zone from database if not in memory
    const zone = await ZoneService.findById(zoneId);
    if (!zone) {
      logger.warn({ zoneId }, 'Zone not found in database');
      return null;
    }

    // Create and initialize new zone manager
    const zoneManager = new ZoneManager(zone);
    await zoneManager.initialize();
    this.zones.set(zoneId, zoneManager);

    logger.info({ zoneId, zoneName: zone.name }, 'Loaded zone on demand');
    return zoneManager;
  }

  /**
   * Add a player to a zone
   */
  async addPlayerToZone(character: Character, socketId: string, isMachine: boolean = false): Promise<void> {
    const zoneManager = await this.getZoneManager(character.zoneId);
    if (!zoneManager) {
      logger.error({ characterId: character.id, zoneId: character.zoneId }, 'Cannot add player to zone - zone not found');
      return;
    }

    zoneManager.addPlayer(character, socketId, isMachine);
    this.characterToZone.set(character.id, character.zoneId);

    // Send proximity roster to the player
    this.sendProximityRosterToPlayer(character.id);

    // Broadcast to nearby players that someone entered
    this.broadcastNearbyUpdate(character.zoneId);
  }

  /**
   * Remove a player from a zone
   */
  async removePlayerFromZone(characterId: string, zoneId: string): Promise<void> {
    const zoneManager = this.zones.get(zoneId);
    if (!zoneManager) return;

    zoneManager.removePlayer(characterId);
    this.characterToZone.delete(characterId);

    // Clean up proximity roster data
    this.proximityRosterHashes.delete(characterId);
    this.previousRosters.delete(characterId);

    // Broadcast to nearby players that someone left
    this.broadcastNearbyUpdate(zoneId);
  }

  /**
   * Update player position and broadcast updates
   */
  async updatePlayerPosition(
    characterId: string,
    zoneId: string,
    position: { x: number; y: number; z: number }
  ): Promise<void> {
    const zoneManager = this.zones.get(zoneId);
    if (!zoneManager) return;

    zoneManager.updatePlayerPosition(characterId, position);

    // Send updated proximity roster to the player
    this.sendProximityRosterToPlayer(characterId);

    // Broadcast to nearby players about position change
    this.broadcastNearbyUpdate(zoneId);
  }

  /**
   * Send proximity roster delta to a specific player (only if changed)
   */
  private sendProximityRosterToPlayer(characterId: string): void {
    // Find which zone the character is in
    const zoneId = this.characterToZone.get(characterId);
    if (!zoneId) return;

    const zoneManager = this.zones.get(zoneId);
    if (!zoneManager || !this.io) return;

    // Get previous roster for delta calculation
    const previousRoster = this.previousRosters.get(characterId);

    // Calculate delta
    const result = zoneManager.calculateProximityRosterDelta(characterId, previousRoster);

    // If result is null, roster hasn't changed - don't send
    if (!result) {
      return;
    }

    const { delta, roster } = result;

    // Store new roster for next delta calculation
    this.previousRosters.set(characterId, roster);

    const socketId = zoneManager.getSocketIdForCharacter(characterId);
    if (!socketId) return;

    // Send proximity roster delta to the player
    this.io.to(socketId).emit('proximity_roster_delta', {
      ...delta,
      timestamp: Date.now(),
    });
  }

  /**
   * Broadcast proximity roster updates to all nearby players in a zone
   */
  private broadcastNearbyUpdate(zoneId: string): void {
    const zoneManager = this.zones.get(zoneId);
    if (!zoneManager || !this.io) return;

    // Send updated rosters to all players in the zone
    // For each character in the zone, calculate and send their updated roster
    for (const [characterId, charZoneId] of this.characterToZone.entries()) {
      if (charZoneId === zoneId) {
        this.sendProximityRosterToPlayer(characterId);
      }
    }
  }

  /**
   * Record last speaker for proximity tracking
   */
  recordLastSpeaker(zoneId: string, listenerId: string, speakerName: string): void {
    const zoneManager = this.zones.get(zoneId);
    if (zoneManager) {
      zoneManager.recordLastSpeaker(listenerId, speakerName);
    }
  }

  /**
   * Get socket IDs of players in range (for broadcasting messages)
   */
  getPlayersInRange(
    zoneId: string,
    position: { x: number; y: number; z: number },
    range: number,
    excludeCharacterId?: string
  ): string[] {
    const zoneManager = this.zones.get(zoneId);
    if (!zoneManager) return [];

    return zoneManager.getPlayerSocketIdsInRange(position, range, excludeCharacterId);
  }

  /**
   * Update tick - called by game loop
   */
  update(_deltaTime: number): void {
    // TODO: Update world simulation
    // - Weather changes
    // - Time of day
    // - NPC AI
    // - Combat ticks
  }

  /**
   * Get world statistics
   */
  getStats(): { totalZones: number; loadedZones: number; totalPlayers: number } {
    let totalPlayers = 0;

    for (const zoneManager of this.zones.values()) {
      totalPlayers += zoneManager.getPlayerCount();
    }

    return {
      totalZones: this.zones.size,
      loadedZones: this.zones.size,
      totalPlayers,
    };
  }
}
