"use client";

import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { PDFTheme, ReportMode } from "./ExportPDFModal";

async function loadImageAsBase64(url: string): Promise<string | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const blob = await res.blob();
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch (err) {
    console.error("Erro ao carregar logo para o PDF:", err);
    return null;
  }
}

export async function generateProfessionalPDF({
  filters,
  config,
}: {
  filters: any;
  config: {
    theme: PDFTheme;
    mode: ReportMode;
  };
}) {
  // 1. Fetch Executive Report Data
  const params = new URLSearchParams();
  Object.keys(filters).forEach((key) => {
    if (filters[key]) params.append(key, filters[key]);
  });

  let stats: any;
  let settings: any;
  try {
    const [resStats, resSettings] = await Promise.all([
      fetch(`/api/reports/executive?${params.toString()}`),
      fetch(`/api/settings`)
    ]);
    if (!resStats.ok) throw new Error("Falha ao buscar dados do relatório executivo");
    stats = await resStats.json();
    if (resSettings.ok) settings = await resSettings.json();
  } catch (err) {
    console.error(err);
    alert("Erro ao gerar relatório. Verifique sua conexão e tente novamente.");
    return;
  }

  const isDark = config.theme === "DARK";
  const showLogo = settings?.reportShowLogo ?? true;
  const showFooter = settings?.reportShowFooter ?? true;
  const systemName = settings?.systemName || "CG Construções HelpDesk Pro";
  const department = settings?.department || "Departamento de TI";
  const favicon = settings?.favicon || "/cg-logo.png";

  // Formato RETRATO (A4)
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  });

  const pageWidth = doc.internal.pageSize.getWidth(); // 210 mm
  const pageHeight = doc.internal.pageSize.getHeight(); // 297 mm

  // Paleta Corporativa (Azul Institucional, Cinza, Verde, Vermelho, Laranja)
  const bgRGB: [number, number, number] = isDark ? [15, 23, 42] : [255, 255, 255];
  const textRGB: [number, number, number] = isDark ? [248, 250, 252] : [30, 41, 59];
  const textMutedRGB: [number, number, number] = isDark ? [148, 163, 184] : [100, 116, 139];
  const borderRGB: [number, number, number] = isDark ? [51, 65, 85] : [226, 232, 240];
  const primaryRGB: [number, number, number] = [37, 99, 235]; // Azul Institucional
  const cardBgRGB: [number, number, number] = isDark ? [30, 41, 59] : [248, 250, 252];

  const successRGB: [number, number, number] = [16, 185, 129]; // Verde
  const dangerRGB: [number, number, number] = [239, 68, 68]; // Vermelho
  const warningRGB: [number, number, number] = [245, 158, 11]; // Laranja

  function paintBackground() {
    if (isDark) {
      doc.setFillColor(...bgRGB);
      doc.rect(0, 0, pageWidth, pageHeight, "F");
    }
  }

  const logoData = showLogo ? await loadImageAsBase64(favicon) : null;

  let currentPage = 1;

  function drawHeaderAndFooter() {
    // Header
    const startX = 14;
    let currentY = 14;

    if (logoData) {
      try {
        const img = new Image();
        img.src = logoData;
        const ratio = img.naturalWidth && img.naturalHeight ? img.naturalWidth / img.naturalHeight : 2.2;
        const maxLogoH = 12;
        const maxLogoW = 35;
        let logoW = maxLogoH * ratio;
        let logoH = maxLogoH;
        if (logoW > maxLogoW) { logoW = maxLogoW; logoH = maxLogoW / ratio; }
        doc.addImage(logoData, "PNG", startX, currentY, logoW, logoH, undefined, "FAST");
      } catch {
        doc.addImage(logoData, "PNG", startX, currentY, 26, 12, undefined, "FAST");
      }
    }

    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.setTextColor(...textRGB);
    doc.text("RELATÓRIO OPERACIONAL DE TI", startX + (showLogo ? 40 : 0), currentY + 5);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(...textMutedRGB);
    doc.text("Indicadores de Atendimento e Suporte Técnico", startX + (showLogo ? 40 : 0), currentY + 10);

    const nowStr = new Date().toLocaleString("pt-BR");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(...textRGB);
    doc.text(`Período analisado:`, pageWidth - 14, currentY + 2, { align: "right" });
    doc.setFont("helvetica", "normal");
    doc.text(stats.period, pageWidth - 14, currentY + 6, { align: "right" });

    doc.setFontSize(7);
    doc.setTextColor(...textMutedRGB);
    doc.text(`Gerado em: ${nowStr}`, pageWidth - 14, currentY + 11, { align: "right" });

    doc.setDrawColor(...primaryRGB);
    doc.setLineWidth(0.6);
    doc.line(startX, currentY + 16, pageWidth - 14, currentY + 16);

    // Footer
    if (showFooter) {
      const footerY = pageHeight - 12;
      doc.setDrawColor(...borderRGB);
      doc.setLineWidth(0.3);
      doc.line(startX, footerY - 4, pageWidth - 14, footerY - 4);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(...textMutedRGB);
      doc.text(`${systemName} — ${department} | Relatório gerado automaticamente pelo HelpDesk`, startX, footerY);
      doc.text(`Página ${currentPage}`, pageWidth - 14, footerY, { align: "right" });
    }
  }

  // =========================================================
  // PÁGINA 1: VISÃO EXECUTIVA
  // =========================================================
  paintBackground();
  drawHeaderAndFooter();

  let cy = 40;

  // 1. Resumo Executivo (Cards)
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(...textRGB);
  doc.text("1. RESUMO EXECUTIVO", 14, cy);
  cy += 6;

  const summaryCards = [
    { label: "TOTAL DE CHAMADOS", value: stats.kpis.totalTickets, sub: "no período" },
    { label: "RESOLVIDOS", value: stats.kpis.resolvedTickets, sub: `${stats.kpis.resolvedPercent}% do total` },
    { label: "EM ATENDIMENTO", value: stats.kpis.inProgressTickets, sub: "fila atual" },
    { label: "PENDENTES", value: stats.kpis.pendingTickets, sub: "em aguardo" },
    { label: "AGUARDANDO TERCEIROS", value: stats.kpis.waitingThirdPartiesTickets, sub: "SLA pausado", valColor: warningRGB },
    { label: "SLA CUMPRIDO", value: `${stats.sla.metPercent}%`, sub: `${stats.sla.met} no prazo`, valColor: successRGB },
    { label: "SLA ESTOURADO", value: stats.sla.breached, sub: "acima do prazo", valColor: dangerRGB },
    { label: "TEMPO MÉDIO", value: stats.kpis.avgTimeFormatted, sub: "de resolução" },
  ];

  const cardW = 42;
  const cardH = 22;
  const gapX = (pageWidth - 28 - (cardW * 4)) / 3;
  const gapY = 5;

  summaryCards.forEach((c, idx) => {
    const col = idx % 4;
    const row = Math.floor(idx / 4);
    const cx = 14 + col * (cardW + gapX);
    const cStartY = cy + row * (cardH + gapY);

    doc.setFillColor(...cardBgRGB);
    doc.setDrawColor(...borderRGB);
    doc.setLineWidth(0.3);
    doc.roundedRect(cx, cStartY, cardW, cardH, 2, 2, "FD");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(7);
    doc.setTextColor(...textMutedRGB);
    doc.text(c.label, cx + 3, cStartY + 6);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    if (c.valColor) doc.setTextColor(...c.valColor);
    else doc.setTextColor(...textRGB);
    doc.text(String(c.value), cx + 3, cStartY + 14);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(...textMutedRGB);
    doc.text(c.sub, cx + 3, cStartY + 19);
  });

  cy += (cardH * 2) + gapY + 12;

  // 2. Desempenho de SLA & Pausas
  const midX = pageWidth / 2;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(...textRGB);
  doc.text("2. DESEMPENHO DE SLA", 14, cy);
  doc.text("3. SLA E AGUARDANDO TERCEIROS", midX + 4, cy);
  cy += 6;

  // Tabela SLA
  const slaRows = [
    ["SLA Cumprido", String(stats.sla.met)],
    ["SLA Estourado", String(stats.sla.breached)],
    ["SLA em Andamento", String(stats.sla.inProgress)],
  ];
  autoTable(doc, {
    startY: cy,
    margin: { left: 14 },
    tableWidth: (pageWidth - 36) / 2,
    head: [["Indicador", "Quantidade"]],
    body: slaRows,
    theme: "grid",
    styles: { fontSize: 8, cellPadding: 2, textColor: textRGB, fillColor: cardBgRGB, lineColor: borderRGB, lineWidth: 0.2 },
    headStyles: { fillColor: isDark ? [51, 65, 85] : [241, 245, 249], textColor: textRGB, fontStyle: "bold" },
  });

  // Tabela Pausas
  const pausaRows = [
    ["Chamados com SLA Pausado", String(stats.sla.paused)],
    ["Tempo Total Aguardando Terceiros", stats.sla.totalPauseTimeFormatted],
  ];
  autoTable(doc, {
    startY: cy,
    margin: { left: midX + 4 },
    tableWidth: (pageWidth - 36) / 2,
    head: [["Métrica Operacional", "Valor"]],
    body: pausaRows,
    theme: "grid",
    styles: { fontSize: 8, cellPadding: 2, textColor: textRGB, fillColor: cardBgRGB, lineColor: borderRGB, lineWidth: 0.2 },
    headStyles: { fillColor: isDark ? [51, 65, 85] : [241, 245, 249], textColor: textRGB, fontStyle: "bold" },
  });

  cy = (doc as any).lastAutoTable.finalY + 12;

  // 4. Operação de E-mail
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(...textRGB);
  doc.text("4. OPERAÇÃO DE E-MAIL", 14, cy);
  cy += 6;

  const emailCards = [
    { label: "E-MAILS PROCESSADOS", value: stats.email.processed },
    { label: "GERARAM CHAMADOS", value: stats.email.generated },
    { label: "ORIGINADOS POR E-MAIL", value: stats.email.origin },
    { label: "RESPOSTAS AUTOMÁTICAS", value: stats.email.repliesSent },
    { label: "RESPOSTAS MANUAIS", value: stats.email.manualReplies },
    { label: "SEM CHAMADO GERADO", value: stats.email.noTicket },
  ];

  const emailCardW = (pageWidth - 28 - (gapX * 2)) / 3;
  emailCards.forEach((c, idx) => {
    const col = idx % 3;
    const row = Math.floor(idx / 3);
    const cx = 14 + col * (emailCardW + gapX);
    const cStartY = cy + row * (18 + gapY);

    doc.setFillColor(...cardBgRGB);
    doc.setDrawColor(...borderRGB);
    doc.setLineWidth(0.3);
    doc.roundedRect(cx, cStartY, emailCardW, 18, 2, 2, "FD");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(7);
    doc.setTextColor(...textMutedRGB);
    doc.text(c.label, cx + 3, cStartY + 6);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(...textRGB);
    doc.text(String(c.value), cx + 3, cStartY + 13);
  });

  cy += (18 * 2) + gapY + 12;

  // Resumo Operacional Determinístico
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(...textRGB);
  doc.text("5. RESUMO OPERACIONAL", 14, cy);
  cy += 6;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...textRGB);
  stats.operationalSummary.forEach((line: string) => {
    doc.circle(16, cy - 1, 1, "F");
    doc.text(line, 20, cy, { maxWidth: pageWidth - 34 });
    const textLines = doc.splitTextToSize(line, pageWidth - 34);
    cy += (textLines.length * 4) + 2;
  });

  // =========================================================
  // PÁGINA 2: DESEMPENHO OPERACIONAL
  // =========================================================
  doc.addPage("a4", "portrait");
  currentPage++;
  paintBackground();
  drawHeaderAndFooter();

  cy = 40;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.setTextColor(...textRGB);
  doc.text("DESEMPENHO OPERACIONAL", 14, cy);
  cy += 8;

  // 6. Ranking de Técnicos
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text("Desempenho da Equipe Técnica", 14, cy);
  cy += 4;

  const techRows = stats.tables.topTechs.map((t: any, i: number) => [
    `${i + 1}º`, t.name, t.resolved, t.avgTime, t.slaMet, t.slaBreached
  ]);
  autoTable(doc, {
    startY: cy,
    margin: { left: 14 },
    tableWidth: pageWidth - 28,
    head: [["Posição", "Técnico", "Resolvidos", "Tempo Médio", "SLA Cumprido", "SLA Estourado"]],
    body: techRows.length > 0 ? techRows : [["-", "Sem registros no período", "-", "-", "-", "-"]],
    theme: "grid",
    styles: { fontSize: 8, cellPadding: 2, textColor: textRGB, fillColor: cardBgRGB, lineColor: borderRGB, lineWidth: 0.2 },
    headStyles: { fillColor: isDark ? [51, 65, 85] : [241, 245, 249], textColor: textRGB, fontStyle: "bold" },
  });

  cy = (doc as any).lastAutoTable.finalY + 10;

  // 7. Setores e Serviços (Lado a Lado)
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text("Setores com Maior Demanda", 14, cy);
  doc.text("Serviços Mais Solicitados", midX + 4, cy);
  cy += 4;

  const sectorRows = stats.tables.topSectors.slice(0, 8).map((s: any) => [s.name, s.count, `${s.percentage}%`, s.resolved, s.pending]);
  autoTable(doc, {
    startY: cy,
    margin: { left: 14 },
    tableWidth: (pageWidth - 36) / 2,
    head: [["Setor", "Chamados", "%", "Res.", "Pend."]],
    body: sectorRows.length > 0 ? sectorRows : [["-", "-", "-", "-", "-"]],
    theme: "grid",
    styles: { fontSize: 7, cellPadding: 1.5, textColor: textRGB, fillColor: cardBgRGB, lineColor: borderRGB, lineWidth: 0.2 },
    headStyles: { fillColor: isDark ? [51, 65, 85] : [241, 245, 249], textColor: textRGB, fontStyle: "bold" },
  });

  const serviceRows = stats.tables.topServices.slice(0, 8).map((s: any) => [s.name, s.count, `${s.percentage}%`, s.avgTime]);
  autoTable(doc, {
    startY: cy,
    margin: { left: midX + 4 },
    tableWidth: (pageWidth - 36) / 2,
    head: [["Serviço", "Qtd.", "%", "TMA"]],
    body: serviceRows.length > 0 ? serviceRows : [["-", "-", "-", "-"]],
    theme: "grid",
    styles: { fontSize: 7, cellPadding: 1.5, textColor: textRGB, fillColor: cardBgRGB, lineColor: borderRGB, lineWidth: 0.2 },
    headStyles: { fillColor: isDark ? [51, 65, 85] : [241, 245, 249], textColor: textRGB, fontStyle: "bold" },
  });

  cy = Math.max((doc as any).lastAutoTable.finalY, cy + 40) + 10;

  // 8. Volume por Hora e Evolução (Lado a Lado - Tabelas Simplificadas em vez de Gráficos Complexos)
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text("Volume de Atendimento por Hora", 14, cy);
  doc.text("Distribuição por Status e Origem", midX + 4, cy);
  cy += 4;

  const hourRows = stats.charts.hourMap.slice(0, 10).map((h: any) => [h.hour, h.count]);
  autoTable(doc, {
    startY: cy,
    margin: { left: 14 },
    tableWidth: (pageWidth - 36) / 2,
    head: [["Horário", "Volume (Abertos)"]],
    body: hourRows.length > 0 ? hourRows : [["-", "-"]],
    theme: "grid",
    styles: { fontSize: 7, cellPadding: 1.5, textColor: textRGB, fillColor: cardBgRGB, lineColor: borderRGB, lineWidth: 0.2 },
    headStyles: { fillColor: isDark ? [51, 65, 85] : [241, 245, 249], textColor: textRGB, fontStyle: "bold" },
  });

  const distRows = [
    [{ content: "Status", colSpan: 2, styles: { fontStyle: "bold", fillColor: isDark ? [51, 65, 85] : [241, 245, 249] } }],
    ...stats.charts.statuses.slice(0, 4).map((s: any) => [s.name, `${s.value} (${s.percentage}%)`]),
    [{ content: "Origem", colSpan: 2, styles: { fontStyle: "bold", fillColor: isDark ? [51, 65, 85] : [241, 245, 249] } }],
    ...stats.charts.origins.map((o: any) => [o.name, `${o.value} (${o.percentage}%)`]),
  ];

  autoTable(doc, {
    startY: cy,
    margin: { left: midX + 4 },
    tableWidth: (pageWidth - 36) / 2,
    body: distRows,
    theme: "grid",
    styles: { fontSize: 7, cellPadding: 1.5, textColor: textRGB, fillColor: cardBgRGB, lineColor: borderRGB, lineWidth: 0.2 },
  });

  // =========================================================
  // PÁGINA 3: ATENÇÃO E CRÍTICOS
  // =========================================================
  doc.addPage("a4", "portrait");
  currentPage++;
  paintBackground();
  drawHeaderAndFooter();

  cy = 40;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.setTextColor(...dangerRGB);
  doc.text("PONTOS DE ATENÇÃO & CHAMADOS CRÍTICOS", 14, cy);
  cy += 8;

  // Chamados Críticos Tabela
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(...textRGB);
  doc.text("Chamados Críticos (SLA Estourado, Alta Prioridade ou Aguardando Terceiros)", 14, cy);
  cy += 4;

  const criticalRows = stats.tables.criticalTickets.map((c: any) => [
    `#${c.ticketNumber}`, c.sector, c.service, c.technician, c.status, c.priority, c.isBreached ? "Sim" : "Não"
  ]);

  autoTable(doc, {
    startY: cy,
    margin: { left: 14 },
    tableWidth: pageWidth - 28,
    head: [["Ticket", "Setor", "Serviço", "Técnico", "Status", "Prioridade", "SLA Estourado"]],
    body: criticalRows.length > 0 ? criticalRows : [["Nenhum chamado crítico aberto no momento.", "-", "-", "-", "-", "-", "-"]],
    theme: "grid",
    styles: { fontSize: 7.5, cellPadding: 2, textColor: textRGB, fillColor: cardBgRGB, lineColor: borderRGB, lineWidth: 0.2 },
    headStyles: { fillColor: isDark ? [127, 29, 29] : [254, 226, 226], textColor: isDark ? [254, 226, 226] : [153, 27, 27], fontStyle: "bold" },
  });

  cy = (doc as any).lastAutoTable.finalY + 10;

  // Evolução Mensal
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(...textRGB);
  doc.text("Evolução Mensal (Histórico recente)", 14, cy);
  cy += 4;

  const monthRows = stats.charts.monthlyEvolution.map((m: any) => [
    m.label, m.opened, m.resolved, `${m.slaPercent}%`
  ]);

  autoTable(doc, {
    startY: cy,
    margin: { left: 14 },
    tableWidth: pageWidth - 28,
    head: [["Mês", "Chamados Abertos", "Chamados Resolvidos", "SLA Cumprido (%)"]],
    body: monthRows.length > 0 ? monthRows : [["-", "-", "-", "-"]],
    theme: "grid",
    styles: { fontSize: 8, cellPadding: 2, textColor: textRGB, fillColor: cardBgRGB, lineColor: borderRGB, lineWidth: 0.2 },
    headStyles: { fillColor: isDark ? [51, 65, 85] : [241, 245, 249], textColor: textRGB, fontStyle: "bold" },
  });

  // DISPARAR DOWNLOAD
  const filename = `Relatorio_Operacional_TI_${new Date().toISOString().slice(0, 10)}.pdf`;
  doc.save(filename);
}
