import dotenv from 'dotenv';
import path from 'node:path';

// Charge le bon fichier .env même si le backend est lancé depuis un autre dossier.
dotenv.config({ path: path.resolve(__dirname, '../../.env') });
import { PrismaClient } from '../../prisma/generated-client';
import bcrypt from 'bcryptjs';
import { getBootstrapPassword } from './security';

const prisma = new PrismaClient();
export const SYSTEM_GYM_NAME = 'Gym Central HQ';
export const SYSTEM_GYM_PHONE = '0000000000';

export const ensureSystemGym = async () => {
  const existingSystemGym = await prisma.gym.findFirst({
    where: { name: SYSTEM_GYM_NAME },
  });

  if (existingSystemGym) {
    return existingSystemGym;
  }

  console.log('[DB-INIT] Initializing System Gym...');

  return prisma.gym.create({
    data: {
      name: SYSTEM_GYM_NAME,
      email: 'system@gymcentral.com',
      phone: SYSTEM_GYM_PHONE,
      saasFee: 0,
      status: 'ACTIVE',
      subscriptionEnd: new Date(
        new Date().setFullYear(new Date().getFullYear() + 20)
      ),
    },
  });
};

// Fonction d'initialisation pour insérer l'admin par défaut
export const initializeDb = async () => {
  console.log('[DB-INIT] Starting database initialization...');
  try {
    const systemGym = await ensureSystemGym();

    await prisma.user.updateMany({
      where: {
        role: 'superadmin',
        NOT: {
          gymId: systemGym.id,
        },
      },
      data: {
        gymId: systemGym.id,
      },
    });

    // 3. Security: Check and Create Admin if missing
    const adminExists = await prisma.user.findUnique({
      where: { username: 'admin' },
    });
    const adminPassword = getBootstrapPassword('DEFAULT_ADMIN_PASSWORD');
    if (!adminExists && adminPassword) {
      const hashedPassword = bcrypt.hashSync(adminPassword, 10);
      await prisma.user.create({
        data: {
          username: 'admin',
          password: hashedPassword,
          role: 'admin',
          gymId: systemGym.id,
        },
      });
    } else if (!adminExists) {
      console.warn(
        '[DB-INIT] Skipping default admin creation: set DEFAULT_ADMIN_PASSWORD to a strong, non-placeholder value.'
      );
    }

    // 4. Security: Check and Create SuperAdmin if missing
    const superAdminExists = await prisma.user.findFirst({
      where: { role: 'superadmin' },
    });
    const superAdminPassword = getBootstrapPassword(
      'DEFAULT_SUPERADMIN_PASSWORD'
    );
    if (!superAdminExists && superAdminPassword) {
      const hashedSuperPass = bcrypt.hashSync(superAdminPassword, 10);
      await prisma.user.create({
        data: {
          username: 'superadmin',
          password: hashedSuperPass,
          role: 'superadmin',
          gymId: systemGym.id,
        },
      });
    } else if (!superAdminExists) {
      console.warn(
        '[DB-INIT] Skipping default superadmin creation: set DEFAULT_SUPERADMIN_PASSWORD to a strong, non-placeholder value.'
      );
    }

    console.log('[DB-INIT] Core system data verified.');
  } catch (error) {
    console.error('[DB-INIT] ! CRITICAL ! Initialization failed:', error);
  }
};


export default prisma;
