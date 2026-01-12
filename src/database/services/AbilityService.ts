import { prisma } from '../DatabaseService';
import type { Ability } from '@prisma/client';

export class AbilityService {
  static async findById(abilityId: string): Promise<Ability | null> {
    return prisma.ability.findUnique({
      where: { id: abilityId },
    });
  }

  static async findByName(name: string): Promise<Ability | null> {
    return prisma.ability.findFirst({
      where: {
        name: {
          equals: name,
          mode: 'insensitive',
        },
      },
    });
  }
}
