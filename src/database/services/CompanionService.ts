import { prisma } from '../DatabaseService';
import type { Companion } from '@prisma/client';

export class CompanionService {
  static async findById(companionId: string): Promise<Companion | null> {
    return prisma.companion.findUnique({
      where: { id: companionId },
    });
  }

  static async findByTag(tag: string): Promise<Companion[]> {
    return prisma.companion.findMany({
      where: { tag },
      orderBy: { name: 'asc' },
    });
  }
}
