import { prisma } from "@/lib/prisma";

export async function runDailyTasks() {
  const settings = await prisma.settings.findFirst();
  if (!settings) return { success: false, message: "Settings not found" };

  let archivedCount = 0;
  let deletedAuditCount = 0;

  // 1. Auto Archive
  if (settings.autoArchive && settings.archiveDays > 0) {
    const archiveThreshold = new Date();
    archiveThreshold.setDate(archiveThreshold.getDate() - settings.archiveDays);

    const ticketsToArchive = await prisma.ticket.findMany({
      where: {
        status: "RESOLVIDO",
        isArchived: false,
        updatedAt: { lt: archiveThreshold },
      },
      select: { id: true }
    });

    if (ticketsToArchive.length > 0) {
      await prisma.ticket.updateMany({
        where: { id: { in: ticketsToArchive.map(t => t.id) } },
        data: { isArchived: true },
      });
      archivedCount = ticketsToArchive.length;
    }
  }

  // 2. Audit Log Cleanup
  if (settings.auditRetentionDays > 0) {
    const auditThreshold = new Date();
    auditThreshold.setDate(auditThreshold.getDate() - settings.auditRetentionDays);

    const deleted = await prisma.auditLog.deleteMany({
      where: { createdAt: { lt: auditThreshold } }
    });
    deletedAuditCount = deleted.count;
  }

  return {
    success: true,
    archivedTickets: archivedCount,
    deletedAuditLogs: deletedAuditCount,
  };
}
