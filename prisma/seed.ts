import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // Create starter zone: The Crossroads
  console.log('Creating The Crossroads zone...');
  const crossroads = await prisma.zone.create({
    data: {
      id: 'zone-crossroads',
      name: 'The Crossroads',
      description:
        'A weathered crossroads where five ancient paths converge. Moss-covered stones mark each direction, their inscriptions long faded. A sense of anticipation hangs in the air.',
      worldX: 0,
      worldY: 0,
      sizeX: 200,
      sizeY: 50,
      sizeZ: 200,
      terrainType: 'wilderness',
      weatherEnabled: true,
      timeOfDayEnabled: true,
      contentRating: 'T', // Teen - public starting area
      navmeshData: null, // TODO: Add navmesh data
    },
  });
  console.log(`✓ Created zone: ${crossroads.name}`);

  // Create a test account
  console.log('Creating test account...');
  const testAccount = await prisma.account.create({
    data: {
      email: 'test@worldofdarkness.com',
      username: 'TestPlayer',
      passwordHash: '$2b$10$dummyhashforseeddataonly', // Not a real hash, just for seeding
    },
  });
  console.log(`✓ Created account: ${testAccount.username}`);

  // Create a test character for the account
  console.log('Creating test character...');
  const testCharacter = await prisma.character.create({
    data: {
      accountId: testAccount.id,
      name: 'Wanderer',
      level: 1,
      experience: 0,
      abilityPoints: 0,

      // Core stats (all 10 - balanced starter)
      strength: 10,
      vitality: 10,
      dexterity: 10,
      agility: 10,
      intelligence: 10,
      wisdom: 10,

      // Derived stats (defaults from schema)
      maxHp: 200,
      maxStamina: 100,
      maxMana: 100,
      attackRating: 30,
      defenseRating: 5,
      magicAttack: 30,
      magicDefense: 5,

      // Current state (full health)
      currentHp: 200,
      currentStamina: 100,
      currentMana: 100,

      // Starting position in The Crossroads (center)
      zoneId: crossroads.id,
      positionX: 100,
      positionY: 0,
      positionZ: 100,
      heading: 0, // Facing north

      // Progression
      unlockedFeats: [],
      unlockedAbilities: [],
      activeLoadout: [],
      passiveLoadout: [],
      specialLoadout: [],
    },
  });
  console.log(`✓ Created character: ${testCharacter.name} (Level ${testCharacter.level})`);

  // Create an NPC companion in the zone
  console.log('Creating NPC companion...');
  const merchant = await prisma.companion.create({
    data: {
      name: 'Old Merchant',
      description: 'A weathered merchant with kind eyes, tending a small cart of mysterious wares.',
      personalityType: 'friendly_merchant',
      memoryData: {
        background: 'Has traveled the roads for decades, knows many secrets.',
        relationships: [],
        recentEvents: [],
      },
      level: 5,
      stats: {
        strength: 8,
        vitality: 12,
        dexterity: 10,
        agility: 8,
        intelligence: 14,
        wisdom: 16,
      },
      currentHealth: 150,
      maxHealth: 150,
      zoneId: crossroads.id,
      positionX: 102,
      positionY: 0,
      positionZ: 98,
      llmProvider: 'anthropic',
      llmModel: 'claude-3-5-sonnet-20241022',
      systemPrompt: `You are the Old Merchant, a wise and friendly NPC in The Crossroads.
You've traveled these roads for decades and know many secrets.
You're here to help new adventurers and offer guidance (and occasionally sell useful items).

Content Rating: Teen (13+) - Keep language mild, no graphic content.
Personality: Warm, wise, occasionally cryptic, enjoys wordplay.
Speech pattern: Calm and measured, uses "traveler" or "friend" when addressing others.`,
      conversationHistory: [],
    },
  });
  console.log(`✓ Created NPC: ${merchant.name}`);

  // Create basic combat ability (hybrid metadata)
  console.log('Creating basic combat ability...');
  await prisma.ability.upsert({
    where: { id: 'basic_attack' },
    update: {
      name: 'Basic Attack',
      description: 'A simple weapon strike.',
      data: {
        targetType: 'enemy',
        range: 2,
        cooldown: 0,
        atbCost: 100,
        staminaCost: 5,
        damage: {
          type: 'physical',
          amount: 8,
          scalingStat: 'strength',
          scalingMultiplier: 0.4,
        },
      },
    },
    create: {
      id: 'basic_attack',
      name: 'Basic Attack',
      description: 'A simple weapon strike.',
      data: {
        targetType: 'enemy',
        range: 2,
        cooldown: 0,
        atbCost: 100,
        staminaCost: 5,
        damage: {
          type: 'physical',
          amount: 8,
          scalingStat: 'strength',
          scalingMultiplier: 0.4,
        },
      },
    },
  });
  console.log('✓ Created ability: Basic Attack');

  // Create some basic item templates
  console.log('Creating item templates...');

  const rustySword = await prisma.itemTemplate.create({
    data: {
      name: 'Rusty Sword',
      description: 'An old iron sword, covered in rust but still serviceable.',
      itemType: 'weapon',
      properties: {
        weaponType: 'sword',
        damage: 15,
        scaling: {
          strength: 'C',
          dexterity: 'D',
        },
        attackSpeed: 1.2,
      },
      value: 50,
      stackable: false,
      maxStackSize: 1,
    },
  });

  const healthPotion = await prisma.itemTemplate.create({
    data: {
      name: 'Health Potion',
      description: 'A small vial of red liquid that restores vitality.',
      itemType: 'consumable',
      properties: {
        consumableType: 'potion',
        effect: {
          type: 'heal',
          amount: 50,
        },
        cooldown: 30,
      },
      value: 25,
      stackable: true,
      maxStackSize: 20,
    },
  });

  console.log(`✓ Created item templates: ${rustySword.name}, ${healthPotion.name}`);

  // Give the test character a starting weapon
  console.log('Equipping test character...');
  await prisma.inventoryItem.create({
    data: {
      characterId: testCharacter.id,
      itemTemplateId: rustySword.id,
      quantity: 1,
      equipped: true,
      equipSlot: 'mainHand',
    },
  });

  // Give the test character some health potions
  await prisma.inventoryItem.create({
    data: {
      characterId: testCharacter.id,
      itemTemplateId: healthPotion.id,
      quantity: 5,
      equipped: false,
    },
  });

  console.log('✓ Added starting equipment to test character');

  console.log('\n✅ Database seeded successfully!');
  console.log('\nSeeded data:');
  console.log(`  - 1 zone: ${crossroads.name}`);
  console.log(`  - 1 account: ${testAccount.username}`);
  console.log(`  - 1 character: ${testCharacter.name}`);
  console.log(`  - 1 NPC: ${merchant.name}`);
  console.log(`  - 1 ability (basic_attack)`);
  console.log(`  - 2 item templates`);
  console.log(`  - Character equipped with ${rustySword.name} and 5x ${healthPotion.name}`);
  console.log('\nYou can now connect with:');
  console.log(`  Email: ${testAccount.email}`);
  console.log(`  Character: ${testCharacter.name}`);
}

main()
  .catch((e) => {
    console.error('Error seeding database:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
