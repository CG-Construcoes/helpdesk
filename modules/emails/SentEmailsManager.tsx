"use client";

import React, { useEffect, useState } from "react";
import { PaperPlaneRight, Eye, Code, X, CalendarBlank } from "@phosphor-icons/react";

interface SentEmail {
  id: string;
  to: string;
  subject: string;
  bodyHtml: string | null;
  ticketId: string | null;
  reason: string;
  sentAt: string;
  ticket?: {
    ticketNumber: number;
    problem: string;
  };
}

export default function SentEmailsManager() {
  const [emails, setEmails] = useState<SentEmail[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [previewEmail, setPreviewEmail] = useState<SentEmail | null>(null);

  useEffect(() => {
    fetchSentEmails();
  }, []);

  const fetchSentEmails = async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/emails/sent?limit=50");
      if (res.ok) {
        const data = await res.json();
        setEmails(data);
      }
    } catch (err) {
      console.error("Erro ao buscar emails enviados", err);
    } finally {
      setIsLoading(false);
    }
  };

  const getReasonBadge = (reason: string) => {
    switch (reason) {
      case "ABERTURA":
        return <span className="px-2 py-1 bg-emerald-500/10 text-emerald-600 rounded text-[10px] font-bold uppercase tracking-wider">Abertura</span>;
      case "FECHAMENTO":
        return <span className="px-2 py-1 bg-violet-500/10 text-violet-600 rounded text-[10px] font-bold uppercase tracking-wider">Fechamento</span>;
      case "RESPOSTA_MANUAL":
        return <span className="px-2 py-1 bg-[#4f78f5]/10 text-[#4f78f5] rounded text-[10px] font-bold uppercase tracking-wider">Resposta</span>;
      case "RECESSO":
        return <span className="px-2 py-1 bg-amber-500/10 text-amber-600 rounded text-[10px] font-bold uppercase tracking-wider">Recesso</span>;
      default:
        return <span className="px-2 py-1 bg-slate-200 text-slate-600 rounded text-[10px] font-bold uppercase tracking-wider">{reason}</span>;
    }
  };

  return (
    <div className="bg-card border border-border/60 rounded-xl overflow-hidden shadow-sm">
      {isLoading ? (
        <div className="p-16 text-center text-muted-foreground animate-pulse">Carregando e-mails enviados...</div>
      ) : emails.length === 0 ? (
        <div className="p-16 text-center text-muted-foreground/80">
          <PaperPlaneRight className="w-16 h-16 mx-auto mb-4 opacity-30 text-muted-foreground/60" weight="thin" />
          <p className="text-lg font-medium text-muted-foreground">Nenhum e-mail enviado</p>
          <p className="text-sm mt-1">O histórico de e-mails enviados a partir de agora aparecerá aqui.</p>
        </div>
      ) : (
        <div className="divide-y divide-border/40">
          {emails.map((email) => (
            <div key={email.id} className="group hover:bg-muted/30/80 transition-colors p-5 flex items-start gap-4 cursor-pointer" onClick={() => setPreviewEmail(email)}>
              <div className="mt-1 shrink-0">
                <PaperPlaneRight weight="fill" className="w-5 h-5 text-[#4f78f5]" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 md:gap-4 mb-1">
                  <p className="text-[15px] font-semibold text-foreground truncate" title={email.subject || "Sem assunto"}>
                    {email.subject || "(Sem assunto)"}
                  </p>
                  <div className="flex items-center gap-3 shrink-0">
                    <time className="text-[12px] text-muted-foreground font-sans font-medium">
                      {new Date(email.sentAt).toLocaleString('pt-BR')}
                    </time>
                  </div>
                </div>
                
                <div className="flex flex-col sm:flex-row sm:items-center gap-2 text-[13px] text-muted-foreground mb-3">
                  <span className="truncate" title={email.to}>
                    Para: <span className="font-semibold text-muted-foreground">{email.to}</span>
                  </span>
                  {email.ticket && (
                    <>
                      <span className="hidden sm:inline text-muted-foreground/60">•</span>
                      <span className="truncate">Ticket #{email.ticket.ticketNumber} ({email.ticket.problem})</span>
                    </>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-2 mt-1">
                  {getReasonBadge(email.reason)}
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-muted text-muted-foreground text-[10px] font-bold uppercase tracking-wider shadow-sm border border-border/40">
                    <Eye className="w-3.5 h-3.5" /> Ver HTML
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal Preview */}
      {previewEmail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-card/80 backdrop-blur-sm animate-in fade-in" onClick={() => setPreviewEmail(null)}>
          <div className="bg-card border border-border w-full max-w-4xl rounded-2xl shadow-xl flex flex-col max-h-[90vh]" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 border-b border-border/50">
              <div>
                <h3 className="font-bold flex items-center gap-2">{previewEmail.subject}</h3>
                <p className="text-xs text-muted-foreground mt-1">Para: {previewEmail.to} • Enviado em {new Date(previewEmail.sentAt).toLocaleString('pt-BR')}</p>
              </div>
              <button onClick={() => setPreviewEmail(null)} className="p-2 hover:bg-muted rounded-full transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 overflow-y-auto custom-scrollbar flex-1 bg-[#f1f5f9]">
              <div 
                className="max-w-[600px] mx-auto bg-card rounded-lg shadow-sm border border-border/60 overflow-hidden font-sans min-h-[400px]"
              >
                {previewEmail.bodyHtml ? (
                  <iframe srcDoc={previewEmail.bodyHtml} className="w-full h-[600px] border-0 bg-white" title="Preview" />
                ) : (
                  <div className="p-8 text-center text-muted-foreground">Sem conteúdo HTML.</div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
