import { Server as SocketIOServer, Socket } from 'socket.io';
import { logger } from '@/utils/logger';
import { MessageBus, ZoneRegistry } from '@/messaging';
import { GatewayClientSession } from './GatewayClientSession';

/**
 * Gateway Connection Manager - manages all client connections
 *
 * Routes client messages to appropriate Zone servers via Redis
 */
export class GatewayConnectionManager {
  private sessions: Map<string, GatewayClientSession> = new Map();

  constructor(
    private io: SocketIOServer,
    private messageBus: MessageBus,
    private zoneRegistry: ZoneRegistry
  ) {
    this.setupSocketHandlers();
  }

  private setupSocketHandlers(): void {
    this.io.on('connection', (socket: Socket) => {
      this.handleConnection(socket);
    });

    logger.info('Gateway connection manager initialized');
  }

  private handleConnection(socket: Socket): void {
    logger.info(`Client connected: ${socket.id}`);

    const session = new GatewayClientSession(
      socket,
      this.messageBus,
      this.zoneRegistry
    );

    this.sessions.set(socket.id, session);

    socket.on('disconnect', async (reason) => {
      logger.info({ socketId: socket.id, reason }, 'Client disconnected');

      await session.cleanup();
      this.sessions.delete(socket.id);
    });
  }

  getPlayerCount(): number {
    return this.sessions.size;
  }

  async disconnectAll(): Promise<void> {
    logger.info(`Disconnecting ${this.sessions.size} clients...`);

    for (const session of this.sessions.values()) {
      await session.disconnect();
      await session.cleanup();
    }

    this.sessions.clear();
  }
}
