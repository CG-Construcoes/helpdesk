export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getRequestersPaginated, createRequester } from "@/services/requester/requester.service";

export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    const { searchParams } = request.nextUrl;
    const page = parseInt(searchParams.get("page") || "1", 10);
    const limit = parseInt(searchParams.get("limit") || "10", 10);
    const search = searchParams.get("search") || undefined;
    const status = searchParams.get("status") || undefined;
    const sortBy = searchParams.get("sortBy") || "name";
    const sortOrder = (searchParams.get("sortOrder") as "asc" | "desc") || "asc";

    const data = await getRequestersPaginated({
      page,
      limit,
      search,
      status,
      sortBy,
      sortOrder,
    });

    return NextResponse.json(data, { status: 200 });
  } catch (error: any) {
    console.error("[GET /api/requesters] Erro:", error);
    return NextResponse.json(
      { error: "Erro ao listar solicitantes", details: error.message },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session || (session.role !== "ADMIN" && session.role !== "TI")) {
      return NextResponse.json({ error: "Permissão insuficiente" }, { status: 403 });
    }

    const body = await request.json();
    if (!body.name) {
      return NextResponse.json(
        { error: "Nome é obrigatório." },
        { status: 400 }
      );
    }

    const newRequester = await createRequester(body);

    return NextResponse.json(newRequester, { status: 201 });
  } catch (error: any) {
    console.error("[POST /api/requesters] Erro:", error);
    
    if (error.code === "P2002") {
      return NextResponse.json(
        { error: "Já existe um solicitante com este e-mail." },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: "Erro ao criar solicitante", details: error.message },
      { status: 500 }
    );
  }
}
