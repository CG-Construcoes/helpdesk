"use client";

import React, { useState, useMemo } from "react";
import DOMPurify from "isomorphic-dompurify";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";

type TimelineEvent = {
  id: string;
  type: "PUBLIC" | "INTERNAL" | "HISTORY";
  timestamp: number;
  date: Date;
  authorName: string;
  authorInitials: string;
  content: string; // HTML for PUBLIC, text for INTERNAL/HISTORY
  isHtml: boolean;
  metadata?: any;
};

export function TicketTimeline({ ticket }: { ticket: any }) {
  const [showPublic, setShowPublic] = useState(true);
  const [showInternal, setShowInternal] = useState(true);
  const [showHistory, setShowHistory] = useState(false);

  const timelineEvents = useMemo(() => {
    if (!ticket) return [];
    
    const events: TimelineEvent[] = [];

    // 1. Processed Emails (Ação Pública)
    if (ticket.processedEmails) {
      ticket.processedEmails.forEach((pe: any) => {
        const receivedDate = new Date(pe.receivedAt || pe.processedAt);
        events.push({
          id: `email-${pe.id}`,
          type: "PUBLIC",
          timestamp: receivedDate.getTime(),
          date: receivedDate,
          authorName: pe.from || "Desconhecido",
          authorInitials: (pe.from || "DE").substring(0, 2).toUpperCase(),
          content: pe.bodyReceived || "(Corpo vazio)",
          isHtml: true,
        });

        // Manual replies inside processed email
        if (pe.manualReplies && Array.isArray(pe.manualReplies)) {
          pe.manualReplies.forEach((reply: any, idx: number) => {
            const replyDate = new Date(reply.date);
            events.push({
              id: `email-reply-${pe.id}-${idx}`,
              type: "PUBLIC",
              timestamp: replyDate.getTime(),
              date: replyDate,
              authorName: reply.adminName || "Equipe",
              authorInitials: (reply.adminName || "EQ").substring(0, 2).toUpperCase(),
              content: reply.content || "(Sem conteúdo)",
              isHtml: true,
            });
          });
        }
      });
    }

    // 2. Comments (Ação Interna ou Pública dependendo do isInternal)
    if (ticket.comments) {
      ticket.comments.forEach((c: any) => {
        const commentDate = new Date(c.createdAt);
        events.push({
          id: `comment-${c.id}`,
          type: c.isInternal ? "INTERNAL" : "PUBLIC",
          timestamp: commentDate.getTime(),
          date: commentDate,
          authorName: c.author?.name || "Sistema",
          authorInitials: (c.author?.name || "SI").substring(0, 2).toUpperCase(),
          content: c.content,
          isHtml: c.content?.includes('<p>') || c.content?.includes('<br') || c.content?.includes('<div'),
        });
      });
    }

    // 3. History (Histórico de alterações)
    if (ticket.history) {
      ticket.history.forEach((h: any) => {
        const histDate = new Date(h.createdAt);
        events.push({
          id: `history-${h.id}`,
          type: "HISTORY",
          timestamp: histDate.getTime(),
          date: histDate,
          authorName: h.actorName || "Sistema",
          authorInitials: (h.actorName || "SI").substring(0, 2).toUpperCase(),
          content: h.description === "Chamado criado." 
            ? (ticket.origin === "EMAIL" ? "Ticket aberto por e-mail." : "Ticket criado.")
            : h.description,
          isHtml: false,
          metadata: { old: h.oldValue, new: h.newValue }
        });
      });
    }

    // Ordenar do mais novo para o mais antigo (ordem decrescente cronológica)
    return events.sort((a, b) => b.timestamp - a.timestamp);
  }, [ticket]);

  const filteredEvents = timelineEvents.filter(ev => {
    if (ev.type === "PUBLIC" && !showPublic) return false;
    if (ev.type === "INTERNAL" && !showInternal) return false;
    if (ev.type === "HISTORY" && !showHistory) return false;
    return true;
  });

  return (
    <div className="space-y-6">
      {/* FILTROS */}
      <div className="flex items-center gap-6 px-2 py-4 border-b border-border/50 sticky top-0 bg-background/95 backdrop-blur z-10">
        <span className="text-sm font-semibold text-muted-foreground mr-2">Visualizar:</span>
        <div className="flex items-center gap-2 cursor-pointer">
          <Checkbox 
            id="filter-public" 
            checked={showPublic} 
            onCheckedChange={(c: boolean | "indeterminate") => setShowPublic(!!c)} 
          />
          <Label htmlFor="filter-public" className="cursor-pointer">Ações públicas</Label>
        </div>
        <div className="flex items-center gap-2 cursor-pointer">
          <Checkbox 
            id="filter-internal" 
            checked={showInternal} 
            onCheckedChange={(c: boolean | "indeterminate") => setShowInternal(!!c)} 
          />
          <Label htmlFor="filter-internal" className="cursor-pointer">Ações internas</Label>
        </div>
        <div className="flex items-center gap-2 cursor-pointer">
          <Checkbox 
            id="filter-history" 
            checked={showHistory} 
            onCheckedChange={(c: boolean | "indeterminate") => setShowHistory(!!c)} 
          />
          <Label htmlFor="filter-history" className="cursor-pointer text-muted-foreground">Histórico de alterações</Label>
        </div>
      </div>

      {/* LISTA DA TIMELINE */}
      <div className="space-y-6 pt-2 pb-8">
        {filteredEvents.length === 0 && (
          <p className="text-center text-muted-foreground text-sm py-8">Nenhum evento para exibir com os filtros atuais.</p>
        )}

        {filteredEvents.map((ev) => {
          
          if (ev.type === "HISTORY") {
            return (
              <div key={ev.id} className="flex gap-4 ml-2">
                <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center shrink-0 mt-0.5 border">
                  <span className="text-[9px] text-muted-foreground font-medium">{ev.authorInitials}</span>
                </div>
                <div className="flex-1 space-y-1">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span className="font-medium text-foreground">{ev.authorName}</span>
                    <span>{ev.date.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}</span>
                    <Badge variant="outline" className="text-[9px] px-1 h-4">Histórico</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">{ev.content}</p>
                  {ev.metadata?.old && ev.metadata?.new && (
                    <div className="text-[11px] bg-muted/30 p-1.5 rounded-md mt-1 inline-block border border-border/40">
                      De: <span className="line-through text-destructive/80 mr-2">{ev.metadata.old}</span> 
                      Para: <span className="text-emerald-600 dark:text-emerald-400 font-medium">{ev.metadata.new}</span>
                    </div>
                  )}
                </div>
              </div>
            );
          }

          // PUBLIC ou INTERNAL
          const isInternal = ev.type === "INTERNAL";
          
          return (
            <div key={ev.id} className={`flex gap-4 ${isInternal ? 'ml-8' : ''}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 mt-1 shadow-sm font-bold text-xs ${
                isInternal ? "bg-warning/20 text-warning-foreground border border-warning/30" :
                "bg-primary text-primary-foreground"
              }`}>
                {ev.authorInitials}
              </div>
              
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-3 text-sm mb-1">
                  <span className="font-bold text-foreground">{ev.authorName}</span>
                  <span className="text-muted-foreground text-xs">{ev.date.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}</span>
                  <span className={`text-[10px] uppercase font-semibold tracking-wider ${isInternal ? 'text-warning' : 'text-primary'}`}>
                    {isInternal ? 'Ação Interna' : 'Ação Pública'}
                  </span>
                </div>
                
                <div className={`rounded-xl p-4 text-sm leading-relaxed overflow-x-auto shadow-sm border ${
                  isInternal ? 'bg-warning/10 border-warning/20 text-foreground/90' : 'bg-card border-border/60 text-foreground/90'
                }`}>
                  {ev.isHtml ? (
                    <div 
                      className="email-body-content max-w-full"
                      dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(ev.content, { ADD_DATA_URI_TAGS: ['img'] }) }}
                    />
                  ) : (
                    <p className="whitespace-pre-wrap">{ev.content}</p>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  );
}
