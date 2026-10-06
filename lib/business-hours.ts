export function getEaster(year: number): Date {
  const f = Math.floor,
    G = year % 19,
    C = f(year / 100),
    H = (C - f(C / 4) - f((8 * C + 13) / 25) + 19 * G + 15) % 30,
    I = H - f(H / 28) * (1 - f(29 / (H + 1)) * f((21 - G) / 11)),
    J = (year + f(year / 4) + I + 2 - C + f(C / 4)) % 7,
    L = I - J,
    month = 3 + f((L + 40) / 44),
    day = L + 28 - 31 * f(month / 4);
  return new Date(year, month - 1, day);
}

export function getBrazilianHolidays(year: number): string[] {
  // Feriados fixos
  const fixedHolidays = [
    `${year}-01-01`, // Confraternização Universal
    `${year}-04-21`, // Tiradentes
    `${year}-05-01`, // Dia do Trabalhador
    `${year}-09-07`, // Independência
    `${year}-10-12`, // Nossa Senhora Aparecida
    `${year}-11-02`, // Finados
    `${year}-11-15`, // Proclamação da República
    `${year}-11-20`, // Consciência Negra
    `${year}-12-25`, // Natal
  ];

  // Feriados móveis baseados na Páscoa
  const easter = getEaster(year);
  
  const carnaval = new Date(easter.getTime() - 47 * 24 * 60 * 60 * 1000);
  const paixaoCristo = new Date(easter.getTime() - 2 * 24 * 60 * 60 * 1000);
  const corpusChristi = new Date(easter.getTime() + 60 * 24 * 60 * 60 * 1000);

  const formatDate = (date: Date) => {
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${year}-${m}-${d}`;
  };

  return [
    ...fixedHolidays,
    formatDate(carnaval),
    formatDate(paixaoCristo),
    formatDate(corpusChristi)
  ];
}

/**
 * Calcula a diferença em minutos de horas úteis entre duas datas.
 * Horas úteis: Seg a Sex, das 07:00 às 12:00 e das 13:00 às 18:00 (10 horas diárias).
 * Finais de semana e feriados nacionais são ignorados.
 */
export function calculateBusinessMinutes(startDate: Date, endDate: Date): number {
  if (endDate < startDate) return 0;

  const periods = [
    { start: 7, end: 12 },
    { start: 13, end: 18 }
  ];
  
  const minutesPerFullDay = periods.reduce((acc, p) => acc + (p.end - p.start) * 60, 0);
  let totalMinutes = 0;

  let current = new Date(startDate.getTime());
  
  // Se a data final for a mesma do início e no mesmo dia (otimização)
  if (current.toDateString() === endDate.toDateString()) {
    if (isWorkingDay(current)) {
      return getWorkingMinutesInDay(current, endDate, periods);
    }
    return 0;
  }

  // Adicionar minutos do primeiro dia
  if (isWorkingDay(current)) {
    // Para o primeiro dia, calculamos os minutos restantes no dia
    const endOfDay = new Date(current);
    endOfDay.setHours(23, 59, 59, 999);
    totalMinutes += getWorkingMinutesInDay(current, endOfDay, periods);
  }

  // Avançar para o próximo dia à meia noite
  current.setDate(current.getDate() + 1);
  current.setHours(0, 0, 0, 0);

  // Somar dias inteiros entre start e end
  while (current.toDateString() !== endDate.toDateString() && current < endDate) {
    if (isWorkingDay(current)) {
      totalMinutes += minutesPerFullDay;
    }
    current.setDate(current.getDate() + 1);
  }

  // Adicionar minutos do último dia (se start e end não foram no mesmo dia)
  if (current.toDateString() === endDate.toDateString() && isWorkingDay(endDate)) {
    const startOfLastDay = new Date(endDate);
    startOfLastDay.setHours(0, 0, 0, 0);
    totalMinutes += getWorkingMinutesInDay(startOfLastDay, endDate, periods);
  }

  return totalMinutes;
}

function isWorkingDay(date: Date): boolean {
  const day = date.getDay();
  // Domingo (0) e Sábado (6)
  if (day === 0 || day === 6) return false;

  const year = date.getFullYear();
  const holidays = getBrazilianHolidays(year);
  const dateStr = `${year}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

  if (holidays.includes(dateStr)) return false;

  return true;
}

function getWorkingMinutesInDay(start: Date, end: Date, periods: {start: number, end: number}[]): number {
  const sTime = start.getTime();
  const eTime = end.getTime();
  let total = 0;

  for (const period of periods) {
    const periodStart = new Date(start);
    // Explicitly calculate BRT offset to avoid server timezone issues (Vercel uses UTC)
    // getUTCHours() - getHours() is the timezone offset in hours, but we want fixed BRT (-3)
    // We'll just construct the string in BRT and parse it, or simpler:
    // We set the UTC hours to period.start + 3 (BRT is UTC-3).
    periodStart.setUTCHours(period.start + 3, 0, 0, 0);
    
    const periodEnd = new Date(start);
    periodEnd.setUTCHours(period.end + 3, 0, 0, 0);

    let calcStart = sTime;
    let calcEnd = eTime;

    if (calcStart < periodStart.getTime()) calcStart = periodStart.getTime();
    if (calcEnd > periodEnd.getTime()) calcEnd = periodEnd.getTime();

    if (calcStart < calcEnd) {
      total += Math.round((calcEnd - calcStart) / 60000);
    }
  }

  return total;
}
