import { PrismaClient } from '@prisma/client';
import { logger } from '@/utils/logger';

/**
 * Singleton database service
 * Provides clean access to Prisma Client across the application
 */
class DatabaseService {
  private static instance: DatabaseService;
  private prisma: PrismaClient;

  private constructor() {
    this.prisma = new PrismaClient({
      log: [
        { level: 'query', emit: 'event' },
        { level: 'error', emit: 'event' },
        { level: 'warn', emit: 'event' },
      ],
    });

    // Log database queries in development
    if (process.env.NODE_ENV === 'development') {
      this.prisma.$on('query' as never, (e: unknown) => {
        const event = e as { query: string; duration: number };
        logger.debug({ query: event.query, duration: event.duration }, 'Database query');
      });
    }

    this.prisma.$on('error' as never, (e: unknown) => {
      const event = e as { message: string };
      logger.error({ error: event.message }, 'Database error');
    });

    this.prisma.$on('warn' as never, (e: unknown) => {
      const event = e as { message: string };
      logger.warn({ warning: event.message }, 'Database warning');
    });
  }

  public static getInstance(): DatabaseService {
    if (!DatabaseService.instance) {
      DatabaseService.instance = new DatabaseService();
    }
    return DatabaseService.instance;
  }

  /**
   * Get Prisma Client instance
   */
  public getClient(): PrismaClient {
    return this.prisma;
  }

  /**
   * Connect to database
   */
  public async connect(): Promise<void> {
    try {
      await this.prisma.$connect();
      logger.info('Database connected successfully');
    } catch (error) {
      logger.error({ error }, 'Failed to connect to database');
      throw error;
    }
  }

  /**
   * Disconnect from database
   */
  public async disconnect(): Promise<void> {
    try {
      await this.prisma.$disconnect();
      logger.info('Database disconnected');
    } catch (error) {
      logger.error({ error }, 'Error disconnecting from database');
      throw error;
    }
  }

  /**
   * Health check - test database connection
   */
  public async healthCheck(): Promise<boolean> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return true;
    } catch (error) {
      logger.error({ error }, 'Database health check failed');
      return false;
    }
  }
}

// Export singleton instance
export const db = DatabaseService.getInstance();
export const prisma = db.getClient();
