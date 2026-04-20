import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  // Create default admin user
  const passwordHash = await bcrypt.hash('admin123', 10);
  const admin = await prisma.user.upsert({
    where: { username: 'admin' },
    update: {},
    create: {
      username: 'admin',
      email: 'admin@difyflow.local',
      passwordHash,
      role: 'admin',
    },
  });

  console.log('Created admin user:', admin.username);

  // Create default "全部文件" folder
  const defaultFolder = await prisma.folder.upsert({
    where: {
      userId_name: {
        userId: admin.id,
        name: '全部文件',
      },
    },
    update: {},
    create: {
      name: '全部文件',
      isDefault: true,
      userId: admin.id,
    },
  });

  console.log('Created default folder:', defaultFolder.name);

  console.log('Seed completed successfully.');
}

main()
  .catch((e) => {
    console.error('Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
