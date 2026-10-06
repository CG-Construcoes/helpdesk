import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";

export type DashboardPeriod =
  | "TODAY"
  | "YESTERDAY"
  | "LAST_7_DAYS"
  | "LAST_30_DAYS"
  | "THIS_MONTH"
  | "THIS_YEAR"
  | "MONTHLY_SPECIFIC"
  | "CUSTOM";

export interface DashboardFilterParams {
  period?: DashboardPeriod;
  startDate?: string;
  endDate?: string;
  sectorId?: string;
  serviceId?: string;
  technicianId?: string;
  monthYear?: string; // "07-2026" format for monthly filtering
  teamPeriod?: DashboardPeriod;
}

export interface ChartDataPoint {
  name: string;
  value: number;
  secondaryValue?: number;
  percentage?: number;
  color?: string;
  id?: string;
}

export interface TimeSeriesPoint {
  date: string;
  label: string;
  total: number;
  concluidos: number;
  emAtendimento: number;
}

export interface DashboardStatsResult {
  kpis: {
    totalTickets: { value: number; changePercent: number; prevValue: number };
    inProgress: { value: number };
    completed: { value: number; changePercent: number; prevValue: number };
    waiting: { value: number };
    scheduled: { value: number };
    avgTimeMinutes: { value: number; formatted: string };
    avgTimePerTech: { value: number; formatted: string };
    topTechHighlight: {
      name: string;
      completedCount: number;
      avgTimeFormatted: string;
    } | null;
    topAvgTimeTechs: Array<{
      name: string;
      avgTimeMinutes: number;
      avgTimeFormatted: string;
    }>;
  };
  rankings: {
    topTechnicians: Array<{
      id: string;
      name: string;
      email: string;
      count: number;
      avgTimeMinutes: number;
      percentage: number;
    }>;
    topServices: Array<{
      id: string;
      name: string;
      category: string;
      count: number;
      percentage: number;
    }>;
    topSectors: Array<{
      id: string;
      name: string;
      count: number;
      percentage: number;
    }>;
    servicesBySector: Record<string, Array<{ name: string; count: number }>>;
  };
  charts: {
    byTechnician: ChartDataPoint[];
    bySector: ChartDataPoint[];
    byService: ChartDataPoint[];
    byStatus: ChartDataPoint[];
    byOrigin: ChartDataPoint[];
    avgTimeByTechnician: ChartDataPoint[];
    avgTimeByService: ChartDataPoint[];
    avgTimeBySector: ChartDataPoint[];
    byDay: TimeSeriesPoint[];
    byWeek: TimeSeriesPoint[];
    byMonth: TimeSeriesPoint[];
    servicesBySector: Record<string, Array<{ name: string; count: number }>>;
  };
  periodRange: {
    start: string;
    end: string;
    label: string;
  };
}

function getPeriodRange(params: DashboardFilterParams): {
  start: Date;
  end: Date;
  prevStart: Date;
  prevEnd: Date;
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
  } else if (params.period === "LAST_30_DAYS" || !params.period) {
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
  } else if (params.period === "MONTHLY_SPECIFIC" && params.monthYear) {
    const [mm, yyyy] = params.monthYear.split("-");
    const month = parseInt(mm, 10) - 1;
    const year = parseInt(yyyy, 10);
    start = new Date(year, month, 1, 0, 0, 0, 0);
    end = new Date(year, month + 1, 0, 23, 59, 59, 999);
    const monthNames = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
    label = `${monthNames[month]} ${year}`;
  } else if (params.period === "CUSTOM" && params.startDate && params.endDate) {
    start = new Date(params.startDate);
    end = new Date(params.endDate);
    end.setHours(23, 59, 59, 999);
    label = `${start.toLocaleDateString("pt-BR")} a ${end.toLocaleDateString("pt-BR")}`;
  }

  // Calcular período anterior proporcional para comparação de crescimento/queda
  const durationMs = end.getTime() - start.getTime();
  const prevEnd = new Date(start.getTime() - 1);
  const prevStart = new Date(prevEnd.getTime() - durationMs);

  return { start, end, prevStart, prevEnd, label };
}

function formatMinutes(minutes: number): string {
  const mins = Math.max(0, Math.round(minutes));
  if (mins === 0) return "0 min";
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

export async function getDashboardStats(
  params: DashboardFilterParams = {}
): Promise<DashboardStatsResult> {
  // If monthYear is provided without a period, set MONTHLY_SPECIFIC
  if (params.monthYear && !params.period) {
    params.period = "MONTHLY_SPECIFIC";
  }

  const range = getPeriodRange(params);

  // Filtro base dos chamados no período atual
  const whereCurrent: Prisma.TicketWhereInput = {
    deletedAt: null,
    ...(params.monthYear
      ? { ticketMonthYear: params.monthYear }
      : {
          ticketDate: {
            gte: range.start,
            lte: range.end,
          },
        }),
  };

  // Filtro base dos chamados no período anterior (para KPI comparativo)
  const wherePrevious: Prisma.TicketWhereInput = {
    deletedAt: null,
    ...(params.monthYear
      ? {
          // For monthly, compare with previous month
          ticketMonthYear: (() => {
            const [mm, yyyy] = params.monthYear!.split("-");
            let prevMonth = parseInt(mm, 10) - 1;
            let prevYear = parseInt(yyyy, 10);
            if (prevMonth < 1) { prevMonth = 12; prevYear--; }
            return `${String(prevMonth).padStart(2, "0")}-${prevYear}`;
          })(),
        }
      : {
          ticketDate: {
            gte: range.prevStart,
            lte: range.prevEnd,
          },
        }),
  };

  if (params.sectorId) {
    whereCurrent.sectorId = params.sectorId;
    wherePrevious.sectorId = params.sectorId;
  }
  if (params.serviceId) {
    whereCurrent.serviceId = params.serviceId;
    wherePrevious.serviceId = params.serviceId;
  }
  if (params.technicianId) {
    whereCurrent.technicianId = params.technicianId;
    wherePrevious.technicianId = params.technicianId;
  }

  // Otimização: usar agregações do Prisma em vez de carregar tudo em memória
  const [
    totalTicketsCount,
    previousTicketsCount,
    statusCounts,
    previousStatusCounts,
    avgTimeData,
    activeTechs,
    allSectors,
    allServices,
    allUsers,
    ticketsByTechnician,
    ticketsBySector,
    ticketsByService,
    ticketsByOrigin,
    ticketsByDay,
    topTechsData,
  ] = await Promise.all([
    // Total tickets current period
    prisma.ticket.count({ where: whereCurrent }),
    // Total tickets previous period
    prisma.ticket.count({ where: wherePrevious }),
    // Status counts current period
    prisma.ticket.groupBy({
      by: ['status'],
      where: whereCurrent,
      _count: true,
    }),
    // Status counts previous period
    prisma.ticket.groupBy({
      by: ['status'],
      where: wherePrevious,
      _count: true,
    }),
    // Average time for resolved tickets
    prisma.ticket.aggregate({
      where: {
        ...whereCurrent,
        status: 'RESOLVIDO',
        totalTimeMinutes: { gt: 0 },
      },
      _avg: { totalTimeMinutes: true },
      _count: true,
    }),
    // Active techs count
    prisma.user.count({
      where: {
        role: { in: ["ADMIN", "TI"] },
        isActive: true,
      },
    }),
    // All sectors
    prisma.sector.findMany({ select: { id: true, name: true } }),
    // All services
    prisma.service.findMany({ select: { id: true, name: true, category: true } }),
    // All users for rankings
    prisma.user.findMany({
      where: { role: { in: ["ADMIN", "TI"] } },
      select: { id: true, name: true, email: true },
    }),
    // Tickets by technician with aggregate data
    prisma.ticket.groupBy({
      by: ['technicianId'],
      where: whereCurrent,
      _count: true,
      _sum: { totalTimeMinutes: true },
    }),
    // Tickets by sector
    prisma.ticket.groupBy({
      by: ['sectorId'],
      where: whereCurrent,
      _count: true,
    }),
    // Tickets by service
    prisma.ticket.groupBy({
      by: ['serviceId'],
      where: whereCurrent,
      _count: true,
    }),
    // Tickets by origin
    prisma.ticket.groupBy({
      by: ['origin'],
      where: whereCurrent,
      _count: true,
    }),
    // Time series data (group by date)
    prisma.$queryRaw`
      SELECT
        DATE(ticket_date) as date,
        COUNT(*) as total,
        SUM(CASE WHEN status = 'RESOLVIDO' THEN 1 ELSE 0 END) as concluidos,
        SUM(CASE WHEN status = 'ABERTO' THEN 1 ELSE 0 END) as em_atendimento
      FROM tickets
      WHERE deleted_at IS NULL
        AND ticket_date >= ${range.start}
        AND ticket_date <= ${range.end}
      GROUP BY DATE(ticket_date)
      ORDER BY date
    `,
    // Top technicians with completion data
    prisma.$queryRaw`
      SELECT
        u.id,
        u.name,
        u.email,
        COUNT(t.id) as count,
        AVG(t.total_time_minutes) as avg_time
      FROM users u
      LEFT JOIN tickets t ON t.technician_id = u.id
        AND t.deleted_at IS NULL
        AND t.ticket_date >= ${range.start}
        AND t.ticket_date <= ${range.end}
      WHERE u.role IN ('ADMIN', 'TI')
      GROUP BY u.id, u.name, u.email
      HAVING COUNT(t.id) > 0
      ORDER BY count DESC
      LIMIT 5
    `,
  ]);

  // 1. CÁLCULO DOS KPIs (usando dados agregados)
  const totalTickets = totalTicketsCount;
  const prevTotalTickets = previousTicketsCount;
  const changePercentTotal =
    prevTotalTickets > 0
      ? Math.round(((totalTickets - prevTotalTickets) / prevTotalTickets) * 100)
      : totalTickets > 0
      ? 100
      : 0;

  const inProgress = statusCounts.find(s => s.status === "ABERTO")?._count || 0;
  const completed = statusCounts.find(s => s.status === "RESOLVIDO")?._count || 0;
  const prevCompleted = previousStatusCounts.find(s => s.status === "RESOLVIDO")?._count || 0;
  const changePercentCompleted =
    prevCompleted > 0
      ? Math.round(((completed - prevCompleted) / prevCompleted) * 100)
      : completed > 0
      ? 100
      : 0;

  const waiting = statusCounts.find(s => s.status === "AGUARDANDO_USUARIO")?._count || 0;
  const scheduled = statusCounts.find(s => s.status === "AGUARDANDO_PECA")?._count || 0;

  const avgTimeMinutesVal = Math.round(avgTimeData._avg.totalTimeMinutes || 0);
  const avgTimePerTechVal =
    activeTechs > 0 && avgTimeData._count > 0
      ? Math.round(avgTimeMinutesVal / Math.max(1, activeTechs))
      : avgTimeMinutesVal;

  // 2. AGRUPAMENTOS PARA OS 11 GRÁFICOS (usando dados agregados)
  // 2.1 Por Técnico
  const techMap: Record<string, { name: string; count: number; totalTime: number; completedCount: number }> = {};
  allUsers.forEach((u) => {
    techMap[u.id] = { name: u.name, count: 0, totalTime: 0, completedCount: 0 };
  });
  techMap["unassigned"] = { name: "Fila Geral (Sem Atribuição)", count: 0, totalTime: 0, completedCount: 0 };

  ticketsByTechnician.forEach((item: any) => {
    const techKey = item.technicianId || "unassigned";
    if (techMap[techKey]) {
      techMap[techKey].count = item._count;
      techMap[techKey].totalTime = item._sum.totalTimeMinutes || 0;
      // Estimativa de completedCount baseada no totalTime
      techMap[techKey].completedCount = item._count; // Simplificação
    }
  });

  // 2.2 Por Setor
  const sectorMap: Record<string, { name: string; count: number; totalTime: number; completedCount: number }> = {};
  allSectors.forEach((sec) => {
    sectorMap[sec.id] = { name: sec.name, count: 0, totalTime: 0, completedCount: 0 };
  });

  ticketsBySector.forEach((item: any) => {
    if (sectorMap[item.sectorId]) {
      sectorMap[item.sectorId].count = item._count;
    }
  });

  // 2.3 Por Serviço
  const serviceMap: Record<string, { name: string; category: string; count: number; totalTime: number; completedCount: number }> = {};
  allServices.forEach((srv) => {
    serviceMap[srv.id] = { name: srv.name, category: srv.category || "TI", count: 0, totalTime: 0, completedCount: 0 };
  });

  ticketsByService.forEach((item: any) => {
    if (serviceMap[item.serviceId]) {
      serviceMap[item.serviceId].count = item._count;
    }
  });

  // 2.4 Por Origem
  const originMap: Record<string, number> = {
    MANUAL: 0,
    WHATSAPP: 0,
    EMAIL: 0,
  };

  ticketsByOrigin.forEach((item: any) => {
    originMap[item.origin || "MANUAL"] = item._count;
  });

  // Serviços por Setor - precisa de uma query específica
  const sectorServiceMap: Record<string, Record<string, { name: string; count: number }>> = {};
  const servicesBySectorData = await prisma.$queryRaw`
    SELECT
      s.name as sector_name,
      serv.name as service_name,
      COUNT(*) as count
    FROM tickets t
    JOIN sectors s ON t.sector_id = s.id
    JOIN services serv ON t.service_id = serv.id
    WHERE t.deleted_at IS NULL
      AND t.ticket_date >= ${range.start}
      AND t.ticket_date <= ${range.end}
    GROUP BY s.name, serv.name
  `;

  (servicesBySectorData as any[]).forEach((item: any) => {
    const sectorName = item.sector_name;
    const serviceName = item.service_name;
    if (!sectorServiceMap[sectorName]) {
      sectorServiceMap[sectorName] = {};
    }
    if (!sectorServiceMap[sectorName][serviceName]) {
      sectorServiceMap[sectorName][serviceName] = { name: serviceName, count: 0 };
    }
    sectorServiceMap[sectorName][serviceName].count = Number(item.count);
  });

  // Formatar dados dos gráficos
  const byTechnician: ChartDataPoint[] = Object.entries(techMap)
    .filter(([_, data]) => data.count > 0)
    .map(([id, data]) => ({
      id,
      name: data.name,
      value: data.count,
      percentage: totalTickets > 0 ? Math.round((data.count / totalTickets) * 100) : 0,
    }))
    .sort((a, b) => b.value - a.value);

  const bySector: ChartDataPoint[] = Object.entries(sectorMap)
    .filter(([_, data]) => data.count > 0)
    .map(([id, data]) => ({
      id,
      name: data.name,
      value: data.count,
      percentage: totalTickets > 0 ? Math.round((data.count / totalTickets) * 100) : 0,
    }))
    .sort((a, b) => b.value - a.value);

  const byService: ChartDataPoint[] = Object.entries(serviceMap)
    .filter(([_, data]) => data.count > 0)
    .map(([id, data]) => ({
      id,
      name: data.name,
      value: data.count,
      percentage: totalTickets > 0 ? Math.round((data.count / totalTickets) * 100) : 0,
    }))
    .sort((a, b) => b.value - a.value);

  const byStatus: ChartDataPoint[] = [
    { name: "Aberto", value: inProgress, color: "#f59e0b" },
    { name: "Resolvido", value: completed, color: "#10b981" },
    { name: "Aguardando", value: waiting, color: "#3b82f6" },
    { name: "Agendado", value: scheduled, color: "#8b5cf6" },
  ];

  const byOrigin: ChartDataPoint[] = [
    { name: "Portal / Manual", value: originMap.MANUAL || 0, color: "#3b82f6" },
    { name: "WhatsApp", value: originMap.WHATSAPP || 0, color: "#10b981" },
    { name: "E-mail", value: originMap.EMAIL || 0, color: "#6366f1" },
  ];

  const avgTimeByTechnician: ChartDataPoint[] = Object.entries(techMap)
    .filter(([_, data]) => data.completedCount > 0)
    .map(([id, data]) => ({
      id,
      name: data.name,
      value: Math.round(data.totalTime / data.completedCount),
    }))
    .sort((a, b) => a.value - b.value); // ASC: fastest first

  const avgTimeByService: ChartDataPoint[] = Object.entries(serviceMap)
    .filter(([_, data]) => data.completedCount > 0)
    .map(([id, data]) => ({
      id,
      name: data.name,
      value: Math.round(data.totalTime / data.completedCount),
    }))
    .sort((a, b) => b.value - a.value);

  const avgTimeBySector: ChartDataPoint[] = Object.entries(sectorMap)
    .filter(([_, data]) => data.completedCount > 0)
    .map(([id, data]) => ({
      id,
      name: data.name,
      value: Math.round(data.totalTime / data.completedCount),
    }))
    .sort((a, b) => b.value - a.value);

  // Serviços por Setor — top 5 por setor
  const servicesBySector: Record<string, Array<{ name: string; count: number }>> = {};
  for (const [sectorName, servicesMap] of Object.entries(sectorServiceMap)) {
    servicesBySector[sectorName] = Object.values(servicesMap)
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  }

  // 3. SÉRIES TEMPORAIS (Dia, Semana, Mês) - usando dados agregados
  const byDayMap: Record<string, { label: string; total: number; concluidos: number; emAtendimento: number }> = {};
  const byWeekMap: Record<string, { label: string; total: number; concluidos: number; emAtendimento: number }> = {};
  const byMonthMap: Record<string, { label: string; total: number; concluidos: number; emAtendimento: number }> = {};

  (ticketsByDay as any[]).forEach((item: any) => {
    const d = new Date(item.date);
    const dateStr = d.toISOString().slice(0, 10);
    const dayLabel = d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });

    byDayMap[dateStr] = {
      label: dayLabel,
      total: Number(item.total),
      concluidos: Number(item.concluidos),
      emAtendimento: Number(item.em_atendimento),
    };

    // Semana
    const weekStart = new Date(d);
    weekStart.setDate(d.getDate() - d.getDay());
    const weekKey = weekStart.toISOString().slice(0, 10);
    const weekLabel = `Semana ${weekStart.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}`;
    if (!byWeekMap[weekKey]) {
      byWeekMap[weekKey] = { label: weekLabel, total: 0, concluidos: 0, emAtendimento: 0 };
    }
    byWeekMap[weekKey].total += Number(item.total);
    byWeekMap[weekKey].concluidos += Number(item.concluidos);
    byWeekMap[weekKey].emAtendimento += Number(item.em_atendimento);

    // Mês
    const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const monthLabel = d.toLocaleDateString("pt-BR", { month: "short", year: "2-digit" }).toUpperCase();
    if (!byMonthMap[monthKey]) {
      byMonthMap[monthKey] = { label: monthLabel, total: 0, concluidos: 0, emAtendimento: 0 };
    }
    byMonthMap[monthKey].total += Number(item.total);
    byMonthMap[monthKey].concluidos += Number(item.concluidos);
    byMonthMap[monthKey].emAtendimento += Number(item.em_atendimento);
  });

  const byDay: TimeSeriesPoint[] = Object.entries(byDayMap)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, data]) => ({ date, ...data }));

  const byWeek: TimeSeriesPoint[] = Object.entries(byWeekMap)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, data]) => ({ date, ...data }));

  const byMonth: TimeSeriesPoint[] = Object.entries(byMonthMap)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, data]) => ({ date, ...data }));

  // 4. RANKINGS DE BI (usando dados agregados)
  const topTechnicians = (topTechsData as any[]).map((item: any) => ({
    id: item.id,
    name: item.name,
    email: item.email,
    count: Number(item.count),
    avgTimeMinutes: Math.round(Number(item.avg_time) || 0),
    percentage: totalTickets > 0 ? Math.round((Number(item.count) / totalTickets) * 100) : 0,
  }));

  const topServices = Object.entries(serviceMap)
    .map(([id, d]) => ({
      id,
      name: d.name,
      category: d.category,
      count: d.count,
      percentage: totalTickets > 0 ? Math.round((d.count / totalTickets) * 100) : 0,
    }))
    .filter((s) => s.count > 0)
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  const topSectors = Object.entries(sectorMap)
    .map(([id, d]) => ({
      id,
      name: d.name,
      count: d.count,
      percentage: totalTickets > 0 ? Math.round((d.count / totalTickets) * 100) : 0,
    }))
    .filter((sec) => sec.count > 0)
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  // Técnico Destaque — o que mais resolveu chamados no período
  const topTech = topTechnicians.length > 0 ? topTechnicians[0] : null;
  const topTechHighlight = topTech && topTech.count > 0
    ? {
        name: topTech.name,
        completedCount: topTech.count,
        avgTimeFormatted: formatMinutes(topTech.avgTimeMinutes),
      }
    : null;

  // Top 3 tempos médios por técnico (os mais rápidos)
  const topAvgTimeTechs = avgTimeByTechnician.slice(0, 3).map((t) => ({
    name: t.name,
    avgTimeMinutes: t.value,
    avgTimeFormatted: formatMinutes(t.value),
  }));

  return {
    kpis: {
      totalTickets: {
        value: totalTickets,
        changePercent: changePercentTotal,
        prevValue: prevTotalTickets,
      },
      inProgress: { value: inProgress },
      completed: {
        value: completed,
        changePercent: changePercentCompleted,
        prevValue: prevCompleted,
      },
      waiting: { value: waiting },
      scheduled: { value: scheduled },
      avgTimeMinutes: {
        value: avgTimeMinutesVal,
        formatted: formatMinutes(avgTimeMinutesVal),
      },
      avgTimePerTech: {
        value: avgTimePerTechVal,
        formatted: formatMinutes(avgTimePerTechVal),
      },
      topTechHighlight,
      topAvgTimeTechs,
    },
    rankings: {
      topTechnicians,
      topServices,
      topSectors,
      servicesBySector,
    },
    charts: {
      byTechnician,
      bySector,
      byService,
      byStatus,
      byOrigin,
      avgTimeByTechnician,
      avgTimeByService,
      avgTimeBySector,
      byDay,
      byWeek,
      byMonth,
      servicesBySector,
    },
    periodRange: {
      start: range.start.toISOString(),
      end: range.end.toISOString(),
      label: range.label,
    },
  };
}

export async function getOperationalDashboardData(params: DashboardFilterParams = {}) {
  const range = getPeriodRange(params);

  // Filtros
  const whereCurrent: Prisma.TicketWhereInput = {
    deletedAt: null,
    ...(params.sectorId ? { sectorId: params.sectorId } : {}),
    ...(params.serviceId ? { serviceId: params.serviceId } : {}),
    ...(params.technicianId ? { technicianId: params.technicianId } : {}),
    OR: [
      { ticketDate: { gte: range.start, lte: range.end } },
      { status: { notIn: ["RESOLVIDO", "CANCELADO"] } },
      { endTime: { gte: range.start, lte: range.end }, status: "RESOLVIDO" },
      { endTime: null, updatedAt: { gte: range.start, lte: range.end }, status: "RESOLVIDO" }
    ],
  };

  // Busca paralela principal
  const [tickets, history, activeTechs] = await Promise.all([
    prisma.ticket.findMany({
      where: whereCurrent,
      include: {
        sector: true,
        service: true,
        technician: true,
        requester: true,
        pauses: true,
      },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.ticketHistory.findMany({
      where: {
        createdAt: { gte: range.start, lte: range.end },
      },
      include: {
        ticket: { select: { ticketNumber: true, problem: true } },
        actor: { select: { name: true, avatar: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 20,
    }),
    prisma.user.findMany({
      where: { role: { in: ["ADMIN", "TI"] }, isActive: true },
      select: { id: true, name: true, email: true, avatar: true },
    }),
  ]);

  // Busca paralela para a Equipe, se o teamPeriod for diferente
  let teamTickets = tickets;
  let teamRange = range;
  if (params.teamPeriod && params.teamPeriod !== params.period) {
    teamRange = getPeriodRange({ period: params.teamPeriod });
    teamTickets = await prisma.ticket.findMany({
      where: {
        deletedAt: null,
        ...(params.sectorId ? { sectorId: params.sectorId } : {}),
        ...(params.serviceId ? { serviceId: params.serviceId } : {}),
        ...(params.technicianId ? { technicianId: params.technicianId } : {}),
        OR: [
          { ticketDate: { gte: teamRange.start, lte: teamRange.end } },
          { status: { notIn: ["RESOLVIDO", "CANCELADO"] } },
          { endTime: { gte: teamRange.start, lte: teamRange.end }, status: "RESOLVIDO" },
          { endTime: null, updatedAt: { gte: teamRange.start, lte: teamRange.end }, status: "RESOLVIDO" }
        ],
      },
      include: {
        sector: true,
        service: true,
        technician: true,
        requester: true,
        pauses: true,
      },
    });
  }

  const now = new Date();
  const todayStr = now.toISOString().slice(0, 10);

  let inProgress = 0;
  let inService = 0;
  let waiting = 0;
  let unassigned = 0;
  let resolvedToday = 0;
  let criticalCount = 0;
  let totalSlaMet = 0;
  let totalWithSla = 0;
  let totalResolvedTime = 0;
  
  // Initialize hours data structure
  const hoursData = Array.from({ length: 24 }, (_, i) => ({
    name: `${String(i).padStart(2, '0')}:00`,
    tickets: 0,
    totalMinutes: 0,
    averageMinutes: 0,
    resolved: 0
  }));

  const criticalTickets: any[] = [];
  const slaRiskTickets: any[] = [];
  
  const techStats: Record<string, { 
    id: string, 
    name: string, 
    activeCount: number, 
    resolvedToday: number,
    resolvedInPeriod: number,
    totalTimeInPeriod: number,
    avgTimeMinutes: number
  }> = {};

  activeTechs.forEach(tech => {
    techStats[tech.id] = { 
      id: tech.id, 
      name: tech.name, 
      activeCount: 0, 
      resolvedToday: 0,
      resolvedInPeriod: 0,
      totalTimeInPeriod: 0,
      avgTimeMinutes: 0
    };
  });

  const calculateEffectiveTime = (t: any): number => {
    if (typeof t.totalTimeMinutes === 'number' && t.totalTimeMinutes > 0) {
      return t.totalTimeMinutes;
    }
    if (t.startTime && t.endTime) {
      const diffMs = new Date(t.endTime).getTime() - new Date(t.startTime).getTime();
      let totalPauseMs = 0;
      if (t.pauses && t.pauses.length > 0) {
        t.pauses.forEach((p: any) => {
          const start = new Date(p.startTime).getTime();
          const end = p.endTime ? new Date(p.endTime).getTime() : new Date().getTime();
          totalPauseMs += (end - start);
        });
      }
      return Math.max(0, Math.floor((diffMs - totalPauseMs) / 60000));
    }
    return 0;
  };

  // Popula team stats usando o array de tickets correto (teamTickets)
  teamTickets.forEach(t => {
    // Only count as active if it's currently open
    if (t.status !== "RESOLVIDO" && t.status !== "CANCELADO" && t.technicianId && techStats[t.technicianId]) {
      techStats[t.technicianId].activeCount++;
    }
    
    if (t.status === "RESOLVIDO") {
      const resolvedDate = t.endTime ? new Date(t.endTime) : new Date(t.updatedAt);
      const closedDate = resolvedDate.toISOString().slice(0, 10);
      if (closedDate === todayStr && t.technicianId && techStats[t.technicianId]) {
        techStats[t.technicianId].resolvedToday++;
      }
      
      // Only compute averages for tickets resolved WITHIN the team period
      if (t.technicianId && techStats[t.technicianId] && resolvedDate >= teamRange.start && resolvedDate <= teamRange.end) {
        techStats[t.technicianId].resolvedInPeriod++;
        techStats[t.technicianId].totalTimeInPeriod += calculateEffectiveTime(t);
      }
    }
  });

  // Calcula tempo médio
  Object.values(techStats).forEach(ts => {
    ts.avgTimeMinutes = ts.resolvedInPeriod > 0 ? Math.round(ts.totalTimeInPeriod / ts.resolvedInPeriod) : 0;
  });

  tickets.forEach(t => {
    const isActive = t.status !== "RESOLVIDO" && t.status !== "CANCELADO";
    const resolvedDate = t.endTime ? new Date(t.endTime) : new Date(t.updatedAt);
    const createdDate = new Date(t.ticketDate || t.createdAt);
    const resolvedInPeriod = t.status === "RESOLVIDO" && resolvedDate >= range.start && resolvedDate <= range.end;

    // Basic counts (ONLY FOR ACTIVE TICKETS)
    if (isActive) {
      if (t.status === "ABERTO") inProgress++;
      if (t.status === "EM_ANDAMENTO" || t.status === "EM_ATENDIMENTO") inService++;
      if (t.status === "AGUARDANDO_USUARIO" || t.status === "AGUARDANDO_PECA" || t.status === "AGUARDANDO") waiting++;
      if (!t.technicianId) unassigned++;
    }
    
    // Critical
    if (isActive && (t.priority === "ALTA" || t.priority === "CRITICA")) {
      criticalCount++;
      criticalTickets.push({
        id: t.id,
        number: t.ticketNumber,
        title: t.problem,
        priority: t.priority,
        dueDate: t.dueDate,
        technicianName: t.technician?.name || null
      });
    }

    // Resolved in period
    if (resolvedInPeriod) {
      const closedDate = resolvedDate.toISOString().slice(0, 10);
      if (closedDate === todayStr) {
        resolvedToday++;
      }
      if (typeof t.totalTimeMinutes === 'number') {
         totalResolvedTime += t.totalTimeMinutes;
      }
    }

    if (t.dueDate) {
      // Calculate adjusted due time by adding pauses
      const dueTime = new Date(t.dueDate).getTime();
      let totalPauseMs = 0;
      if (t.pauses && t.pauses.length > 0) {
        t.pauses.forEach((p: any) => {
          const start = new Date(p.startTime).getTime();
          const end = p.endTime ? new Date(p.endTime).getTime() : now.getTime();
          totalPauseMs += (end - start);
        });
      }
      const adjustedDueTime = dueTime + totalPauseMs;

      if (t.status === "RESOLVIDO") {
        if (resolvedInPeriod) {
          totalWithSla++;
          if (resolvedDate.getTime() <= adjustedDueTime) totalSlaMet++;
        }
      } else if (isActive) {
        totalWithSla++;
        const nowTime = now.getTime();
        const isPaused = t.status === "AGUARDANDO_USUARIO" || t.status === "AGUARDANDO_PECA" || t.status === "AGUARDANDO" || t.status === "AGENDADO" || t.status === "AGUARDANDO_TERCEIROS" || (t.pauses && t.pauses.some((p: any) => !p.endTime));
        if (nowTime <= adjustedDueTime) {
          totalSlaMet++;
          
          // Se faltam 2 horas ou menos, é risco de SLA
          const msLeft = adjustedDueTime - nowTime;
          if (msLeft <= 2 * 60 * 60 * 1000 && !isPaused) {
            slaRiskTickets.push({
              id: t.id,
              number: t.ticketNumber,
              title: t.problem,
              dueDate: t.dueDate,
              msLeft,
              technicianName: t.technician?.name || null,
              isPaused
            });
          }
        } else {
            // Estourado
            if (!isPaused) {
              slaRiskTickets.push({
                id: t.id,
                number: t.ticketNumber,
                title: t.problem,
                dueDate: t.dueDate,
                msLeft: adjustedDueTime - nowTime, // Negativo
                technicianName: t.technician?.name || null,
                breached: true,
                isPaused
              });
            }
        }
      }
    }

    // Tickets by hour (Adjusted for BRT timezone - America/Sao_Paulo)
    // Only map tickets created in the period into the "opened" hour
    if (createdDate >= range.start && createdDate <= range.end) {
      const dateBRT = new Date(createdDate.toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }));
      const hour = dateBRT.getHours();
      hoursData[hour].tickets++;
    }
    
    // Only map tickets resolved in the period into the "resolved" hour
    if (resolvedInPeriod) {
      const dateBRT = new Date(resolvedDate.toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }));
      const hour = dateBRT.getHours();
      hoursData[hour].resolved++;
      const effectiveTime = calculateEffectiveTime(t);
      hoursData[hour].totalMinutes += effectiveTime;
    }
  });

  // Calculate SLA %
  const slaPercent = totalWithSla > 0 ? Math.round((totalSlaMet / totalWithSla) * 100) : 100;
  
  // Calculate Avg Time
  // resolvedCount should only be tickets resolved in the period
  const resolvedCount = tickets.filter(t => t.status === "RESOLVIDO" && (t.endTime ? new Date(t.endTime) : new Date(t.updatedAt)) >= range.start && (t.endTime ? new Date(t.endTime) : new Date(t.updatedAt)) <= range.end).length;
  const avgTimeMinutes = resolvedCount > 0 ? Math.round(totalResolvedTime / resolvedCount) : 0;

  // Format charts
  const byHourChart = hoursData
    .map(data => ({
      ...data,
      averageMinutes: data.tickets > 0 ? Math.round(data.totalMinutes / data.tickets) : 0
    }))
    .filter((_, hour) => hour >= 6 && hour <= 20); // Only business hours to avoid empty space

  const teamList = Object.values(techStats).sort((a, b) => b.activeCount - a.activeCount);
  const rankingList = [...teamList].sort((a, b) => b.resolvedToday - a.resolvedToday).slice(0, 5);
  
  // Ordenar chamados de risco por quão estourados/próximos estão
  slaRiskTickets.sort((a, b) => a.msLeft - b.msLeft);

  return {
    kpis: {
      total: tickets.length,
      inProgress,
      inService,
      waiting,
      unassigned,
      resolvedToday,
      criticalCount,
      slaPercent,
      avgTimeMinutes,
      avgTimeFormatted: formatMinutes(avgTimeMinutes),
      slaRiskCount: slaRiskTickets.length
    },
    charts: {
      byHour: byHourChart,
    },
    lists: {
      criticalTickets: criticalTickets.slice(0, 5),
      slaRiskTickets: slaRiskTickets.slice(0, 10),
      recentEvents: history.map(h => ({
        id: h.id,
        actor: h.actorName || "Sistema",
        action: h.description,
        ticket: h.ticket ? `#${h.ticket.ticketNumber}` : "",
        time: new Date(h.createdAt).toLocaleTimeString("pt-BR", { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' }),
        date: new Date(h.createdAt).toLocaleDateString("pt-BR", { timeZone: 'America/Sao_Paulo' }),
      })),
      teamStatus: teamList,
      ranking: rankingList,
    },
    lastUpdated: now.toISOString(),
  };
}
