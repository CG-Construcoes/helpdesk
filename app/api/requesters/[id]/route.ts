export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { updateRequester, deleteRequester } from "@/services/requester/requester.service";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session || (session.role !== "ADMIN" && session.role !== "TI")) {
      return NextResponse.json({ error: "Permissão insuficiente" }, { status: 403 });
    }

    const { id } = await params;
    const body = await request.json();
    const updated = await updateRequester(id, body);

    return NextResponse.json(updated, { status: 200 });
  } catch (error: any) {
    console.error("[PATCH /api/requesters/[id]] Erro:", error);
    
    if (error.code === "P2002") {
      return NextResponse.json(
        { error: "Já existe um solicitante com este e-mail." },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: "Erro ao atualizar solicitante", details: error.message },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session || (session.role !== "ADMIN" && session.role !== "TI")) {
      return NextResponse.json({ error: "Permissão insuficiente" }, { status: 403 });
    }

    const { id } = await params;
    const res = await deleteRequester(id);

    return NextResponse.json(res, { status: 200 });
  } catch (error: any) {
    console.error("[DELETE /api/requesters/[id]] Erro:", error);
    return NextResponse.json(
      { error: "Erro ao excluir solicitante", details: error.message },
      { status: 500 }
    );
  }
}
