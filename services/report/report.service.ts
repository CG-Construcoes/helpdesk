import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";

export interface ExecutiveReportFilters {
  period?: string;
  startDate?: string;
  endDate?: string;
  monthYear?: string;
  technicianId?: string;
  sectorId?: string;
  serviceId?: string;
  status?: string;
  priority?: string;
  origin?: string;
}

function getPeriodRange(params: ExecutiveReportFilters): {
  start: Date;
  end: Date;
  label: string;
} {
  const now = new Date();
  let start = new Date();
  let end = new Date();
  let label = "Últimos 30 dias";

  if (params.period === "TODAY") {
    start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
    end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
    label = "Hoje";
  } else if (params.period === "YESTERDAY") {
    const yest = new Date(now);
    yest.setDate(now.getDate() - 1);
    start = new Date(yest.getFullYear(), yest.getMonth(), yest.getDate(), 0, 0, 0, 0);
    end = new Date(yest.getFullYear(), yest.getMonth(), yest.getDate(), 23, 59, 59, 999);
    label = "Ontem";
  } else if (params.period === "LAST_7_DAYS") {
    start = new Date(now);
    start.setDate(now.getDate() - 7);
    start.setHours(0, 0, 0, 0);
    end = new Date(now);
    label = "Últimos 7 dias";
  } else if (params.period === "LAST_30_DAYS" || !params.period && !params.monthYear && !params.startDate) {
    start = new Date(now);
    start.setDate(now.getDate() - 30);
    start.setHours(0, 0, 0, 0);
    end = new Date(now);
    label = "Últimos 30 dias";
  } else if (params.period === "THIS_MONTH") {
    start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
    end = new Date(now);
    label = "Este mês";
  } else if (params.period === "THIS_YEAR") {
    start = new Date(now.getFullYear(), 0, 1, 0, 0, 0, 0);
    end = new Date(now);
    label = "Ano atual";
  } else if (params.monthYear) {
    const [mm, yyyy] = params.monthYear.split("-");
    const month = parseInt(mm, 10) - 1;
    const year = parseInt(yyyy, 10);
    start = new Date(year, month, 1, 0, 0, 0, 0);
    end = new Date(year, month + 1, 0, 23, 59, 59, 999);
    const monthNames = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
    label = `${monthNames[month]} de ${year}`;
  } else if (params.startDate && params.endDate) {
    start = new Date(params.startDate);
    end = new Date(params.endDate);
    end.setHours(23, 59, 59, 999);
    label = `${start.toLocaleDateString("pt-BR")} a ${end.toLocaleDateString("pt-BR")}`;
  }

  return { start, end, label };
}

function formatMinutes(minutes: number): string {
  if (minutes < 0) return "0 min";
  if (minutes === 0) return "0 min";
  if (minutes < 60) return `${Math.round(minutes)} min`;
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

export async function getExecutiveReportData(filters: ExecutiveReportFilters) {
  const range = getPeriodRange(filters);
  const now = new Date();

  // Filtros dinâmicos
  const whereTickets: Prisma.TicketWhereInput = {
    deletedAt: null,
    ...(filters.monthYear
      ? {
          OR: [
            { ticketMonthYear: filters.monthYear },
            { ticketDate: { gte: range.start, lte: range.end } },
          ],
        }
      : { ticketDate: { gte: range.start, lte: range.end } }),
  };

  if (filters.technicianId) whereTickets.technicianId = filters.technicianId;
  if (filters.sectorId) whereTickets.sectorId = filters.sectorId;
  if (filters.serviceId) whereTickets.serviceId = filters.serviceId;
  if (filters.status) whereTickets.status = filters.status as any;
  if (filters.priority) whereTickets.priority = filters.priority as any;
  if (filters.origin) whereTickets.origin = filters.origin as any;

  // 1. Buscar todos os chamados aplicáveis e emails
  const [tickets, processedEmails] = await Promise.all([
    prisma.ticket.findMany({
      where: whereTickets,
      include: {
        technician: true,
        sector: true,
        service: true,
        pauses: true,
      },
      orderBy: { ticketDate: 'asc' }
    }),
    prisma.processedEmail.findMany({
      where: {
        processedAt: { gte: range.start, lte: range.end }
      }
    })
  ]);

  // Estruturas de agregação
  let totalTickets = tickets.length;
  let resolvedTickets = 0;
  let inProgressTickets = 0;
  let pendingTickets = 0;
  let waitingThirdPartiesTickets = 0;

  // SLA
  let slaMet = 0;
  let slaBreached = 0;
  let slaPaused = 0;
  let slaInProgress = 0;
  let totalSlaApplicable = 0;
  let totalTimeInPauseMs = 0;

  // Tempo
  let totalTimeMinutes = 0;
  let ticketsWithTime = 0;

  // Detalhes por categoria
  const techMap: Record<string, any> = {};
  const sectorMap: Record<string, any> = {};
  const serviceMap: Record<string, any> = {};
  const priorityMap: Record<string, number> = { BAIXA: 0, MEDIA: 0, ALTA: 0, CRITICA: 0 };
  const originMap: Record<string, number> = { MANUAL: 0, WHATSAPP: 0, EMAIL: 0 };
  const statusMap: Record<string, number> = {};
  
  // Volume por Hora
  const hourMap = Array.from({ length: 24 }, (_, i) => ({
    hour: `${String(i).padStart(2, '0')}h`,
    count: 0,
    timeMs: 0
  }));

  const criticalTickets: any[] = [];
  const monthMap: Record<string, { month: string; opened: number; resolved: number; slaMet: number; totalSla: number }> = {};

  // Processar Chamados
  tickets.forEach(t => {
    // Status counts
    const st = t.status;
    statusMap[st] = (statusMap[st] || 0) + 1;
    
    if (st === "RESOLVIDO" || st === "CONCLUIDO" || st === "CANCELADO") {
      resolvedTickets++;
      if (typeof t.totalTimeMinutes === 'number' && t.totalTimeMinutes > 0) {
        totalTimeMinutes += t.totalTimeMinutes;
        ticketsWithTime++;
      }
    } else if (st === "ABERTO" || st === "EM_ANDAMENTO" || st === "EM_ATENDIMENTO") {
      inProgressTickets++;
    } else if (st === "AGUARDANDO_TERCEIROS") {
      waitingThirdPartiesTickets++;
    } else {
      pendingTickets++;
    }

    // Origin / Priority
    if (t.origin) originMap[t.origin] = (originMap[t.origin] || 0) + 1;
    if (t.priority) priorityMap[t.priority] = (priorityMap[t.priority] || 0) + 1;

    // Pausas
    let pauseTimeMs = 0;
    if (t.pauses && t.pauses.length > 0) {
      t.pauses.forEach(p => {
        const pStart = new Date(p.startTime).getTime();
        const pEnd = p.endTime ? new Date(p.endTime).getTime() : now.getTime();
        pauseTimeMs += (pEnd - pStart);
      });
      totalTimeInPauseMs += pauseTimeMs;
    }

    // SLA Calculation determinístico
    let isBreached = false;
    let isSlaMet = false;
    
    if (t.dueDate) {
      totalSlaApplicable++;
      const adjustedDueDate = new Date(new Date(t.dueDate).getTime() + pauseTimeMs);
      
      if (st === "AGUARDANDO_TERCEIROS") {
        slaPaused++;
      } else if (st === "RESOLVIDO" || st === "CONCLUIDO") {
        const endDate = t.endTime ? new Date(t.endTime) : new Date(t.updatedAt);
        if (endDate.getTime() <= adjustedDueDate.getTime()) {
          slaMet++;
          isSlaMet = true;
        } else {
          slaBreached++;
          isBreached = true;
        }
      } else {
        if (now.getTime() > adjustedDueDate.getTime()) {
          slaBreached++;
          isBreached = true;
        } else {
          slaInProgress++;
        }
      }
    }

    // Critical Tickets condition: (Breached OR ALTA/CRITICA priority OR wait Third parties) AND Not Resolved
    if ((isBreached || t.priority === "ALTA" || t.priority === "CRITICA" || st === "AGUARDANDO_TERCEIROS") && st !== "RESOLVIDO" && st !== "CONCLUIDO" && st !== "CANCELADO") {
      criticalTickets.push({
        ticketNumber: t.ticketNumber,
        sector: t.sector?.name || "-",
        service: t.service?.name || "-",
        technician: t.technician?.name || "Não atribuído",
        status: t.status,
        priority: t.priority,
        isBreached
      });
    }

    // Agregação por Técnico
    const techKey = t.technicianId || "unassigned";
    if (!techMap[techKey]) {
      techMap[techKey] = {
        name: t.technician?.name || "Não atribuído",
        count: 0,
        resolved: 0,
        totalTimeMinutes: 0,
        slaMet: 0,
        slaBreached: 0
      };
    }
    techMap[techKey].count++;
    if (st === "RESOLVIDO" || st === "CONCLUIDO") techMap[techKey].resolved++;
    if (typeof t.totalTimeMinutes === 'number') techMap[techKey].totalTimeMinutes += t.totalTimeMinutes;
    if (isSlaMet) techMap[techKey].slaMet++;
    if (isBreached) techMap[techKey].slaBreached++;

    // Agregação por Setor
    if (t.sectorId) {
      if (!sectorMap[t.sectorId]) sectorMap[t.sectorId] = { name: t.sector?.name || "-", count: 0, resolved: 0, pending: 0 };
      sectorMap[t.sectorId].count++;
      if (st === "RESOLVIDO" || st === "CONCLUIDO") sectorMap[t.sectorId].resolved++;
      else sectorMap[t.sectorId].pending++;
    }

    // Agregação por Serviço
    if (t.serviceId) {
      if (!serviceMap[t.serviceId]) serviceMap[t.serviceId] = { name: t.service?.name || "-", count: 0, time: 0, resolved: 0 };
      serviceMap[t.serviceId].count++;
      if (st === "RESOLVIDO" || st === "CONCLUIDO") {
         serviceMap[t.serviceId].resolved++;
         if (typeof t.totalTimeMinutes === 'number') serviceMap[t.serviceId].time += t.totalTimeMinutes;
      }
    }

    // Volume por Hora
    const createdDateBRT = new Date(new Date(t.ticketDate || t.createdAt).toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }));
    const h = createdDateBRT.getHours();
    hourMap[h].count++;

    // Mês Evolution
    const mStr = `${createdDateBRT.getFullYear()}-${String(createdDateBRT.getMonth() + 1).padStart(2, '0')}`;
    const mLabel = createdDateBRT.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' }).toUpperCase();
    if (!monthMap[mStr]) monthMap[mStr] = { month: mLabel, opened: 0, resolved: 0, slaMet: 0, totalSla: 0 };
    monthMap[mStr].opened++;
    if (st === "RESOLVIDO" || st === "CONCLUIDO") monthMap[mStr].resolved++;
    if (t.dueDate) monthMap[mStr].totalSla++;
    if (isSlaMet) monthMap[mStr].slaMet++;
  });

  // Indicadores E-mail
  let emailTotal = processedEmails.length;
  let emailGenerated = processedEmails.filter(e => e.ticketId && e.status === "PROCESSED").length;
  let emailOrigin = originMap["EMAIL"] || 0;
  let emailRepliesSent = processedEmails.filter(e => e.bodySent).length;
  let emailManualReplies = processedEmails.filter(e => e.manualReplies != null).length;
  let emailNoTicket = processedEmails.filter(e => !e.ticketId).length;

  // Formatações finais e Cálculos
  const avgTimeMinutes = ticketsWithTime > 0 ? totalTimeMinutes / ticketsWithTime : 0;
  const slaPercent = totalSlaApplicable > 0 ? Math.round((slaMet / totalSlaApplicable) * 100) : 0;

  // Rankings
  const topTechs = Object.values(techMap)
    .sort((a, b) => b.resolved - a.resolved)
    .map(t => ({
      name: t.name,
      count: t.count,
      resolved: t.resolved,
      avgTime: t.resolved > 0 ? formatMinutes(t.totalTimeMinutes / t.resolved) : "0 min",
      slaMet: t.slaMet,
      slaBreached: t.slaBreached
    }));

  const topSectors = Object.values(sectorMap)
    .sort((a, b) => b.count - a.count)
    .map(s => ({
      name: s.name,
      count: s.count,
      percentage: totalTickets > 0 ? Math.round((s.count / totalTickets) * 100) : 0,
      resolved: s.resolved,
      pending: s.pending
    }));

  const topServices = Object.values(serviceMap)
    .sort((a, b) => b.count - a.count)
    .map(s => ({
      name: s.name,
      count: s.count,
      percentage: totalTickets > 0 ? Math.round((s.count / totalTickets) * 100) : 0,
      avgTime: s.resolved > 0 ? formatMinutes(s.time / s.resolved) : "0 min"
    }));

  const monthlyEvolution = Object.keys(monthMap).sort().map(k => ({
    label: monthMap[k].month,
    opened: monthMap[k].opened,
    resolved: monthMap[k].resolved,
    slaPercent: monthMap[k].totalSla > 0 ? Math.round((monthMap[k].slaMet / monthMap[k].totalSla) * 100) : 0
  }));

  // Resumo Operacional Determinístico
  const operationalSummary = [];
  if (topSectors.length > 0) {
    operationalSummary.push(`O setor ${topSectors[0].name} concentrou ${topSectors[0].percentage}% dos chamados no período, sendo o setor com maior demanda.`);
  }
  if (totalSlaApplicable > 0) {
    operationalSummary.push(`O SLA apresentou índice de cumprimento de ${slaPercent}%, com ${slaBreached} chamados acima do prazo estabelecido.`);
  }
  operationalSummary.push(`A equipe registrou ${totalTickets} chamados, dos quais ${resolvedTickets} foram concluídos.`);
  if (emailTotal > 0) {
    operationalSummary.push(`A operação processou ${emailTotal} e-mails automáticos, gerando um total de ${emailGenerated} novos chamados na fila.`);
  }
  if (waitingThirdPartiesTickets > 0) {
    operationalSummary.push(`${waitingThirdPartiesTickets} chamados encontram-se aguardando terceiros, interrompendo o SLA temporariamente.`);
  }

  return {
    period: range.label,
    kpis: {
      totalTickets,
      resolvedTickets,
      resolvedPercent: totalTickets > 0 ? Math.round((resolvedTickets / totalTickets) * 100) : 0,
      inProgressTickets,
      pendingTickets,
      waitingThirdPartiesTickets,
      avgTimeFormatted: formatMinutes(avgTimeMinutes),
    },
    sla: {
      totalApplicable: totalSlaApplicable,
      met: slaMet,
      breached: slaBreached,
      inProgress: slaInProgress,
      paused: slaPaused,
      metPercent: slaPercent,
      totalPauseTimeFormatted: formatMinutes(totalTimeInPauseMs / 60000)
    },
    email: {
      processed: emailTotal,
      generated: emailGenerated,
      origin: emailOrigin,
      repliesSent: emailRepliesSent,
      manualReplies: emailManualReplies,
      noTicket: emailNoTicket
    },
    charts: {
      monthlyEvolution,
      hourMap: hourMap.filter(h => h.count > 0 || (parseInt(h.hour) >= 8 && parseInt(h.hour) <= 18)),
      priorities: Object.entries(priorityMap).map(([k, v]) => ({ name: k, value: v, percentage: totalTickets > 0 ? Math.round((v / totalTickets) * 100) : 0 })),
      statuses: Object.entries(statusMap).map(([k, v]) => ({ name: k, value: v, percentage: totalTickets > 0 ? Math.round((v / totalTickets) * 100) : 0 })),
      origins: Object.entries(originMap).map(([k, v]) => ({ name: k, value: v, percentage: totalTickets > 0 ? Math.round((v / totalTickets) * 100) : 0 }))
    },
    tables: {
      topTechs,
      topSectors,
      topServices,
      criticalTickets: criticalTickets.slice(0, 15) // Limit to top 15 critical
    },
    operationalSummary
  };
}
