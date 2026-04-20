import { prisma } from '../config/database';

interface SearchParams {
  q?: string;
  fileType?: string;
  status?: string;
  from?: string;
  to?: string;
  page?: number;
  pageSize?: number;
}

export async function searchAssets(userId: string, params: SearchParams) {
  const page = params.page || 1;
  const pageSize = params.pageSize || 20;
  const offset = (page - 1) * pageSize;

  if (params.q) {
    // Full-text search with tsvector + filename ILIKE
    const searchTerm = params.q
      .split(/\s+/)
      .filter(Boolean)
      .map((w) => `${w}:*`)
      .join(' & ');

    const results = await prisma.$queryRaw<
      Array<{
        id: string;
        original_name: string;
        file_type: string;
        file_size: number;
        status: string;
        folder_id: string | null;
        created_at: Date;
        snippet: string;
      }>
    >`
      SELECT id, original_name, file_type, file_size, status, folder_id, created_at,
             LEFT(parsed_text, 200) as snippet
      FROM assets
      WHERE user_id = ${userId}
        AND (
          parsed_text_vector @@ to_tsquery('simple', ${searchTerm})
          OR original_name ILIKE ${'%' + params.q + '%'}
        )
        AND (${params.fileType || null}::text IS NULL OR file_type = ${params.fileType || null})
        AND (${params.status || null}::text IS NULL OR status = ${params.status || null})
      ORDER BY ts_rank(parsed_text_vector, to_tsquery('simple', ${searchTerm})) DESC, created_at DESC
      LIMIT ${pageSize} OFFSET ${offset}
    `;

    const countResult = await prisma.$queryRaw<Array<{ count: bigint }>>`
      SELECT COUNT(*) as count
      FROM assets
      WHERE user_id = ${userId}
        AND (
          parsed_text_vector @@ to_tsquery('simple', ${searchTerm})
          OR original_name ILIKE ${'%' + params.q + '%'}
        )
        AND (${params.fileType || null}::text IS NULL OR file_type = ${params.fileType || null})
        AND (${params.status || null}::text IS NULL OR status = ${params.status || null})
    `;

    return {
      items: results.map((r) => ({
        id: r.id,
        originalName: r.original_name,
        fileType: r.file_type,
        fileSize: r.file_size,
        status: r.status,
        folderId: r.folder_id,
        createdAt: r.created_at,
        snippet: r.snippet,
      })),
      total: Number(countResult[0]?.count || 0),
      page,
      pageSize,
    };
  }

  // No search query - just filter
  const where: any = { userId };
  if (params.fileType) where.fileType = params.fileType;
  if (params.status) where.status = params.status;
  if (params.from || params.to) {
    where.createdAt = {};
    if (params.from) where.createdAt.gte = new Date(params.from);
    if (params.to) where.createdAt.lte = new Date(params.to);
  }

  const [items, total] = await Promise.all([
    prisma.asset.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: offset,
      take: pageSize,
      select: {
        id: true,
        originalName: true,
        fileType: true,
        fileSize: true,
        status: true,
        folderId: true,
        createdAt: true,
      },
    }),
    prisma.asset.count({ where }),
  ]);

  return { items, total, page, pageSize };
}
