import { prisma } from "@/lib/prisma";

export type AuditActionType =
  | "CREATE_USER"
  | "UPDATE_USER"
  | "DELETE_USER"
  | "DEACTIVATE_USER"
  | "REACTIVATE_USER"
  | "CHANGE_PASSWORD"
  | "CHANGE_ROLE"
  | "CHANGE_PERMISSIONS";

export interface CreateAuditLogParams {
  userId?: string | null;
  action: AuditActionType | string;
  entity: string;
  entityId?: string | null;
  details?: string | null;
  ipAddress?: string | null;
}

export async function logAuditEvent(params: CreateAuditLogParams) {
  try {
    const settings = await prisma.settings.findFirst({ select: { auditLogEnabled: true } });
    if (settings && settings.auditLogEnabled === false) {
      return null;
    }

    return await prisma.auditLog.create({
      data: {
        userId: params.userId || null,
        action: params.action,
        entity: params.entity,
        entityId: params.entityId || null,
        details: params.details || null,
        ipAddress: params.ipAddress || null,
      },
    });
  } catch (error) {
    console.error("[AuditService] Erro ao registrar audit log:", error);
    // Não falhar a transação principal caso o log falhe
    return null;
  }
}

export async function getAuditLogs(params?: {
  userId?: string;
  entity?: string;
  limit?: number;
}) {
  const where: any = {};
  if (params?.userId) where.userId = params.userId;
  if (params?.entity) where.entity = params.entity;

  return await prisma.auditLog.findMany({
    where,
    take: params?.limit || 50,
    orderBy: { createdAt: "desc" },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
        },
      },
    },
  });
}

export const createAuditLog = logAuditEvent;

