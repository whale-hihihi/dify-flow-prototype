/**
 * 修复 assets 表中因 multer latin1 编码导致的中文文件名乱码
 * 用法: npx ts-node packages/server/src/scripts/fix-filenames.ts
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

function fixName(name: string): string | null {
  try {
    // 检测是否包含 latin1 误编码的特征（高字节字符）
    const hasGarble = /[\u0080-\u00ff]/.test(name);
    if (!hasGarble) return null; // 无需修复

    const fixed = Buffer.from(name, 'latin1').toString('utf-8');
    // 验证解码后是否为合法 UTF-8（不包含替换字符）
    if (fixed.includes('\uFFFD')) return null;
    return fixed;
  } catch {
    return null;
  }
}

async function main() {
  const assets = await prisma.asset.findMany({
    select: { id: true, originalName: true },
  });

  let fixed = 0;
  for (const asset of assets) {
    const corrected = fixName(asset.originalName);
    if (corrected && corrected !== asset.originalName) {
      await prisma.asset.update({
        where: { id: asset.id },
        data: { originalName: corrected },
      });
      console.log(`[${++fixed}] ${asset.originalName}  →  ${corrected}`);
    }
  }

  console.log(`\n共修复 ${fixed} / ${assets.length} 条记录`);
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
