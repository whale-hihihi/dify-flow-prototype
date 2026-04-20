import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function createUser(username: string, email: string, role: string, password: string) {
  const passwordHash = await bcrypt.hash(password, 10);
  const user = await prisma.user.upsert({
    where: { username },
    update: {},
    create: { username, email, passwordHash, role },
  });
  console.log(`Created user: ${user.username} (${user.role})`);

  const folder = await prisma.folder.upsert({
    where: { userId_name: { userId: user.id, name: '全部文件' } },
    update: {},
    create: { name: '全部文件', isDefault: true, userId: user.id },
  });
  console.log(`  → default folder: ${folder.name}`);

  return user;
}

async function main() {
  await createUser('admin', 'admin@difyflow.local', 'admin', 'admin123');
  await createUser('liting', 'liting@difyflow.local', 'admin', 'liting123');
  await createUser('wanghao', 'wanghao@difyflow.local', 'member', 'wanghao123');
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
