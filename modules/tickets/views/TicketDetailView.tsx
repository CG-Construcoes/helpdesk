"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import DOMPurify from "isomorphic-dompurify";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MoreVertical, ArrowLeft, Loader2, CheckCircle,
} from "lucide-react";
import { TicketSidebar } from "../components/TicketSidebar";
import { TicketActionComposer } from "../components/TicketActionComposer";
import { TicketTimeline } from "../components/TicketTimeline";
import { TicketRelationships } from "../components/TicketRelationships";

export function TicketDetailView({ ticketId }: { ticketId: string }) {
  const router = useRouter();
  const [ticket, setTicket] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  
  // Metadata for dropdowns
  const [sectors, setSectors] = useState<any[]>([]);
  const [services, setServices] = useState<any[]>([]);
  const [technicians, setTechnicians] = useState<any[]>([]);

  useEffect(() => {
    fetchTicketAndMetadata();
  }, [ticketId]);

  async function fetchTicketAndMetadata() {
    setLoading(true);
    try {
      const [tRes, sRes, svRes, techRes] = await Promise.all([
        fetch(`/api/tickets/${ticketId}`),
        fetch("/api/sectors"),
        fetch("/api/services"),
        fetch("/api/users?role=ADMIN_OR_TI&limit=100")
      ]);

      if (!tRes.ok) throw new Error("Ticket não encontrado");

      const [tData, sData, svData, techData] = await Promise.all([
        tRes.json(),
        sRes.json(),
        svRes.json(),
        techRes.json()
      ]);

      setTicket(tData);
      setSectors(sData.sectors || sData || []);
      setServices(svData.services || svData || []);
      
      const parsedTechs = Array.isArray(techData) ? techData : (techData.users || techData.data || []);
      setTechnicians(parsedTechs);
    } catch (err: any) {
      toast.error(err.message || "Erro ao carregar ticket");
      router.push("/chamados");
    } finally {
      setLoading(false);
    }
  }

  async function handleUpdateField(field: string, value: any) {
    try {
      const res = await fetch(`/api/tickets/${ticketId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [field]: value }),
      });
      if (!res.ok) throw new Error("Erro ao atualizar campo");
      const updatedTicket = await res.json();
      
      // Update local state with the actual data from the server (calculates SLA etc)
      setTicket(updatedTicket);
      toast.success("Atualizado com sucesso");
    } catch (err) {
      toast.error("Erro ao atualizar informação");
      // refresh to rollback
      fetchTicketAndMetadata();
    }
  }

  if (loading || !ticket) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col bg-background font-sans">
      {/* HEADER */}
      <header className="flex h-16 shrink-0 items-center justify-between border-b px-6 bg-card shadow-sm z-10">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.push("/chamados")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbLink href="/chamados">Tickets</BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbPage>Ticket #{ticket.ticketNumber}</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>

          <div className="h-6 w-px bg-border mx-2" />

          {/* Status Badge */}
          <Button variant="outline" size="sm" className="h-8 gap-2 uppercase text-xs font-bold tracking-wider cursor-default hover:bg-transparent">
            {ticket.status.replace(/_/g, ' ')}
            <div className="w-2 h-2 rounded-full bg-primary" />
          </Button>
        </div>

        <div className="flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon">
                <MoreVertical className="h-5 w-5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem>Imprimir / Exportar PDF</DropdownMenuItem>
              <DropdownMenuItem className="text-destructive">Arquivar Ticket</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      {/* MAIN CONTENT AREA */}
      <div className="flex flex-1 overflow-hidden">
        {/* CENTER COLUMN */}
        <div className="flex-1 flex flex-col min-w-0 bg-background overflow-y-auto">
          <div className="max-w-4xl w-full mx-auto p-6 lg:p-8 space-y-8">
            
            {/* Title & Subtitle */}
            <div className="space-y-2">
              <h1 className="text-2xl font-bold font-heading text-foreground">
                {ticket.problem}
              </h1>
              <div className="text-sm text-muted-foreground flex items-center gap-2">
                Aberto por <span className="font-semibold text-foreground">{ticket.requester?.name}</span> 
                via <Badge variant="secondary" className="uppercase text-[10px]">{ticket.origin}</Badge> 
                em {new Date(ticket.ticketDate || ticket.createdAt).toLocaleString("pt-BR")}
              </div>
            </div>

            {/* DESCRIPTION PANEL */}
            {ticket.description && (
              <div className="rounded-xl border bg-card p-5 shadow-sm text-sm text-foreground/90 leading-relaxed overflow-x-auto">
                {/<[a-z][\s\S]*>/i.test(ticket.description) ? (
                  <div 
                    className="email-body-content max-w-full"
                    dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(ticket.description, { ADD_DATA_URI_TAGS: ['img'] }) }}
                  />
                ) : (
                  <div className="whitespace-pre-wrap">{ticket.description}</div>
                )}
              </div>
            )}

            {/* SOLUTION PANEL */}
            {ticket.solution && (
              <div className="rounded-xl border border-primary/20 bg-primary/5 p-5 shadow-sm">
                <div className="flex items-center gap-2 mb-3">
                  <CheckCircle className="w-5 h-5 text-primary" />
                  <h3 className="font-bold text-primary font-heading">
                    {ticket.status === "RESOLVIDO" ? "Solução Oficial" : "Última solução registrada"}
                  </h3>
                </div>
                <div 
                  className="prose prose-sm max-w-none text-foreground dark:prose-invert"
                  dangerouslySetInnerHTML={{ __html: ticket.solution }}
                />
              </div>
            )}

            {/* ACTION COMPOSER */}
            <TicketActionComposer 
              ticket={ticket} 
              onActionAdded={fetchTicketAndMetadata} 
              onStatusChange={(status) => handleUpdateField("status", status)}
            />

            <TicketRelationships 
              ticket={ticket} 
              sectors={sectors}
              services={services}
              technicians={technicians}
              onRelationshipsUpdated={fetchTicketAndMetadata}
            />

            {/* TIMELINE */}
            <TicketTimeline ticket={ticket} />
            
          </div>
        </div>

        {/* RIGHT SIDEBAR */}
        <aside className="w-80 border-l bg-card overflow-y-auto shrink-0 hidden md:block">
          <TicketSidebar 
            ticket={ticket}
            sectors={sectors}
            services={services}
            technicians={technicians}
            onUpdateField={handleUpdateField}
          />
        </aside>
      </div>
    </div>
  );
}
