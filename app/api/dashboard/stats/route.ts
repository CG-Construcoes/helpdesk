export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { unstable_cache } from "next/cache";
import { getSession } from "@/lib/auth";
import { hasPermission } from "@/services/rbac/rbac.service";
import {
  getDashboardStats,
  DashboardPeriod,
} from "@/services/dashboard/dashboard.service";

export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    const canRead = await hasPermission(session.id, "dashboard.read");
    if (!canRead && session.role !== "ADMIN" && session.role !== "TI") {
      return NextResponse.json(
        { error: "Acesso negado: permissão 'dashboard.read' requerida." },
        { status: 403 }
      );
    }

    const { searchParams } = request.nextUrl;
    const periodParam = searchParams.get("period") as DashboardPeriod | null;
    const startDate = searchParams.get("startDate") || undefined;
    const endDate = searchParams.get("endDate") || undefined;
    const sectorId = searchParams.get("sectorId") || undefined;
    const serviceId = searchParams.get("serviceId") || undefined;
    const technicianId = searchParams.get("technicianId") || undefined;
    
    // Support monthYear=07-2026 or month=07&year=2026
    let monthYear = searchParams.get("monthYear") || undefined;
    if (!monthYear) {
      const month = searchParams.get("month");
      const year = searchParams.get("year");
      if (month && year) {
        monthYear = `${month.padStart(2, "0")}-${year}`;
      }
    }

    // Cache de 30 segundos para reduzir carga no banco
    const getCachedStats = unstable_cache(
      async (params) => getDashboardStats(params),
      ["dashboard-stats"],
      { revalidate: 30, tags: ["dashboard"] }
    );

    const stats = await getCachedStats({
      period: monthYear ? "MONTHLY_SPECIFIC" : (periodParam || "LAST_30_DAYS"),
      startDate,
      endDate,
      monthYear,
      sectorId: sectorId !== "ALL" ? sectorId : undefined,
      serviceId: serviceId !== "ALL" ? serviceId : undefined,
      technicianId: technicianId !== "ALL" ? technicianId : undefined,
    });

    return NextResponse.json(stats, { status: 200 });
  } catch (error: any) {
    console.error("[GET /api/dashboard/stats] Erro:", error);
    return NextResponse.json(
      { error: "Erro ao carregar indicadores do dashboard", details: error.message },
      { status: 500 }
    );
  }
}
