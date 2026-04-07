import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const username = 'superpro';
  const password = 'admin2026';
  
  const hashedPassword = await bcrypt.hash(password, 10);
  
  let firstGym = await prisma.gym.findFirst();
  if (!firstGym) {
    firstGym = await prisma.gym.create({
      data: {
        name: 'Super Gym',
        email: 'admin@supergym.com',
      }
    });
  }

  const existing = await prisma.user.findUnique({ where: { username } });
  if (existing) {
    console.log(`User ${username} already exists.`);
    return;
  }

  await prisma.user.create({
    data: {
      username,
      password: hashedPassword,
      role: 'superadmin',
      gymId: firstGym.id
    }
  });

  console.log(`SuperAdmin created successfully: ${username} / ${password}`);
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
