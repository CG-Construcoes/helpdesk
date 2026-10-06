import { prisma } from "@/lib/prisma";
import crypto from "crypto";
import { calculateTotalTimeMinutes, getTicketMonthYear } from "../ticket/ticket-utils";
import { OrigemType, PrioridadeType, StatusType } from "@prisma/client";

export interface BulkTicketInput {
  solicitante: string;
  setor: string;
  tecnico: string | null;
  dataChamado: Date | null;
  horaInicio: string | null;
  encerramento: string | null;
  problema: string;
  descricao?: string;
  servico: string;
  status: string;
}

export async function processBulkImport(rows: BulkTicketInput[], actorId?: string, actorName?: string) {
  // 1. Extrair nomes únicos
  const uniqueSectors = Array.from(new Set(rows.map(r => (r.setor || "Geral").trim()).filter(Boolean))) as string[];
  const uniqueServices = Array.from(new Set(rows.map(r => (r.servico || "Geral").trim()).filter(Boolean))) as string[];
  const uniqueRequesters = Array.from(new Set(rows.map(r => (r.solicitante || "Usuário Não Informado").trim()).filter(Boolean))) as string[];
  const uniqueTechnicians = Array.from(new Set(rows.map(r => r.tecnico?.trim()).filter(Boolean))) as string[];

  // 2. Buscar existentes
  const existingSectors = await prisma.sector.findMany({ where: { name: { in: uniqueSectors, mode: "insensitive" } } });
  const existingServices = await prisma.service.findMany({ where: { name: { in: uniqueServices, mode: "insensitive" } } });
  const existingRequesters = await prisma.requester.findMany({ where: { name: { in: uniqueRequesters, mode: "insensitive" } } });
  const allTechnicians = await prisma.user.findMany({ where: { role: { in: ["TI", "ADMIN"] } } });

  // 3. Mapear existentes
  const sectorMap = new Map<string, string>(existingSectors.map(s => [s.name.toLowerCase(), s.id]));
  const serviceMap = new Map<string, { id: string; sla: number }>(existingServices.map(s => [s.name.toLowerCase(), { id: s.id, sla: s.slaHours || 24 }]));
  const requesterMap = new Map<string, string>(existingRequesters.map(r => [r.name.toLowerCase(), r.id]));

  // Smart technician match
  const matchTechnician = (rawName?: string | null): string | null => {
    if (!rawName) return null;
    const clean = rawName.toLowerCase().trim();
    if (!clean) return null;
    for (const t of allTechnicians) {
      if (t.name.toLowerCase() === clean) return t.id;
    }
    for (const t of allTechnicians) {
      const tLower = t.name.toLowerCase();
      if (tLower.startsWith(clean) || clean.startsWith(tLower.split(" ")[0])) {
        return t.id;
      }
    }
    return null;
  };

  // Preparar criação de novos
  const newSectors = uniqueSectors.filter(name => !sectorMap.has(name.toLowerCase()));
  const newServices = uniqueServices.filter(name => !serviceMap.has(name.toLowerCase()));
  const newRequesters = uniqueRequesters.filter(name => !requesterMap.has(name.toLowerCase()));

  // 4. Inserir novos em massa
  if (newSectors.length > 0) {
    await prisma.sector.createMany({
      data: newSectors.map(name => ({ name })),
      skipDuplicates: true,
    });
    const inserted = await prisma.sector.findMany({ where: { name: { in: newSectors, mode: "insensitive" } } });
    inserted.forEach(s => sectorMap.set(s.name.toLowerCase(), s.id));
  }

  if (newServices.length > 0) {
    await prisma.service.createMany({
      data: newServices.map(name => ({ name, slaHours: 24 })),
      skipDuplicates: true,
    });
    const inserted = await prisma.service.findMany({ where: { name: { in: newServices, mode: "insensitive" } } });
    inserted.forEach(s => serviceMap.set(s.name.toLowerCase(), { id: s.id, sla: s.slaHours || 24 }));
  }

  if (newRequesters.length > 0) {
    const createdRequestersData = newRequesters.map(name => {
      const cleanName = name
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9]/gi, "")
        .toLowerCase();
      const uniqueSuffix = crypto.randomBytes(4).toString("hex");
      return {
        name,
        email: `${cleanName || "user"}.${uniqueSuffix}@importado.local`,
      };
    });
    await prisma.requester.createMany({
      data: createdRequestersData,
      skipDuplicates: true,
    });
    const inserted = await prisma.requester.findMany({ where: { name: { in: newRequesters, mode: "insensitive" } } });
    inserted.forEach(s => requesterMap.set(s.name.toLowerCase(), s.id));
  }

  // Garantir fallbacks seguros caso algum item falhe no mapa
  let defaultSectorId = existingSectors[0]?.id;
  if (!defaultSectorId) {
    let defSec = await prisma.sector.findFirst({ where: { name: "Geral" } });
    if (!defSec) defSec = await prisma.sector.create({ data: { name: "Geral" } });
    defaultSectorId = defSec.id;
  }

  let defaultServiceObj = existingServices[0] ? { id: existingServices[0].id, sla: existingServices[0].slaHours || 24 } : null;
  if (!defaultServiceObj) {
    let defServ = await prisma.service.findFirst({ where: { name: "Geral" } });
    if (!defServ) defServ = await prisma.service.create({ data: { name: "Geral", slaHours: 24 } });
    defaultServiceObj = { id: defServ.id, sla: defServ.slaHours || 24 };
  }

  let defaultRequesterId = existingRequesters[0]?.id;
  if (!defaultRequesterId) {
    let defReq = await prisma.requester.findFirst({ where: { email: "usuario@importado.local" } });
    if (!defReq) defReq = await prisma.requester.create({ data: { name: "Usuário Não Informado", email: "usuario@importado.local" } });
    defaultRequesterId = defReq.id;
  }

  // 5. Agrupar por Mês/Ano para calcular ticketNumber
  const ticketsByMonth = new Map<string, any[]>();
  
  const ticketsToInsert: any[] = [];
  const historyToInsert: any[] = [];

  for (const row of rows) {
    const id = crypto.randomUUID();
    
    // Resolver IDs com fallback para evitar erros do Prisma
    const sectorId = sectorMap.get((row.setor || "Geral").toLowerCase().trim()) || defaultSectorId;
    const serviceObj = serviceMap.get((row.servico || "Geral").toLowerCase().trim()) || defaultServiceObj;
    const requesterId = requesterMap.get((row.solicitante || "Usuário Não Informado").toLowerCase().trim()) || defaultRequesterId;
    const technicianId = matchTechnician(row.tecnico);

    // Datas
    const ticketDateObj = row.dataChamado && !isNaN(row.dataChamado.getTime()) ? new Date(row.dataChamado) : new Date();
    let startTime = new Date(ticketDateObj);
    if (row.horaInicio) {
      const [h, m] = row.horaInicio.split(":");
      startTime.setHours(parseInt(h, 10) || 0, parseInt(m, 10) || 0, 0, 0);
    }

    let endTime = null;
    if (row.encerramento) {
      endTime = new Date(ticketDateObj);
      const [h, m] = row.encerramento.split(":");
      endTime.setHours(parseInt(h, 10) || 0, parseInt(m, 10) || 0, 0, 0);
      if (endTime < startTime) {
        endTime.setDate(endTime.getDate() + 1);
      }
    }
    
    let statusFinal = row.status as StatusType;
    if (statusFinal === "RESOLVIDO" && !endTime) {
      endTime = new Date();
    }
    if (!Object.values(StatusType).includes(statusFinal)) statusFinal = "ABERTO";

    const totalTimeMinutes = calculateTotalTimeMinutes(startTime, endTime);
    const dueDate = new Date(ticketDateObj);
    dueDate.setHours(dueDate.getHours() + serviceObj.sla);

    const ticketMonthYear = getTicketMonthYear(ticketDateObj);

    const ticketData = {
      id,
      ticketNumber: 0, // será preenchido abaixo
      ticketMonthYear,
      requesterId,
      sectorId,
      serviceId: serviceObj.id,
      technicianId,
      problem: row.problema,
      description: row.descricao,
      status: statusFinal,
      origin: "MANUAL" as OrigemType,
      priority: "MEDIA" as PrioridadeType,
      ticketDate: ticketDateObj,
      startTime,
      endTime,
      totalTimeMinutes,
      dueDate,
      createdAt: ticketDateObj,
      updatedAt: endTime || new Date(),
    };

    if (!ticketsByMonth.has(ticketMonthYear)) {
      ticketsByMonth.set(ticketMonthYear, []);
    }
    ticketsByMonth.get(ticketMonthYear)!.push(ticketData);

    historyToInsert.push({
      id: crypto.randomUUID(),
      ticketId: id,
      actorId: actorId || null,
      actorName: actorName || "Sistema",
      eventType: "CREATED",
      description: "Chamado importado via lote CSV",
      createdAt: ticketDateObj,
    });
  }

  // 6. Gerar Numeração e Inserir com Transação
  await prisma.$transaction(async (tx) => {
    const settings = await tx.settings.findFirst({ select: { monthlyNumbering: true } });
    const useMonthly = settings?.monthlyNumbering ?? true;

    if (useMonthly) {
      // Para cada mês, buscar o último número e iterar
      for (const [monthYear, monthTickets] of Array.from(ticketsByMonth.entries())) {
        const lastTicket = await tx.ticket.findFirst({
          where: { ticketMonthYear: monthYear },
          orderBy: { ticketNumber: "desc" },
          select: { ticketNumber: true },
        });

        let nextNumber = (lastTicket?.ticketNumber || 0) + 1;
        
        for (const t of monthTickets) {
          t.ticketNumber = nextNumber++;
          ticketsToInsert.push(t);
        }
      }
    } else {
      // Numeração contínua
      const lastTicket = await tx.ticket.findFirst({
        orderBy: { ticketNumber: "desc" },
        select: { ticketNumber: true },
      });
      let nextNumber = (lastTicket?.ticketNumber || 0) + 1;

      for (const monthTickets of ticketsByMonth.values()) {
        for (const t of monthTickets) {
          t.ticketNumber = nextNumber++;
          ticketsToInsert.push(t);
        }
      }
    }

    // Inserir todos em bloco (createMany suporta grandes volumes no PostgreSQL)
    await tx.ticket.createMany({ data: ticketsToInsert });
    await tx.ticketHistory.createMany({ data: historyToInsert });
  }, {
    maxWait: 20000,
    timeout: 60000,
  });

  // 7. Retornar Relatório
  return {
    importedCount: rows.length,
    stats: {
      newSectors: newSectors.length,
      reusedSectors: existingSectors.length,
      newServices: newServices.length,
      reusedServices: existingServices.length,
      newRequesters: newRequesters.length,
      reusedRequesters: existingRequesters.length,
    }
  };
}
