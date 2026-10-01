import { NextRequest, NextResponse } from "next/server";
import { runDailyTasks } from "@/services/cron/daily-tasks.service";
import { getSession } from "@/lib/auth";

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  
  const isCronAuthorized = Boolean(cronSecret && authHeader === `Bearer ${cronSecret}`);
  const session = await getSession();
  const isAdmin = session?.role === "ADMIN" || session?.role === "TI";

  if (!isCronAuthorized && !isAdmin) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  try {
    const result = await runDailyTasks();
    return NextResponse.json(result, { status: 200 });
  } catch (error: any) {
    console.error("[CRON DAILY] Erro fatal:", error);
    return NextResponse.json(
      { error: "Erro interno no cron", details: error.message },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  
  const isCronAuthorized = Boolean(cronSecret && authHeader === `Bearer ${cronSecret}`);
  const session = await getSession();
  const isAdmin = session?.role === "ADMIN" || session?.role === "TI";

  if (!isCronAuthorized && !isAdmin) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  try {
    const result = await runDailyTasks();
    return NextResponse.json(result, { status: 200 });
  } catch (error: any) {
    return NextResponse.json(
      { error: "Erro interno no cron", details: error.message },
      { status: 500 }
    );
  }
}
