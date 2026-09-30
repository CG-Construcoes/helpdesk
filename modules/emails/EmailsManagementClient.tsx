"use client";

import React, { useState } from "react";
import { toast } from "sonner";
import { EnvelopeSimple, CheckCircle, WarningCircle, CaretDown, CaretUp, Code, PenNib, PaperPlaneRight, X, Trash, Broom, PencilSimple } from "@phosphor-icons/react";
import EmailTemplatesManager from "./EmailTemplatesManager";
import SignatureSettingsModal from "./SignatureSettingsModal";
import SentEmailsManager from "./SentEmailsManager";

interface ProcessedEmail {
  id: string;
  messageId: string;
  subject: string | null;
  from: string | null;
  processedAt: Date;
  ticketId: string | null;
  status: string;
  bodyReceived: string | null;
  bodySent: string | null;
  manualReplies?: any;
  ticket?: { ticketNumber: number } | null;
}

interface EmailsManagementClientProps {
  initialEmails: ProcessedEmail[];
}

export default function EmailsManagementClient({ initialEmails }: EmailsManagementClientProps) {
  const [emails, setEmails] = useState<ProcessedEmail[]>(initialEmails);
  const [activeTab, setActiveTab] = useState<"history" | "sent" | "templates">("history");
  const [expandedEmailId, setExpandedEmailId] = useState<string | null>(null);
  
  // Reply State
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replySubject, setReplySubject] = useState("");
  const [replyCc, setReplyCc] = useState("");
  const [replyContent, setReplyContent] = useState("");
  const [signatureHtml, setSignatureHtml] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [replySuccess, setReplySuccess] = useState<string | null>(null);
  const [replyError, setReplyError] = useState<string | null>(null);
  const [checkLoading, setCheckLoading] = useState(false);
  const [showSignatureSettings, setShowSignatureSettings] = useState(false);

  const toggleExpand = (id: string) => {
    if (expandedEmailId === id) {
      setExpandedEmailId(null);
      setReplyingTo(null);
    } else {
      setExpandedEmailId(id);
      
      const email = emails.find(e => e.id === id);
      if (email) {
        setReplyingTo(email.id);
        setReplySubject(email.subject ? `Re: ${email.subject}` : "Re:");
        setReplyCc("");
        
        try {
          const savedSig = localStorage.getItem("@helpdesk:signature");
          if (savedSig) {
            const sig = JSON.parse(savedSig);
            setSignatureHtml(sig.html || "");
          } else {
            setSignatureHtml("");
          }
        } catch (e) {
          setSignatureHtml("");
        }
        setReplyContent("");
        
        setReplySuccess(null);
        setReplyError(null);
      }
    }
  };

  const handleStartReply = (email: ProcessedEmail) => {
    setReplyingTo(email.id);
    setReplySubject(email.subject ? `Re: ${email.subject}` : "Re:");
    setReplyContent("");
    setReplySuccess(null);
    setReplyError(null);
  };

  const handleSubmitReply = async (email: ProcessedEmail, e: React.FormEvent) => {
    e.preventDefault();
    setIsSending(true);
    setReplySuccess(null);
    setReplyError(null);

    try {
      const res = await fetch("/api/email/reply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: email.from,
          cc: replyCc,
          subject: replySubject,
          content: replyContent.replace(/\n/g, '<br/>') + (signatureHtml ? `<br/><br/>${signatureHtml}` : ""),
          inReplyTo: email.messageId, // Threading
        }),
      });

      const data = await res.json();

      if (res.ok) {
        setReplySuccess("E-mail respondido com sucesso!");
        setReplyingTo(null);
        
        // Simular atualização no frontend
        setEmails(prev => prev.map(em => {
          if (em.id === email.id) {
            const newReply = { date: new Date().toISOString(), adminName: "Você", subject: replySubject, content: replyContent };
            const existingReplies = em.manualReplies ? (Array.isArray(em.manualReplies) ? em.manualReplies : [em.manualReplies]) : [];
            return { ...em, manualReplies: [...existingReplies, newReply] };
          }
          return em;
        }));
      } else {
        setReplyError(data.error || "Falha ao enviar e-mail.");
      }
    } catch (err: any) {
      setReplyError(err.message || "Erro de conexão.");
    } finally {
      setIsSending(false);
    }
  };

  const checkNewEmails = async () => {
    toast.info("Iniciando verificação da caixa de entrada...");
    setCheckLoading(true);
    try {
      const res = await fetch("/api/email/check", { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        toast.success(`Verificação concluída. E-mails processados: ${data.processed}, Erros: ${data.errors}`);
        window.location.reload(); // Quickest way to refresh since it's a server component
      } else {
        toast.error("Erro na verificação: " + (data.error || "Desconhecido"));
      }
    } catch (err: any) {
      toast.error("Erro na comunicação com o servidor.");
    } finally {
      setCheckLoading(false);
    }
  };

  const handleCleanup = async (days: number | null) => {
    let confirmMsg = days 
      ? `Tem certeza que deseja apagar permanentemente todos os registros de e-mail IMAP mais antigos que ${days} dias?` 
      : "Tem certeza que deseja apagar TODO o histórico de e-mails IMAP do banco?";
      
    if (!window.confirm(confirmMsg)) return;
    
    try {
      const query = days ? `?days=${days}` : "";
      const res = await fetch(`/api/email/cleanup${query}`, { method: "DELETE" });
      const data = await res.json();
      
      if (res.ok) {
        alert(data.message);
        window.location.reload();
      } else {
        alert("Erro: " + data.error);
      }
    } catch (err) {
      alert("Erro ao limpar histórico.");
    }
  };

  const handleDeleteIndividual = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (!window.confirm("Deseja apagar este registro do histórico de e-mails?")) return;
    
    try {
      const res = await fetch(`/api/email/cleanup/${id}`, { method: "DELETE" });
      if (res.ok) {
        setEmails(prev => prev.filter(em => em.id !== id));
      } else {
        alert("Erro ao excluir registro.");
      }
    } catch (err) {
      alert("Erro de conexão.");
    }
  };

  return (
    <div className="p-6 md:p-8 max-w-[1400px] mx-auto space-y-6">
      
      {/* 1. CABEÇALHO */}
      <div className="flex items-center gap-4 mb-6">
        <div className="p-3 bg-[#4f78f5]/10 text-[#4f78f5] rounded-2xl">
          <EnvelopeSimple weight="duotone" className="w-8 h-8" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Gestão de E-mails</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Controle do histórico IMAP e templates dinâmicos de resposta.
          </p>
        </div>
      </div>

      {/* 2. ABAS */}
      <div className="flex items-center gap-6 border-b border-border/60 pb-px mb-6">
        <button
          onClick={() => setActiveTab("history")}
          className={`pb-3 text-sm font-semibold transition-colors relative ${
            activeTab === "history" 
              ? "text-[#4f78f5]" 
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          Histórico IMAP
          {activeTab === "history" && (
            <div className="absolute bottom-0 left-0 w-full h-0.5 bg-[#4f78f5] rounded-t-full" />
          )}
        </button>
        <button
          onClick={() => setActiveTab("sent")}
          className={`pb-3 text-sm font-semibold transition-colors relative ${
            activeTab === "sent" 
              ? "text-[#4f78f5]" 
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          Enviados
          {activeTab === "sent" && (
            <div className="absolute bottom-0 left-0 w-full h-0.5 bg-[#4f78f5] rounded-t-full" />
          )}
        </button>
        <button
          onClick={() => setActiveTab("templates")}
          className={`pb-3 text-sm font-semibold transition-colors relative ${
            activeTab === "templates" 
              ? "text-[#4f78f5]" 
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          Templates de Resposta
          {activeTab === "templates" && (
            <div className="absolute bottom-0 left-0 w-full h-0.5 bg-[#4f78f5] rounded-t-full" />
          )}
        </button>
      </div>

      {activeTab === "history" && (
        <div className="bg-card border border-border/60 rounded-xl overflow-hidden shadow-sm">
          
          {/* 4. BARRA DE CONTROLE */}
          {emails.length > 0 && (
            <div className="bg-muted/30/50 p-4 border-b border-border/60 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <span className="text-sm text-muted-foreground font-medium">
                {emails.length} {emails.length === 1 ? 'registro listado' : 'registros listados'}.
              </span>
              
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground/80 flex items-center gap-1.5 mr-2">
                  <Broom className="w-4 h-4" /> Limpar Histórico:
                </span>
                <button 
                  onClick={() => handleCleanup(30)}
                  className="px-3 py-1.5 text-xs font-bold uppercase tracking-wide bg-card border border-border/60 text-muted-foreground hover:bg-muted/50 rounded-lg transition-colors"
                >
                  +30 dias
                </button>
                <button 
                  onClick={() => handleCleanup(14)}
                  className="px-3 py-1.5 text-xs font-bold uppercase tracking-wide bg-card border border-border/60 text-muted-foreground hover:bg-muted/50 rounded-lg transition-colors"
                >
                  +14 dias
                </button>
                <button 
                  onClick={() => handleCleanup(7)}
                  className="px-3 py-1.5 text-xs font-bold uppercase tracking-wide bg-card border border-border/60 text-muted-foreground hover:bg-muted/50 rounded-lg transition-colors"
                >
                  +7 dias
                </button>
                <button 
                  onClick={() => handleCleanup(null)}
                  className="px-3 py-1.5 text-xs font-bold uppercase tracking-wide bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20 hover:bg-red-500/20 rounded-lg transition-colors ml-1"
                >
                  Tudo
                </button>
              </div>
            </div>
          )}
          
          {/* 5. LISTA DE E-MAILS */}
          {emails.length === 0 ? (
            <div className="p-16 text-center text-muted-foreground/80">
              <EnvelopeSimple className="w-16 h-16 mx-auto mb-4 opacity-30 text-muted-foreground/60" weight="thin" />
              <p className="text-lg font-medium text-muted-foreground">Caixa de entrada vazia</p>
              <p className="text-sm mt-1">Nenhum e-mail processado recentemente.</p>
            </div>
          ) : (
            <div className="divide-y divide-border/40">
              {emails.map((email) => {
                const isExpanded = expandedEmailId === email.id;
                
                return (
                  <div key={email.id} className="group hover:bg-muted/30/80 transition-colors">
                    {/* Linha Principal (Header do Card) */}
                    <div 
                      className="p-5 flex items-start gap-4 cursor-pointer"
                      onClick={() => toggleExpand(email.id)}
                    >
                      <div className="mt-1 shrink-0">
                        {email.status === "PROCESSED" ? (
                          <CheckCircle weight="fill" className="w-5 h-5 text-emerald-500" />
                        ) : (
                          <WarningCircle weight="fill" className="w-5 h-5 text-amber-500" />
                        )}
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 md:gap-4 mb-2">
                          {/* 6. ASSUNTO */}
                          <p className="text-[15px] font-semibold text-foreground truncate" title={email.subject || "Sem assunto"}>
                            {email.subject || "(Sem assunto)"}
                          </p>
                          
                          {/* 8. DATA E HORA */}
                          <div className="flex items-center gap-3 shrink-0">
                            <time className="text-[12px] text-muted-foreground font-sans font-medium">
                              {new Date(email.processedAt).toLocaleString('pt-BR')}
                            </time>
                            {isExpanded ? (
                              <CaretUp className="w-4 h-4 text-muted-foreground/80 group-hover:text-muted-foreground transition-colors" />
                            ) : (
                              <CaretDown className="w-4 h-4 text-muted-foreground/80 group-hover:text-muted-foreground transition-colors" />
                            )}
                          </div>
                        </div>
                        
                        {/* 7. REMETENTE & 9. ID */}
                        <div className="flex flex-col sm:flex-row sm:items-center gap-2 text-[13px] text-muted-foreground mb-3">
                          <span className="truncate" title={email.from || ""}>
                            De: <span className="font-semibold text-muted-foreground">{email.from}</span>
                          </span>
                          <span className="hidden sm:inline text-muted-foreground/60">•</span>
                          
                          <div className="group/id relative" onClick={(e) => e.stopPropagation()}>
                            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/80 cursor-pointer hover:text-[#4f78f5] transition-colors flex items-center gap-1">
                              <Code className="w-3.5 h-3.5" /> ID da Mensagem
                            </span>
                            <div className="absolute left-0 top-full mt-1.5 hidden group-hover/id:block bg-card text-foreground text-[10px] p-2.5 rounded shadow-xl z-50 max-w-sm break-all font-mono border border-border/60">
                              {email.messageId}
                            </div>
                          </div>
                        </div>
                        
                        {/* 10. BADGES */}
                        <div className="flex flex-wrap items-center gap-2 mt-1">
                          {email.ticketId && (
                            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[#4f78f5]/10 text-[#4f78f5] text-[10px] font-bold uppercase tracking-wider shadow-sm border border-[#4f78f5]/20">
                              Ticket #{email.ticket?.ticketNumber || email.ticketId} Gerado
                            </div>
                          )}
                          
                          {email.status === 'ERROR' && (
                            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-amber-500/10 text-amber-600 text-[10px] font-bold uppercase tracking-wider shadow-sm border border-amber-500/20">
                              Falha no processamento
                            </div>
                          )}
                          
                          {/* 11. RESPOSTAS MANUAIS */}
                          {email.manualReplies && (
                            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-800 text-white dark:bg-slate-700 text-[10px] font-bold uppercase tracking-wider shadow-sm">
                              <PaperPlaneRight weight="fill" /> {Array.isArray(email.manualReplies) ? email.manualReplies.length : 1} Respostas Manuais
                            </div>
                          )}
                        </div>
                      </div>
                      
                      {/* 13. EXCLUSÃO */}
                      <button 
                        onClick={(e) => handleDeleteIndividual(e, email.id)}
                        className="p-2.5 text-muted-foreground/80 hover:bg-red-500/10 hover:text-red-500 rounded-lg transition-colors ml-4 shrink-0 opacity-50 group-hover:opacity-100"
                        title="Excluir e-mail"
                      >
                        <Trash className="w-4 h-4" />
                      </button>
                    </div>
                    
                    {/* 12. ÁREA DE EXPANSÃO (SANFONA) */}
                    {isExpanded && (
                      <div className="bg-muted/30 border-t border-border/40 animate-in slide-in-from-top-2 fade-in duration-200">
                        {/* CABEÇALHO INTERNO */}
                        <div className="p-6 border-b border-border/60 flex flex-col md:flex-row md:justify-between md:items-start gap-4 bg-card">
                          <div>
                            <h2 className="text-[17px] font-bold text-foreground mb-1">{email.subject || "Sem assunto"}</h2>
                            <p className="text-[13px] text-muted-foreground">
                              Ticket aberto via e-mail pelo cliente <span className="font-semibold text-muted-foreground">{email.from}</span> em {new Date(email.processedAt).toLocaleString('pt-BR')}
                            </p>
                          </div>
                          <button 
                            onClick={() => toggleExpand(email.id)}
                            className="px-4 py-1.5 border border-border/60 rounded text-[11px] font-bold uppercase tracking-wider text-muted-foreground hover:bg-muted/30 bg-card shadow-sm transition-colors shrink-0"
                          >
                            FECHAR
                          </button>
                        </div>

                        {replySuccess && (
                          <div className="m-6 p-4 bg-emerald-50 text-emerald-700 rounded-lg flex items-center justify-between border border-emerald-100 text-sm shadow-sm">
                            <div className="flex items-center gap-2 font-medium">
                              <CheckCircle className="w-5 h-5 shrink-0" weight="fill" />
                              <p>{replySuccess}</p>
                            </div>
                            <button onClick={() => setReplySuccess(null)} className="font-bold opacity-70 hover:opacity-100 transition-opacity">✕</button>
                          </div>
                        )}
                        
                        {replyError && (
                          <div className="m-6 p-4 bg-red-500/10 text-red-600 dark:text-red-400 rounded-lg flex items-center gap-2 border border-red-500/20 text-sm shadow-sm font-medium">
                            <WarningCircle className="w-5 h-5 shrink-0" weight="fill" />
                            <p>{replyError}</p>
                          </div>
                        )}

                        {/* EDITOR DE RESPOSTA (MENSAGEM) */}
                        <div className="p-6 bg-muted/30 border-b border-border/60">
                           <h3 className="text-sm font-semibold text-muted-foreground mb-3 flex items-center gap-2">
                             Mensagem
                           </h3>
                           <form onSubmit={(e) => handleSubmitReply(email, e)} className="bg-card border border-border rounded shadow-sm overflow-hidden flex flex-col relative">
                              <div className="flex flex-col md:flex-row border-b border-border/60 bg-muted/30/50 divide-y md:divide-y-0 md:divide-x divide-slate-200">
                                <div className="flex-1 flex items-center px-4 py-2">
                                  <span className="text-[12px] font-bold text-muted-foreground w-16">Para:</span>
                                  <input type="text" readOnly value={email.from || ""} className="flex-1 bg-transparent text-[13px] text-muted-foreground outline-none truncate" />
                                </div>
                                <div className="flex-1 flex items-center px-4 py-2">
                                  <span className="text-[12px] font-bold text-muted-foreground w-24">Cópia (CC):</span>
                                  <input 
                                    type="text" 
                                    value={replyCc} 
                                    onChange={e => setReplyCc(e.target.value)} 
                                    placeholder="email1@exemplo.com, email2@exemplo.com"
                                    className="flex-1 bg-transparent text-[13px] text-muted-foreground outline-none truncate placeholder:text-muted-foreground/80" 
                                  />
                                </div>
                              </div>
                              
                              <div className="flex flex-col bg-card">
                                <textarea 
                                  required
                                  rows={6}
                                  value={replyContent}
                                  onChange={(e) => setReplyContent(e.target.value)}
                                  placeholder="Escreva sua mensagem aqui..."
                                  className="w-full text-sm bg-transparent px-4 pt-4 pb-2 outline-none focus:ring-0 resize-y custom-scrollbar text-muted-foreground leading-relaxed min-h-[120px]"
                                />
                                {signatureHtml && (
                                  <div className="px-4 pb-4">
                                    <div dangerouslySetInnerHTML={{ __html: signatureHtml }} />
                                  </div>
                                )}
                              </div>
                              
                              <div className="bg-muted/30 border-t border-border/60 p-3 flex justify-between items-center">
                                <div className="flex items-center gap-2">
                                  <button
                                    type="button"
                                    onClick={() => setShowSignatureSettings(true)}
                                    className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground hover:text-[#4f78f5] flex items-center gap-1.5 transition-colors bg-card px-2.5 py-1.5 border border-border/60 rounded"
                                  >
                                    <PencilSimple className="w-3.5 h-3.5" /> Assinatura
                                  </button>
                                  <div className="text-[10px] text-muted-foreground/80">
                                    HTML suportado.
                                  </div>
                                </div>
                                <button
                                  type="submit"
                                  disabled={isSending}
                                  className="bg-[#1a56db] text-white px-5 py-2 rounded text-[12px] font-bold tracking-wide hover:bg-[#1e4bb3] transition-colors disabled:opacity-50 shadow-sm"
                                >
                                  {isSending ? "ENVIANDO..." : "ENVIAR MENSAGEM"}
                                </button>
                              </div>
                           </form>
                        </div>

                        {/* LINHA DO TEMPO (HISTÓRICO) */}
                        <div className="p-6 bg-muted/30 space-y-6">
                           {/* 1. Mensagem Original (Sempre no topo) */}
                           <div className="bg-card border border-border/60 rounded shadow-sm">
                             <div className="bg-muted/50/80 px-4 py-3 border-b border-border/60 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2">
                               <div className="flex items-center gap-3">
                                 <div className="w-8 h-8 rounded-full bg-slate-300 text-muted-foreground flex items-center justify-center font-bold text-sm uppercase shrink-0">
                                   {email.from ? email.from.substring(0, 1) : "?"}
                                 </div>
                                 <div>
                                   <div className="text-[13px] font-semibold text-foreground flex items-center gap-2">
                                      {email.from} <span className="bg-slate-200 text-muted-foreground px-1.5 py-0.5 rounded text-[10px] uppercase font-bold tracking-wider">Email</span>
                                   </div>
                                 </div>
                               </div>
                               <div className="text-[12px] text-muted-foreground font-medium sm:text-right">
                                 {new Date(email.processedAt).toLocaleString('pt-BR')}
                               </div>
                             </div>
                             <div className="p-5 text-[14px] text-muted-foreground leading-relaxed custom-scrollbar overflow-x-auto">
                               {email.bodyReceived ? (
                                 <div dangerouslySetInnerHTML={{ __html: email.bodyReceived }} className="prose prose-sm max-w-none break-words" />
                               ) : (
                                 <span className="italic text-muted-foreground/80">Conteúdo não salvo</span>
                               )}
                             </div>
                           </div>

                           {/* 2. Resposta Automática (Se houver e for relevante mostrar na timeline) */}
                           {email.bodySent && (
                             <div className="bg-card border border-border/60 rounded shadow-sm">
                               <div className="bg-muted/50/80 px-4 py-3 border-b border-border/60 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2">
                                 <div className="flex items-center gap-3">
                                   <div className="w-8 h-8 rounded-full bg-[#1a56db]/20 text-[#1a56db] flex items-center justify-center font-bold text-sm uppercase shrink-0">
                                     S
                                   </div>
                                   <div>
                                     <div className="text-[13px] font-semibold text-foreground flex items-center gap-2">
                                        Sistema <span className="bg-[#1a56db]/10 text-[#1a56db] px-1.5 py-0.5 rounded text-[10px] uppercase font-bold tracking-wider">Auto-Resposta</span>
                                     </div>
                                   </div>
                                 </div>
                                 <div className="text-[12px] text-muted-foreground font-medium sm:text-right">
                                   {new Date(email.processedAt).toLocaleString('pt-BR')}
                                 </div>
                               </div>
                               <div className="p-1 h-[250px] relative">
                                 <iframe
                                    srcDoc={email.bodySent}
                                    title="Corpo Enviado"
                                    className="w-full h-full border-none bg-card rounded"
                                  />
                               </div>
                             </div>
                           )}

                           {/* 3. Respostas Manuais (Em ordem) */}
                           {email.manualReplies && (Array.isArray(email.manualReplies) ? email.manualReplies : [email.manualReplies]).map((reply: any, idx: number) => (
                             <div key={idx} className="bg-card border border-border/60 rounded shadow-sm">
                               <div className="bg-muted/50/80 px-4 py-3 border-b border-border/60 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2">
                                 <div className="flex items-center gap-3">
                                   <div className="w-8 h-8 rounded-full bg-slate-300 text-muted-foreground flex items-center justify-center font-bold text-sm uppercase shrink-0">
                                     {reply.adminName ? reply.adminName.substring(0, 1) : "?"}
                                   </div>
                                   <div>
                                     <div className="text-[13px] font-semibold text-foreground flex items-center gap-2">
                                        {reply.adminName || "Suporte"}
                                     </div>
                                   </div>
                                 </div>
                                 <div className="text-[12px] text-muted-foreground font-medium sm:text-right">
                                   {new Date(reply.date).toLocaleString('pt-BR')}
                                 </div>
                               </div>
                               <div className="p-5 text-[14px] text-muted-foreground leading-relaxed whitespace-pre-wrap font-sans overflow-x-auto">
                                 {reply.content?.includes('<') ? (
                                    <div dangerouslySetInnerHTML={{ __html: reply.content.replace(/\n/g, '<br/>') }} className="prose prose-sm max-w-none break-words" />
                                 ) : (
                                    reply.content
                                 )}
                               </div>
                             </div>
                           ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {activeTab === "sent" && <SentEmailsManager />}
      {activeTab === "templates" && <EmailTemplatesManager />}
      
      {showSignatureSettings && (
        <SignatureSettingsModal 
          onClose={() => setShowSignatureSettings(false)}
          onSave={(html) => {
            setSignatureHtml(html);
            toast.success("Assinatura atualizada com sucesso!");
          }}
        />
      )}
    </div>
  );
}
