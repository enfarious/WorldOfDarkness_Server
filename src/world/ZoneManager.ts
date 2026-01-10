import { logger } from '@/utils/logger';
import { ZoneService } from '@/database';
import { COMMUNICATION_RANGES } from '@/network/protocol/types';
import type { ProximityRosterMessage, ProximityChannel } from '@/network/protocol/types';
import type { Character, Zone } from '@prisma/client';

interface Vector3 {
  x: number;
  y: number;
  z: number;
}

interface Entity {
  id: string;
  name: string;
  type: 'player' | 'npc' | 'companion';
  position: Vector3;
  socketId?: string; // For players only
  inCombat?: boolean;
}

/**
 * Manages a single zone - tracks entities, calculates proximity, broadcasts updates
 */
export class ZoneManager {
  private zone: Zone;
  private entities: Map<string, Entity> = new Map();
  private lastSpeaker: Map<string, { speaker: string; timestamp: number }> = new Map(); // entityId -> lastSpeaker info

  constructor(zone: Zone) {
    this.zone = zone;
  }

  /**
   * Initialize zone with entities from database
   */
  async initialize(): Promise<void> {
    logger.info({ zoneId: this.zone.id, zoneName: this.zone.name }, 'Initializing zone');

    // Load companions (NPCs) in this zone
    const companions = await ZoneService.getCompanionsInZone(this.zone.id);

    for (const companion of companions) {
      this.entities.set(companion.id, {
        id: companion.id,
        name: companion.name,
        type: 'companion',
        position: {
          x: companion.positionX,
          y: companion.positionY,
          z: companion.positionZ,
        },
        inCombat: false,
      });
    }

    logger.info(
      { zoneId: this.zone.id, entityCount: this.entities.size },
      'Zone initialized with entities'
    );
  }

  /**
   * Add a player to the zone
   */
  addPlayer(character: Character, socketId: string): void {
    const entity: Entity = {
      id: character.id,
      name: character.name,
      type: 'player',
      position: {
        x: character.positionX,
        y: character.positionY,
        z: character.positionZ,
      },
      socketId,
      inCombat: false,
    };

    this.entities.set(character.id, entity);
    logger.info({ characterId: character.id, characterName: character.name, zoneId: this.zone.id }, 'Player entered zone');
  }

  /**
   * Remove a player from the zone
   */
  removePlayer(characterId: string): void {
    const entity = this.entities.get(characterId);
    if (entity) {
      this.entities.delete(characterId);
      logger.info({ characterId, characterName: entity.name, zoneId: this.zone.id }, 'Player left zone');
    }
  }

  /**
   * Update player position
   */
  updatePlayerPosition(characterId: string, position: Vector3): void {
    const entity = this.entities.get(characterId);
    if (entity) {
      entity.position = position;
    }
  }

  /**
   * Set combat state for an entity
   */
  setEntityCombatState(entityId: string, inCombat: boolean): void {
    const entity = this.entities.get(entityId);
    if (entity) {
      entity.inCombat = inCombat;
    }
  }

  /**
   * Record who last spoke to a specific entity
   */
  recordLastSpeaker(listenerId: string, speakerName: string): void {
    this.lastSpeaker.set(listenerId, {
      speaker: speakerName,
      timestamp: Date.now(),
    });

    // Clear after 30 seconds
    setTimeout(() => {
      const record = this.lastSpeaker.get(listenerId);
      if (record && record.speaker === speakerName) {
        this.lastSpeaker.delete(listenerId);
      }
    }, 30000);
  }

  /**
   * Calculate 3D distance between two positions
   */
  private calculateDistance(pos1: Vector3, pos2: Vector3): number {
    const dx = pos2.x - pos1.x;
    const dy = pos2.y - pos1.y;
    const dz = pos2.z - pos1.z;
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
  }

  /**
   * Get entities within a specific range of a position
   */
  private getEntitiesInRange(origin: Vector3, range: number, excludeId?: string): Entity[] {
    const nearbyEntities: Entity[] = [];

    for (const entity of this.entities.values()) {
      if (entity.id === excludeId) continue;

      const distance = this.calculateDistance(origin, entity.position);
      if (distance <= range) {
        nearbyEntities.push(entity);
      }
    }

    // Sort by distance (closest first)
    nearbyEntities.sort((a, b) => {
      const distA = this.calculateDistance(origin, a.position);
      const distB = this.calculateDistance(origin, b.position);
      return distA - distB;
    });

    return nearbyEntities;
  }

  /**
   * Build proximity channel data
   */
  private buildProximityChannel(
    entities: Entity[],
    listenerId: string
  ): ProximityChannel {
    const count = entities.length;
    const channel: ProximityChannel = { count };

    // Add sample names if 1-3 entities
    if (count > 0 && count <= 3) {
      channel.sample = entities.map(e => e.name);

      // Add lastSpeaker if available
      const lastSpeakerRecord = this.lastSpeaker.get(listenerId);
      if (lastSpeakerRecord && channel.sample.includes(lastSpeakerRecord.speaker)) {
        channel.lastSpeaker = lastSpeakerRecord.speaker;
      }
    }

    return channel;
  }

  /**
   * Calculate proximity roster for a specific entity
   */
  calculateProximityRoster(entityId: string): ProximityRosterMessage['payload'] | null {
    const entity = this.entities.get(entityId);
    if (!entity) return null;

    const position = entity.position;

    // Get entities in each range
    const inTouch = this.getEntitiesInRange(position, COMMUNICATION_RANGES.touch, entityId);
    const inSay = this.getEntitiesInRange(position, COMMUNICATION_RANGES.say, entityId);
    const inShout = this.getEntitiesInRange(position, COMMUNICATION_RANGES.shout, entityId);
    const inEmote = this.getEntitiesInRange(position, COMMUNICATION_RANGES.emote, entityId);
    const inSee = this.getEntitiesInRange(position, COMMUNICATION_RANGES.see, entityId);
    const inHear = this.getEntitiesInRange(position, COMMUNICATION_RANGES.hear, entityId);
    const inCFH = this.getEntitiesInRange(position, COMMUNICATION_RANGES.cfh, entityId);

    // Build proximity channels
    const roster: ProximityRosterMessage['payload'] = {
      channels: {
        touch: this.buildProximityChannel(inTouch, entityId),
        say: this.buildProximityChannel(inSay, entityId),
        shout: this.buildProximityChannel(inShout, entityId),
        emote: this.buildProximityChannel(inEmote, entityId),
        see: this.buildProximityChannel(inSee, entityId),
        hear: this.buildProximityChannel(inHear, entityId),
        cfh: this.buildProximityChannel(inCFH, entityId),
      },
      dangerState: entity.inCombat || false,
    };

    return roster;
  }

  /**
   * Get all player socket IDs in the zone
   */
  getPlayerSocketIds(): string[] {
    const socketIds: string[] = [];
    for (const entity of this.entities.values()) {
      if (entity.type === 'player' && entity.socketId) {
        socketIds.push(entity.socketId);
      }
    }
    return socketIds;
  }

  /**
   * Get socket ID for a specific character
   */
  getSocketIdForCharacter(characterId: string): string | null {
    const entity = this.entities.get(characterId);
    return entity?.socketId || null;
  }

  /**
   * Get all player socket IDs within a specific range of a position
   */
  getPlayerSocketIdsInRange(origin: Vector3, range: number, excludeId?: string): string[] {
    const nearbyEntities = this.getEntitiesInRange(origin, range, excludeId);
    const socketIds: string[] = [];

    for (const entity of nearbyEntities) {
      if (entity.type === 'player' && entity.socketId) {
        socketIds.push(entity.socketId);
      }
    }

    return socketIds;
  }

  /**
   * Get zone info
   */
  getZone(): Zone {
    return this.zone;
  }

  /**
   * Get entity count
   */
  getEntityCount(): number {
    return this.entities.size;
  }

  /**
   * Get player count
   */
  getPlayerCount(): number {
    let count = 0;
    for (const entity of this.entities.values()) {
      if (entity.type === 'player') count++;
    }
    return count;
  }
}
