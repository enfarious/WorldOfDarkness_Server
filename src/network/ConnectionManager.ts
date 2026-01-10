import { Server as SocketIOServer, Socket } from 'socket.io';
import { logger } from '@/utils/logger';
import { ClientSession } from './ClientSession';
import { WorldManager } from '@/world/WorldManager';
import {
  HandshakeMessage,
  HandshakeAckMessage,
  AuthMessage,
  PingMessage,
  PongMessage,
} from './protocol/types';

/**
 * Manages all client connections and routes messages
 */
export class ConnectionManager {
  private sessions: Map<string, ClientSession> = new Map();
  private readonly PROTOCOL_VERSION = '1.0.0';
  private readonly SERVER_VERSION = '0.1.0';

  constructor(
    private io: SocketIOServer,
    private worldManager: WorldManager
  ) {
    this.setupSocketHandlers();
  }

  private setupSocketHandlers(): void {
    this.io.on('connection', (socket: Socket) => {
      logger.info(`New connection: ${socket.id} from ${socket.handshake.address}`);

      // Create session for this connection
      const session = new ClientSession(socket, this.worldManager);
      this.sessions.set(socket.id, session);

      // Handle handshake (first message from client)
      socket.on('handshake', (data: HandshakeMessage['payload']) => {
        this.handleHandshake(socket, session, data);
      });

      // Handle authentication (after handshake)
      socket.on('auth', async (data: AuthMessage['payload']) => {
        try {
          await session.authenticate(data);
        } catch (error) {
          logger.error({ error }, `Authentication failed for ${socket.id}`);
          socket.emit('auth_error', {
            reason: 'server_error',
            message: 'Authentication failed',
            canRetry: true,
          });
        }
      });

      // Handle ping/pong for connection health
      socket.on('ping', (data: PingMessage['payload']) => {
        const response: PongMessage['payload'] = {
          clientTimestamp: data.timestamp,
          serverTimestamp: Date.now(),
        };
        socket.emit('pong', response);
        session.updatePing();
      });

      // Handle disconnection
      socket.on('disconnect', async (reason) => {
        logger.info(`Client disconnected: ${socket.id}, reason: ${reason}`);
        this.sessions.delete(socket.id);
        await session.cleanup();
      });
    });
  }

  private handleHandshake(
    socket: Socket,
    session: ClientSession,
    data: HandshakeMessage['payload']
  ): void {
    logger.info({
      clientType: data.clientType,
      version: data.clientVersion,
      protocol: data.protocolVersion,
    }, `Handshake from ${socket.id}`);

    // Check protocol version compatibility
    const compatible = this.isProtocolCompatible(data.protocolVersion);

    // Store client info in session
    session.setClientInfo({
      type: data.clientType,
      version: data.clientVersion,
      capabilities: data.capabilities,
    });

    // Send handshake acknowledgment
    const response: HandshakeAckMessage['payload'] = {
      protocolVersion: this.PROTOCOL_VERSION,
      serverVersion: this.SERVER_VERSION,
      compatible,
      sessionId: socket.id,
      timestamp: Date.now(),
      requiresAuth: true,
    };

    socket.emit('handshake_ack', response);

    if (!compatible) {
      logger.warn(
        `Incompatible protocol version from ${socket.id}: ${data.protocolVersion}`
      );
      setTimeout(() => {
        socket.disconnect(true);
      }, 1000);
    } else {
      logger.info(`Handshake completed for ${socket.id}, awaiting authentication`);
    }
  }

  private isProtocolCompatible(clientVersion: string): boolean {
    // For now, only accept exact match
    // In the future, implement semantic versioning compatibility
    return clientVersion === this.PROTOCOL_VERSION;
  }

  getPlayerCount(): number {
    return Array.from(this.sessions.values()).filter(
      (session) => session.isAuthenticated()
    ).length;
  }

  async disconnectAll(): Promise<void> {
    const disconnectPromises = Array.from(this.sessions.values()).map(
      (session) => session.disconnect()
    );
    await Promise.all(disconnectPromises);
    this.sessions.clear();
  }

  getSession(socketId: string): ClientSession | undefined {
    return this.sessions.get(socketId);
  }
}
