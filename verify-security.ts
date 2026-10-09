import { GET as GetTicket } from "./app/api/tickets/[id]/route";
import { GET as GetComments } from "./app/api/tickets/[id]/comments/route";
import { NextRequest } from "next/server";
import { signSessionToken } from "./lib/auth";
import { prisma } from "./lib/prisma";

async function runTests() {
  console.log("=== INICIANDO TESTES DE SEGURANÇA (FASE 2) ===");
  
  // 1. Setup inicial
  console.log("\n[Setup] Criando/Buscando dados para o teste...");
  let ticket = await prisma.ticket.findFirst({
    where: { deletedAt: null },
    include: { requester: true }
  });

  if (!ticket) {
    console.log("❌ Nenhum ticket encontrado no banco. Por favor adicione um ticket.");
    return;
  }

  // Pegamos um usuário SOLICITANTE diferente do requester do ticket, se não achar cria
  let hackerUser = await prisma.user.findFirst({
    where: {
      role: "SOLICITANTE",
      email: { not: ticket.requester.email }
    }
  });

  if (!hackerUser) {
    hackerUser = await prisma.user.create({
      data: {
        name: "Hacker Teste",
        email: "hacker@teste.com",
        password: "123",
        role: "SOLICITANTE"
      }
    });
  }

  console.log(`✅ Usando Ticket #${ticket.ticketNumber} (Dono: ${ticket.requester.email})`);
  console.log(`✅ Usando Solicitante (Atacante): ${hackerUser.email}`);

  // 2. Gerar Token JWT para o hacker
  const hackerToken = await signSessionToken({
    id: hackerUser.id,
    email: hackerUser.email,
    name: hackerUser.name,
    role: hackerUser.role as any,
    department: hackerUser.department || undefined
  });

  console.log("\n=== TESTANDO IDOR: ACESSO A CHAMADOS DE TERCEIROS ===");
  
  // Função helper para simular uma requisição NextRequest com o cookie
  const createMockRequest = (url: string) => {
    const req = new NextRequest(new URL(url, "http://localhost:3000"));
    req.cookies.set("helpdesk_session", hackerToken);
    return req;
  };

  // Teste A: GET /api/tickets/[id]
  console.log("\nTestando GET /api/tickets/[id]...");
  const reqA = createMockRequest(`/api/tickets/${ticket.id}`);
  const resA = await GetTicket(reqA, { params: Promise.resolve({ id: ticket.id }) });
  
  if (resA.status === 403) {
    console.log("✅ Sucesso: Rota retornou 403 Forbidden conforme esperado.");
  } else {
    console.log(`❌ Falha: Rota retornou status ${resA.status}`);
  }

  // Teste B: GET /api/tickets/[id]/comments
  console.log("\nTestando GET /api/tickets/[id]/comments...");
  const reqB = createMockRequest(`/api/tickets/${ticket.id}/comments`);
  const resB = await GetComments(reqB, { params: Promise.resolve({ id: ticket.id }) });
  
  if (resB.status === 403) {
    console.log("✅ Sucesso: Rota de comentários retornou 403 Forbidden conforme esperado.");
  } else {
    console.log(`❌ Falha: Rota retornou status ${resB.status}`);
  }

  // 3. Teste do JWT Fallback
  console.log("\n=== TESTANDO JWT EM PRODUÇÃO ===");
  console.log("Simulando ausência de JWT_SECRET com NODE_ENV='production'...");
  
  const originalEnv = process.env.NODE_ENV;
  const originalSecret = process.env.JWT_SECRET;
  
  try {
    process.env.NODE_ENV = "production";
    delete process.env.JWT_SECRET;
    
    // Isso deve lançar erro
    require("./lib/auth"); // tentar re-importar pode não engatilhar se já estiver no cache, então fazemos algo mais isolado
    
    // Como Node.js faz cache de módulos, vamos importar o proxy para forçar o erro de parse:
    delete require.cache[require.resolve("./proxy")];
    require("./proxy");
    
    console.log("❌ Falha: O sistema permitiu importação do proxy/auth sem JWT_SECRET em produção.");
  } catch (error: any) {
    if (error.message.includes("CRITICAL SECURITY ERROR")) {
      console.log("✅ Sucesso: O sistema bloqueou a execução com falha crítica: " + error.message);
    } else {
      console.log("⚠️ Comportamento inesperado, erro retornado:", error);
    }
  } finally {
    // Restaurar envs
    process.env.NODE_ENV = originalEnv;
    if (originalSecret) process.env.JWT_SECRET = originalSecret;
  }

  console.log("\n=== TESTES CONCLUÍDOS ===");
}

runTests().catch(console.error).finally(() => prisma.$disconnect());
