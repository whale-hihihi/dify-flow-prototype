import bcrypt from 'bcryptjs';
import { prisma } from '../config/database';
import { signToken } from '../utils/jwt';

export async function login(username: string, password: string) {
  const user = await prisma.user.findUnique({ where: { username } });
  if (!user) throw new Error('User not found');

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) throw new Error('Invalid password');

  const token = signToken({ userId: user.id, role: user.role });
  return {
    token,
    user: { id: user.id, username: user.username, email: user.email, role: user.role },
  };
}

export async function getUser(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, username: true, email: true, role: true, defaultAgentId: true, createdAt: true },
  });
  if (!user) throw new Error('User not found');
  return user;
}

export async function updateUser(userId: string, data: { username?: string; email?: string; defaultAgentId?: string | null }) {
  return prisma.user.update({
    where: { id: userId },
    data,
    select: { id: true, username: true, email: true, role: true, defaultAgentId: true },
  });
}

export async function changePassword(userId: string, oldPassword: string, newPassword: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new Error('User not found');
  const valid = await bcrypt.compare(oldPassword, user.passwordHash);
  if (!valid) throw new Error('Invalid old password');
  const passwordHash = await bcrypt.hash(newPassword, 10);
  await prisma.user.update({ where: { id: userId }, data: { passwordHash } });
}

// Admin: list all users
export async function listUsers() {
  return prisma.user.findMany({
    select: { id: true, username: true, email: true, role: true, createdAt: true },
    orderBy: { createdAt: 'asc' },
  });
}

// Admin: create user
export async function createUser({ username, email, password, role }: { username: string; email: string; password: string; role: string }) {
  const existing = await prisma.user.findFirst({ where: { OR: [{ username }, { email }] } });
  if (existing) throw new Error('Username or email already exists');
  const passwordHash = await bcrypt.hash(password, 10);
  const user = await prisma.user.create({ data: { username, email, passwordHash, role } });
  // create default folder
  await prisma.folder.create({ data: { name: '全部文件', isDefault: true, userId: user.id } });
  return { id: user.id, username: user.username, email: user.email, role: user.role };
}

// Admin: update role
export async function updateUserRole(userId: string, role: string) {
  return prisma.user.update({
    where: { id: userId },
    data: { role },
    select: { id: true, username: true, email: true, role: true },
  });
}

// Admin: delete user
export async function deleteUser(userId: string) {
  await prisma.user.delete({ where: { id: userId } });
}

// Admin: reset password
export async function resetUserPassword(userId: string, newPassword: string) {
  const passwordHash = await bcrypt.hash(newPassword, 10);
  await prisma.user.update({ where: { id: userId }, data: { passwordHash } });
}
