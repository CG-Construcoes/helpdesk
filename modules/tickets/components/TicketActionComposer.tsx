"use client";

import React, { useState, useEffect } from "react";
import { toast } from "sonner";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { Bold, Italic, Send, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export function TicketActionComposer({ 
  ticket, 
  onActionAdded, 
  onStatusChange 
}: { 
  ticket: any, 
  onActionAdded: () => void,
  onStatusChange: (status: string) => void
}) {
  const [activeTab, setActiveTab] = useState<"PUBLIC" | "INTERNAL">("PUBLIC");
  const [submitting, setSubmitting] = useState(false);
  const [nextStatus, setNextStatus] = useState<string>("KEEP"); // "KEEP" means don't change
  const [solutionText, setSolutionText] = useState("");
  const [signatureHtml, setSignatureHtml] = useState("");
  const [showSignatureSettings, setShowSignatureSettings] = useState(false);
  const [reopening, setReopening] = useState(false);
  const [ccValue, setCcValue] = useState(ticket?.cc || "");
  const [showCc, setShowCc] = useState(!!ticket?.cc);

  useEffect(() => {
    setCcValue(ticket?.cc || "");
    setShowCc(!!ticket?.cc);
  }, [ticket?.id, ticket?.cc]);

  const isClosed = ["RESOLVIDO", "CANCELADO", "CONCLUIDO"].includes(ticket.status);

  useEffect(() => {
    // Busca a assinatura do perfil do usuário no backend
    fetch("/api/profile")
      .then(res => res.json())
      .then(data => {
        if (data.signatureHtml) {
          setSignatureHtml(data.signatureHtml);
        } else {
          // Fallback legacy temporário
          try {
            const savedSig = localStorage.getItem("@helpdesk:signature");
            if (savedSig) {
              const sig = JSON.parse(savedSig);
              setSignatureHtml(sig.html || "");
            }
          } catch (e) {}
        }
      })
      .catch(() => {});
  }, []);

  const editor = useEditor({
    extensions: [StarterKit],
    content: "",
    editorProps: {
      attributes: {
        class: "min-h-[120px] max-h-[300px] overflow-y-auto p-4 focus:outline-none text-sm prose dark:prose-invert max-w-none",
      },
    },
  });

  const handleReopen = async () => {
    setReopening(true);
    try {
      if (ticket.origin === "EMAIL" || ticket.requester?.email) {
        const inReplyTo = ticket.processedEmails?.[ticket.processedEmails.length - 1]?.messageId;
        const payload = {
          to: ticket.requester?.email,
          cc: ticket.cc,
          subject: `Re: ${ticket.problem}`,
          content: "<p>Este chamado foi reaberto.</p>",
          inReplyTo,
          isPublic: true,
          ticketId: ticket.id,
          nextStatus: "ABERTO"
        };
        const res = await fetch(`/api/email/reply`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!res.ok) throw new Error("Erro ao enviar e-mail de reabertura");
      } else {
        const res = await fetch(`/api/tickets/${ticket.id}/comments`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ 
            text: "Chamado reaberto pelo atendente.", 
            isInternal: false,
            nextStatus: "ABERTO"
          }),
        });
        if (!res.ok) throw new Error("Erro ao reabrir");
      }
      toast.success("Chamado reaberto com sucesso!");
      onActionAdded();
    } catch (err: any) {
      toast.error(err.message || "Erro ao reabrir chamado");
    } finally {
      setReopening(false);
    }
  };

  const handleSubmit = async () => {
    if (!editor) return;
    const isSolutionOnly = nextStatus === "RESOLVIDO" && solutionText.trim().length > 0;
    
    if (editor.isEmpty && !isSolutionOnly) return;
    
    setSubmitting(true);
    const contentHtml = editor.getHTML();
    const contentText = editor.getText();

    try {
      if (editor.isEmpty && isSolutionOnly) {
         const res = await fetch(`/api/tickets/${ticket.id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
               status: "RESOLVIDO",
               solutionText: solutionText,
               cc: ccValue || null
            })
         });
         if (!res.ok) throw new Error("Erro ao resolver chamado");
         toast.success("Chamado resolvido com sucesso!");
         editor.commands.setContent("");
         setSolutionText("");
         setNextStatus("KEEP");
         onActionAdded();
         return;
      }

      if (activeTab === "PUBLIC") {
        const finalHtml = signatureHtml ? contentHtml + "<br/><br/>" + signatureHtml : contentHtml;

        // Se CC foi editado, atualiza também no chamado
        if (ccValue !== (ticket.cc || "")) {
          fetch(`/api/tickets/${ticket.id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ cc: ccValue || null }),
          }).catch(console.error);
        }

        // Ação Pública
        if (ticket.origin === "EMAIL" || ticket.requester?.email) {
          // Tentar enviar e-mail se tiver origem de e-mail ou se o solicitante tiver e-mail
          const inReplyTo = ticket.processedEmails?.[ticket.processedEmails.length - 1]?.messageId;
          const payload = {
            to: ticket.requester?.email,
            cc: ccValue || undefined,
            subject: `Re: ${ticket.problem}`,
            content: finalHtml,
            inReplyTo,
            isPublic: true,
            ticketId: ticket.id,
            nextStatus: nextStatus !== "KEEP" && nextStatus !== ticket.status ? nextStatus : undefined,
            solutionHtml: (nextStatus === "RESOLVIDO" && solutionText.trim().length > 0) ? solutionText.replace(/\n/g, '<br/>') : undefined
          };

          const res = await fetch(`/api/email/reply`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });

          if (!res.ok) throw new Error("Erro ao enviar e-mail da Ação Pública");
        } else {
          // Se for ação pública mas não houver como enviar e-mail, salva apenas como comentário público
          const res = await fetch(`/api/tickets/${ticket.id}/comments`, {
            method: "POST",
            body: JSON.stringify({ 
              text: finalHtml, 
              isInternal: false,
              nextStatus: nextStatus !== "KEEP" && nextStatus !== ticket.status ? nextStatus : undefined,
              solutionHtml: (nextStatus === "RESOLVIDO" && solutionText.trim().length > 0) ? solutionText.replace(/\n/g, '<br/>') : undefined,
              signatureHtml: signatureHtml || undefined
            }),
          });
          if (!res.ok) throw new Error("Erro ao salvar ação pública como comentário");
        }
      } else {
        // Ação Interna
        const res = await fetch(`/api/tickets/${ticket.id}/comments`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ 
            text: contentHtml, 
            isInternal: true,
            nextStatus: nextStatus !== "KEEP" && nextStatus !== ticket.status ? nextStatus : undefined
          }),
        });
        if (!res.ok) throw new Error("Erro ao salvar ação interna");
      }


      toast.success("Ação adicionada com sucesso!");
      editor.commands.setContent("");
      setSolutionText("");
      setNextStatus("KEEP");
      onActionAdded();
    } catch (err: any) {
      toast.error(err.message || "Erro ao adicionar ação");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="rounded-xl border bg-card text-card-foreground shadow-sm overflow-hidden relative">
      {isClosed && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/60 backdrop-blur-[2px]">
          <Button onClick={handleReopen} disabled={reopening} size="lg" className="shadow-lg font-semibold tracking-wide">
            {reopening ? (
              <>
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                Reabrindo...
              </>
            ) : (
              "Reabrir Ticket"
            )}
          </Button>
        </div>
      )}

      {/* TABS */}
      <div className="flex border-b border-border/50 bg-muted/20">
        <button
          className={`flex-1 py-3 px-4 text-sm font-semibold transition-colors border-b-2 ${
            activeTab === "PUBLIC" ? "border-primary text-primary bg-background" : "border-transparent text-muted-foreground hover:bg-muted/50 hover:text-foreground"
          }`}
          onClick={() => setActiveTab("PUBLIC")}
        >
          Ação Pública
        </button>
        <button
          className={`flex-1 py-3 px-4 text-sm font-semibold transition-colors border-b-2 ${
            activeTab === "INTERNAL" ? "border-warning text-warning bg-warning/5" : "border-transparent text-muted-foreground hover:bg-muted/50 hover:text-foreground"
          }`}
          onClick={() => setActiveTab("INTERNAL")}
        >
          Ação Interna
        </button>
      </div>

      <div className={activeTab === "INTERNAL" ? "bg-warning/5" : "bg-background"}>
        {/* TOOLBAR */}
        <div className="flex items-center gap-1.5 border-b border-border/50 p-2 bg-muted/10">
          <Button 
            type="button"
            variant="ghost" 
            size="icon" 
            className={`h-8 w-8 ${editor?.isActive("bold") ? "bg-muted text-foreground" : "text-muted-foreground"}`}
            onClick={() => editor?.chain().focus().toggleBold().run()}
            title="Negrito"
          >
            <Bold className="h-4 w-4" />
          </Button>
          <Button 
            type="button"
            variant="ghost" 
            size="icon" 
            className={`h-8 w-8 ${editor?.isActive("italic") ? "bg-muted text-foreground" : "text-muted-foreground"}`}
            onClick={() => editor?.chain().focus().toggleItalic().run()}
            title="Itálico"
          >
            <Italic className="h-4 w-4" />
          </Button>
          
          <div className="w-px h-4 bg-border mx-1" />

          {activeTab === "PUBLIC" && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className={`h-8 px-2.5 text-xs font-semibold gap-1.5 transition-colors ${
                showCc || ccValue.trim()
                  ? "bg-primary/10 text-primary hover:bg-primary/20" 
                  : "text-muted-foreground hover:text-foreground"
              }`}
              onClick={() => setShowCc(!showCc)}
              title="Adicionar / Editar destinatários em cópia (Cc)"
            >
              <span className="font-bold">Cc</span>
              {ccValue.trim() ? (
                <span className="bg-primary text-primary-foreground rounded-full min-w-4 h-4 px-1 text-[10px] flex items-center justify-center font-bold">
                  {ccValue.split(/[,;]+/).map((e: string) => e.trim()).filter(Boolean).length}
                </span>
              ) : null}
            </Button>
          )}
        </div>

        {/* CC INPUT ROW */}
        {activeTab === "PUBLIC" && showCc && (
          <div className="flex items-center gap-2 px-3 py-2 bg-muted/25 border-b border-border/40 text-xs animate-in fade-in duration-150">
            <span className="font-bold text-muted-foreground uppercase text-[11px] shrink-0">
              Cc:
            </span>
            <input
              type="text"
              placeholder="Digite os e-mails separados por vírgula (ex: email1@empresa.com, email2@empresa.com)"
              value={ccValue}
              onChange={(e) => setCcValue(e.target.value)}
              className="w-full bg-transparent outline-none text-foreground placeholder:text-muted-foreground/60 text-xs py-0.5"
            />
            {ccValue && (
              <button
                type="button"
                onClick={() => setCcValue("")}
                className="text-muted-foreground hover:text-foreground text-xs px-1.5 py-0.5 rounded hover:bg-muted/50"
                title="Limpar Cc"
              >
                ✕
              </button>
            )}
          </div>
        )}

        {/* EDITOR */}
        <div className="cursor-text" onClick={() => editor?.commands.focus()}>
          <EditorContent editor={editor} />
        </div>

        {/* SIGNATURE PREVIEW */}
        {(activeTab === "PUBLIC" && signatureHtml) && (
          <div className="px-4 pb-4">
            <div className="text-[13px] text-muted-foreground pt-4 mt-2 border-t border-border/50" dangerouslySetInnerHTML={{ __html: signatureHtml.replace(/<img /g, '<img referrerpolicy="no-referrer" ') }} />
          </div>
        )}

        {/* SOLUTION TEXTAREA */}
        {nextStatus === "RESOLVIDO" && (
          <div className="p-4 border-t border-border/50 bg-background/50">
            <label className="block text-sm font-semibold mb-2 flex items-center gap-2">
               <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-primary"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
               Solução Oficial do Chamado
            </label>
            <p className="text-xs text-muted-foreground mb-3">Esta solução será registrada e enviada no e-mail de encerramento do chamado para o solicitante.</p>
            <textarea
              className="w-full min-h-[100px] p-3 text-sm rounded-md border border-input bg-background focus:outline-none focus:ring-1 focus:ring-primary shadow-sm"
              placeholder="Descreva detalhadamente a solução aplicada..."
              value={solutionText}
              onChange={(e) => setSolutionText(e.target.value)}
            />
          </div>
        )}

        {/* FOOTER ACTIONS */}
        <div className="flex items-center justify-between p-3 border-t border-border/50 bg-muted/10">
          <div className="flex items-center gap-4">
            <p className="text-xs text-muted-foreground">
              {activeTab === "PUBLIC" ? "Esta mensagem será enviada ao solicitante." : "Esta nota ficará oculta para o solicitante."}
            </p>
            {activeTab === "PUBLIC" && (
              <p className="text-[10px] text-muted-foreground/60 italic">Sua assinatura será adicionada automaticamente. Edite em "Meu Perfil".</p>
            )}
          </div>
          
          <div className="flex items-center">
            <Select value={nextStatus} onValueChange={(val) => val && setNextStatus(val)}>
              <SelectTrigger className={`h-9 w-48 rounded-r-none focus:ring-0 focus:ring-offset-0 ${
                nextStatus === "KEEP" ? "text-muted-foreground" :
                nextStatus === "ABERTO" ? "text-amber-600 font-medium" :
                nextStatus === "EM_ATENDIMENTO" ? "text-indigo-600 font-medium" :
                nextStatus === "AGUARDANDO_USUARIO" ? "text-blue-600 font-medium" :
                nextStatus === "AGUARDANDO_TERCEIROS" ? "text-orange-600 font-medium" :
                nextStatus === "RESOLVIDO" ? "text-emerald-600 font-medium" : ""
              }`}>
                <SelectValue placeholder="Status">
                  {nextStatus === "KEEP" && "Manter status atual"}
                  {nextStatus === "ABERTO" && "Aberto"}
                  {nextStatus === "EM_ATENDIMENTO" && "Em Atendimento"}
                  {nextStatus === "AGUARDANDO_USUARIO" && "Aguardando Usuário"}
                  {nextStatus === "AGUARDANDO_TERCEIROS" && "Aguardando Terceiros"}
                  {nextStatus === "RESOLVIDO" && "Resolvido"}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="KEEP">Manter status atual</SelectItem>
                <SelectItem value="ABERTO" className="text-amber-600 font-medium focus:text-amber-600 focus:bg-amber-50 dark:focus:bg-amber-500/10">Aberto</SelectItem>
                <SelectItem value="EM_ATENDIMENTO" className="text-indigo-600 font-medium focus:text-indigo-600 focus:bg-indigo-50 dark:focus:bg-indigo-500/10">Em Atendimento</SelectItem>
                <SelectItem value="AGUARDANDO_USUARIO" className="text-blue-600 font-medium focus:text-blue-600 focus:bg-blue-50 dark:focus:bg-blue-500/10">Aguardando Usuário</SelectItem>
                <SelectItem value="AGUARDANDO_TERCEIROS" className="text-orange-600 font-medium focus:text-orange-600 focus:bg-orange-50 dark:focus:bg-orange-500/10">Aguardando Terceiros</SelectItem>
                <SelectItem value="RESOLVIDO" className="text-emerald-600 font-medium focus:text-emerald-600 focus:bg-emerald-50 dark:focus:bg-emerald-500/10">Resolvido</SelectItem>
              </SelectContent>
            </Select>
            <Button 
              onClick={handleSubmit} 
              disabled={submitting}
              className={`rounded-l-none shadow-sm ${activeTab === "INTERNAL" ? "bg-warning hover:bg-warning/90 text-warning-foreground" : ""}`}
            >
              {submitting ? "Enviando..." : (
                <>
                  <Send className="h-4 w-4 mr-2" />
                  Adicionar ação
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
      
    </div>
  );
}
