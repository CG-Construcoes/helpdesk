"use client";

import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Clock,
  History,
  MessageSquare,
  FileText,
  Send,
  CheckCircle2,
  AlertTriangle,
  Search,
PauseCircle, PlayCircle} from "lucide-react";
import { getTicketMonthYear, formatTicketNumber } from "@/services/ticket/ticket-utils";
import { calculateBusinessMinutes } from "@/lib/business-hours";
import { RequesterHistoryCard } from "./RequesterHistoryCard";
import { Combobox } from "@/components/common/Combobox";
import SignatureSettingsModal from "../emails/SignatureSettingsModal";
import { Pencil } from "lucide-react";

export interface TicketModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ticketId?: string | null;
  parentId?: string | null;
  sectors: Array<{ id: string; name: string }>;
  services: Array<{ id: string; name: string; category?: string | null }>;
  technicians: Array<{ id: string; name: string; email: string }>;
  onSaved: () => void;
  initialStatus?: string;
}

export function TicketModal({
  open,
  onOpenChange,
  ticketId,
  sectors,
  services,
  technicians,
  onSaved,
  initialStatus,
  parentId,
}: TicketModalProps) {
  const isEditing = Boolean(ticketId);

  const [activeTab, setActiveTab] = useState<"INFO" | "TIMELINE" | "COMMENTS" | "ATTACHMENTS">("INFO");
  const [attachments, setAttachments] = useState<any[]>([]);
  const [uploadingAttachment, setUploadingAttachment] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Form states
  const [requesterName, setRequesterName] = useState("");
  const [requesterEmail, setRequesterEmail] = useState("");
  const [requesterId, setRequesterId] = useState<string | null>(null);
  const [sectorId, setSectorId] = useState("");
  const [serviceId, setServiceId] = useState("");
  const [technicianId, setTechnicianId] = useState("");
  const [problem, setProblem] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState("ABERTO");
  const [pauseReason, setPauseReason] = useState("");
  const [pauseNote, setPauseNote] = useState("");
  const [pauses, setPauses] = useState<any[]>([]);
  const [dueDate, setDueDate] = useState<string | null>(null);
  const [origin, setOrigin] = useState("MANUAL");
  const [priority, setPriority] = useState("MEDIA");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [observations, setObservations] = useState("");
  const [solutionText, setSolutionText] = useState("");
  const [totalTimeMinutes, setTotalTimeMinutes] = useState<number | null>(null);
  const [sendEmail, setSendEmail] = useState(true);

  // Autocomplete Solicitante
  const [suggestions, setSuggestions] = useState<Array<{ id: string; name: string; email: string }>>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isLoadingRequesters, setIsLoadingRequesters] = useState(false);
  const [hasLoadedRequesters, setHasLoadedRequesters] = useState(false);

  // Timeline & Comentários
  const [historyEvents, setHistoryEvents] = useState<any[]>([]);
  const [comments, setComments] = useState<any[]>([]);
  const [newComment, setNewComment] = useState("");
  const [addingComment, setAddingComment] = useState(false);
  const [isInternalComment, setIsInternalComment] = useState(false);
  
  const [ccAddresses, setCcAddresses] = useState<string | null>(null);
  const [replyAll, setReplyAll] = useState(true);
  const [signatureHtml, setSignatureHtml] = useState("");
  const [showSignatureSettings, setShowSignatureSettings] = useState(false);

  // Load ticket data if editing
  useEffect(() => {
    if (!open) {
      // Reset defaults when closing
      setActiveTab("INFO");
      setRequesterName("");
      setRequesterEmail("");
      setRequesterId(null);
      setSectorId("");
      setServiceId("");
      setTechnicianId("");
      setProblem("");
      setDescription("");
      setStatus("ABERTO");
      setOrigin("MANUAL");
      setPriority("MEDIA");
      setStartTime(new Date().toISOString().slice(0, 16));
      setEndTime("");
      setObservations("");
      setSolutionText("");
      setTotalTimeMinutes(null);
      setSendEmail(true);
      setSuggestions([]);
      setShowSuggestions(false);
      setHasLoadedRequesters(false);
      setHistoryEvents([]);
      setComments([]);
      setCcAddresses(null);
      return;
    }

    const toLocalDatetimeString = (dateVal: string | Date | null) => {
      if (!dateVal) return "";
      const d = new Date(dateVal);
      const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
      return local.toISOString().slice(0, 16);
    };

    if (ticketId) {
      fetchTicketDetails(ticketId, toLocalDatetimeString);
    } else {
      setStartTime(toLocalDatetimeString(new Date()));
    }

    // Load signature
    try {
      const savedSig = localStorage.getItem("@helpdesk:signature");
      if (savedSig) {
        const sig = JSON.parse(savedSig);
        setSignatureHtml(sig.html || "");
      }
    } catch (e) {}

  }, [open, ticketId]);

  async function fetchTicketDetails(id: string, toLocalDatetimeString: (d: any) => string) {
    setLoading(true);
    try {
      const res = await fetch(`/api/tickets/${id}`);
      if (res.ok) {
        const data = await res.json();
        setRequesterName(data.requester?.name || "");
        setRequesterEmail(data.requester?.email || "");
        setRequesterId(data.requester?.id || null);
        setSectorId(data.sectorId || "");
        setServiceId(data.serviceId || "");
        setTechnicianId(data.technicianId || "");
        setProblem(data.problem || "");
        setDescription(data.description || "");
        setStatus(initialStatus || data.status || "ABERTO");
        setOrigin(data.origin || "MANUAL");
        setPriority(data.priority || "MEDIA");
        setStartTime(toLocalDatetimeString(data.startTime));
        setEndTime(toLocalDatetimeString(data.endTime));
        setObservations(data.observations || "");
        setTotalTimeMinutes(data.totalTimeMinutes || null);
        setPauses(data.pauses || []);
        setDueDate(data.dueDate || null);
        setCcAddresses(data.cc || null);
        setHistoryEvents(data.history || []);
        setComments(data.comments || []);
        
        const attRes = await fetch(`/api/tickets/${id}/attachments`);
        if (attRes.ok) {
           setAttachments(await attRes.json());
        }
      }
    } catch (err) {
      console.error("Erro ao carregar chamado:", err);
    } finally {
      setLoading(false);
    }
  }

  // Handle requester autocomplete
  async function handleLoadAllRequesters() {
    if (hasLoadedRequesters) return;
    setIsLoadingRequesters(true);
    try {
      const res = await fetch(`/api/requesters/suggest?q=`);
      if (res.ok) {
        const data = await res.json();
        setSuggestions(data.suggestions || []);
        setHasLoadedRequesters(true);
      }
    } catch (err) {
      console.error("Erro ao buscar solicitantes:", err);
    } finally {
      setIsLoadingRequesters(false);
    }
  }

  async function handleRequesterChange(val: string) {
    setRequesterName(val);
    if (requesterId && val !== requesterName) {
      setRequesterId(null); // Desvincula se alterou
    }
  }

  function handleSelectSuggestion(s: { id: string; name: string; email: string }) {
    setRequesterId(s.id);
    setRequesterName(s.name);
    setRequesterEmail(s.email);
    setShowSuggestions(false);
  }

  // Format dynamic calculated time
  function getFormattedDuration(): string {
    let sTime = startTime ? new Date(startTime) : new Date();
    let eTime = endTime ? new Date(endTime) : new Date();
    if (status === "RESOLVIDO" && !endTime) {
      eTime = new Date();
    }
    const mins = calculateBusinessMinutes(sTime, eTime);
    if (mins === 0) return "< 1 min";
    if (mins < 60) return `${mins} min`;
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    if (m === 0) return `${h} h`;
    return `${h} h ${m} min`;
  }

  // Save ticket
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!requesterName || !sectorId || !serviceId || !problem) {
      alert("Por favor, preencha Solicitante, Setor, Serviço e Problema.");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        requesterName,
        requesterEmail,
        requesterId,
        sectorId,
        serviceId,
        technicianId: technicianId || null,
        parentId: parentId || undefined,
        problem,
        description,
        status,
        origin,
        priority,
        startTime: startTime ? new Date(startTime).toISOString() : null,
        endTime: endTime ? new Date(endTime).toISOString() : null,
        observations,
        solutionText: status === "RESOLVIDO" ? solutionText : undefined,
        pauseReason: status === "AGUARDANDO_TERCEIROS" ? pauseReason : undefined,
        pauseNote: status === "AGUARDANDO_TERCEIROS" ? pauseNote : undefined,
        sendEmail, // new field
      };

      const url = isEditing ? `/api/tickets/${ticketId}` : "/api/tickets";
      const method = isEditing ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || "Erro ao salvar chamado");
      }

      onSaved();
      onOpenChange(false);
    } catch (err: any) {
      alert(err.message || "Erro ao salvar chamado");
    } finally {
      setSaving(false);
    }
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    if (!e.target.files || !e.target.files.length || !ticketId) return;
    const file = e.target.files[0];
    const allowed = ["image/png", "image/jpeg", "image/jpg", "application/pdf", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"];
    if (!allowed.includes(file.type) && !file.name.match(/\.(png|jpg|jpeg|pdf|docx|xlsx)$/i)) {
       alert("Formato não permitido. Envie PNG, JPG, PDF, DOCX ou XLSX.");
       return;
    }
    
    setUploadingAttachment(true);
    const fd = new FormData();
    fd.append("file", file);

    try {
      const res = await fetch(`/api/tickets/${ticketId}/attachments`, {
        method: "POST",
        body: fd,
      });
      if (res.ok) {
        const att = await res.json();
        setAttachments([att, ...attachments]);
      } else {
        const err = await res.json();
        alert(err.error || "Erro ao fazer upload");
      }
    } catch (err) {
       console.error("Upload erro:", err);
    } finally {
       setUploadingAttachment(false);
       e.target.value = ""; // clear input
    }
  }

  // Add internal comment
  async function handleAddComment() {
    if (!newComment.trim() || !ticketId) return;
    setAddingComment(true);
    try {
      const res = await fetch(`/api/tickets/${ticketId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          text: newComment,
          isInternal: isInternalComment,
          replyAll: !isInternalComment && replyAll ? true : false,
          signatureHtml: (!isInternalComment && signatureHtml) ? signatureHtml : undefined
        }),
      });
      if (res.ok) {
        const created = await res.json();
        setComments((prev) => [created, ...prev]);
        setNewComment("");
      }
    } catch (err) {
      console.error("Erro ao adicionar comentário:", err);
    } finally {
      setAddingComment(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[1100px] h-[90vh] max-h-[900px] p-0 overflow-hidden bg-background border-border/60 shadow-2xl flex flex-col md:flex-row [&>button:last-child]:top-4 [&>button:last-child]:right-4">
        {loading ? (
          <div className="w-full flex items-center justify-center p-12 text-sm text-muted-foreground">
            Carregando detalhes do chamado...
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col md:flex-row w-full h-full overflow-hidden">
            {/* COLUNA ESQUERDA - SIDEBAR DE PROPRIEDADES */}
            <div className="w-full md:w-[32%] bg-muted/10 border-r border-border/40 p-5 overflow-y-auto flex flex-col gap-4">
              <div className="mb-2">
                <DialogTitle className="flex items-center gap-2 text-lg font-bold">
                  <FileText className="w-5 h-5 text-primary" />
                  {isEditing ? "Editar Chamado" : "Novo Chamado"}
                </DialogTitle>
                <DialogDescription className="text-xs mt-1">
                  {isEditing ? "Atualize as informações operacionais." : "Preencha as propriedades."}
                </DialogDescription>
              </div>

              {/* Solicitante */}
              <div>
                <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground block mb-1.5">
                  Solicitante *
                </label>
                <Combobox
                  options={suggestions.map((s) => ({
                    id: s.id || s.name,
                    name: s.name,
                    subtitle: s.email,
                  }))}
                  value={requesterId || requesterName}
                  onChange={(val, item) => {
                    if (item) {
                      handleSelectSuggestion({
                        id: item.id,
                        name: item.name,
                        email: item.subtitle || "",
                      });
                    } else {
                      setRequesterName("");
                      setRequesterId(null);
                    }
                  }}
                  onSearchChange={(query) => {
                    setRequesterName(query);
                    handleRequesterChange(query);
                  }}
                  placeholder={requesterName || "Buscar ou criar..."}
                  searchPlaceholder="Digite nome ou e-mail..."
                  allowCreate={true}
                  onCreate={(typedName) => {
                    setRequesterName(typedName);
                    setRequesterId(null);
                  }}
                  createLabelPrefix="+ Criar"
                  isLoading={isLoadingRequesters}
                  onOpen={handleLoadAllRequesters}
                />
                <div className="mt-3">
                  <RequesterHistoryCard
                    requesterId={requesterId}
                    requesterName={requesterName}
                  />
                </div>
              </div>

              {/* Setor */}
              <div>
                <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground block mb-1.5">
                  Setor *
                </label>
                <Combobox
                  options={sectors.map((s) => ({
                    id: s.id,
                    name: s.name,
                  }))}
                  value={sectorId}
                  onChange={(val) => setSectorId(val || "")}
                  placeholder="Selecione o Setor..."
                  searchPlaceholder="Pesquisar setor..."
                />
              </div>

              {/* Serviço */}
              <div>
                <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground block mb-1.5">
                  Serviço (Catálogo) *
                </label>
                <Combobox
                  options={services.map((sv) => ({
                    id: sv.id,
                    name: sv.name,
                    badge: sv.category || "TI",
                  }))}
                  value={serviceId}
                  onChange={(val) => setServiceId(val || "")}
                  placeholder="Selecione o Serviço..."
                  searchPlaceholder="Pesquisar serviço..."
                />
              </div>

              {/* Status, Prioridade, Origem */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground block mb-1.5">
                    Status
                  </label>
                  <select
                    className="w-full h-9 px-2 text-[13px] rounded-md border border-input bg-background focus:bg-background outline-none focus:ring-2 focus:ring-primary/50 transition-all"
                    value={status}
                    onChange={(e) => setStatus(e.target.value)}
                  >
                    <option value="ABERTO">Aberto</option>
                    <option value="EM_ATENDIMENTO">Em Atend.</option>
                    <option value="AGUARDANDO_TERCEIROS">Aguard. Terceiros</option>
                    <option value="AGUARDANDO_USUARIO">Aguard. Usuário</option>
                    <option value="RESOLVIDO">Resolvido</option>
                    <option value="CANCELADO">Cancelado</option>
                  </select>
                </div>
                <div>
                  <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground block mb-1.5">
                    Prioridade
                  </label>
                  <select
                    className="w-full h-9 px-2 text-[13px] rounded-md border border-input bg-background focus:bg-background outline-none focus:ring-2 focus:ring-primary/50 transition-all"
                    value={priority}
                    onChange={(e) => setPriority(e.target.value)}
                  >
                    <option value="BAIXA">Baixa</option>
                    <option value="MEDIA">Média</option>
                    <option value="ALTA">Alta</option>
                    <option value="CRITICA">Crítica</option>
                  </select>
                </div>
                <div className="col-span-2">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground block mb-1.5">
                    Origem
                  </label>
                  <select
                    className="w-full h-9 px-2 text-[13px] rounded-md border border-input bg-background focus:bg-background outline-none focus:ring-2 focus:ring-primary/50 transition-all"
                    value={origin}
                    onChange={(e) => setOrigin(e.target.value)}
                  >
                    <option value="MANUAL">Manual</option>
                    <option value="WHATSAPP">WhatsApp</option>
                    <option value="EMAIL">E-mail</option>
                  </select>
                </div>
              </div>

              {/* Técnico */}
              <div>
                <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground block mb-1.5">
                  Técnico Responsável
                </label>
                <Combobox
                  options={technicians.map((t) => ({
                    id: t.id,
                    name: t.name,
                    subtitle: t.email,
                  }))}
                  value={technicianId}
                  onChange={(val) => setTechnicianId(val || "")}
                  placeholder="(Fila Geral)"
                  searchPlaceholder="Pesquisar técnico..."
                />
              </div>

              {/* Opção de Enviar E-mail (Apenas na criação, mas deixaremos visível para clareza se desejar. O back-end só envia na criação) */}
              {!isEditing && (
                <div className="flex items-center justify-between p-3 border border-border/40 bg-muted/10 rounded-xl mt-2">
                  <div className="flex flex-col">
                    <span className="text-[12px] font-bold text-foreground">Enviar e-mail para o cliente</span>
                    <span className="text-[10px] text-muted-foreground">Notificar sobre a abertura do chamado.</span>
                  </div>
                  <Switch
                    checked={sendEmail}
                    onCheckedChange={setSendEmail}
                    className="data-[state=checked]:bg-primary"
                  />
                </div>
              )}

              {/* Tempos */}
              <div className="bg-background border border-border/60 shadow-sm rounded-xl p-4 space-y-4 mt-auto">
                <div className="grid grid-cols-1 gap-4">
                  <div>
                    <label className="text-[11px] font-bold uppercase text-muted-foreground block mb-1.5">
                      Início
                    </label>
                    <input
                      type="datetime-local"
                      value={startTime ? startTime.substring(0, 16) : ''}
                      onChange={(e) => setStartTime(e.target.value)}
                      className="w-full bg-transparent border-b-2 border-input/50 text-[13px] outline-none focus:border-primary pb-1.5 transition-colors"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-bold uppercase text-muted-foreground block mb-1.5">
                      Fim
                    </label>
                    <input
                      type="datetime-local"
                      value={endTime ? endTime.substring(0, 16) : ''}
                      onChange={(e) => setEndTime(e.target.value)}
                      className="w-full bg-transparent border-b-2 border-input/50 text-[13px] outline-none focus:border-primary pb-1.5 transition-colors"
                    />
                  </div>
                </div>
                <div className="flex items-center justify-between pt-3 border-t border-border/40">
                  <span className="text-[11px] font-bold uppercase text-muted-foreground">Tempo Total</span>
                  <span className="text-lg font-bold font-mono text-primary">{getFormattedDuration()}</span>
                </div>
              </div>
            </div>

            {/* COLUNA DIREITA - MAIN AREA */}
            <div className="w-full md:w-[68%] flex flex-col h-full bg-background relative">
              {/* Header Tabs if Editing */}
              {isEditing && (
                <div className="flex items-center gap-1 border-b border-border/40 p-4 bg-muted/5 shrink-0">
                  <Button
                    type="button"
                    variant={activeTab === "INFO" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setActiveTab("INFO")}
                    className="text-[11px] h-7"
                  >
                    Detalhes do Chamado
                  </Button>
                  <Button
                    type="button"
                    variant={activeTab === "TIMELINE" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setActiveTab("TIMELINE")}
                    className="text-[11px] h-7"
                  >
                    <History className="w-3.5 h-3.5 mr-1" /> Timeline
                    {historyEvents.length > 0 && <span className="ml-1 opacity-70">({historyEvents.length})</span>}
                  </Button>
                  <Button
                    type="button"
                    variant={activeTab === "COMMENTS" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setActiveTab("COMMENTS")}
                    className="text-[11px] h-7"
                  >
                    <MessageSquare className="w-3.5 h-3.5 mr-1" /> Notas Internas
                    {comments.length > 0 && <span className="ml-1 opacity-70">({comments.length})</span>}
                  </Button>
                  <Button
                    type="button"
                    variant={activeTab === "ATTACHMENTS" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setActiveTab("ATTACHMENTS")}
                    className="text-[11px] h-7"
                  >
                    <FileText className="w-3.5 h-3.5 mr-1" /> Anexos
                    {attachments.length > 0 && <span className="ml-1 opacity-70">({attachments.length})</span>}
                  </Button>
                </div>
              )}

              <div className="flex-1 overflow-y-auto p-6 space-y-6">
                {activeTab === "INFO" && (
                  <div className="flex flex-col h-full">
                    {/* Assunto grande */}
                    <div className="shrink-0">
                      <Input
                        placeholder="Assunto do ticket (Problema principal)..."
                        value={problem}
                        onChange={(e) => setProblem(e.target.value)}
                        className="text-2xl font-bold border-0 border-b-2 border-transparent hover:border-border focus-visible:border-primary focus-visible:ring-0 rounded-none px-0 h-auto py-2 placeholder:text-muted-foreground/40 shadow-none"
                        required
                      />
                    </div>

                    {/* Descrição Detalhada simulando "Ação" */}
                    <div className="flex-1 mt-6 flex flex-col border border-border/60 rounded-xl overflow-hidden focus-within:ring-1 focus-within:ring-primary/50 transition-all shadow-sm bg-background">
                      <div className="bg-primary/5 px-4 py-2 border-b border-border/40 flex items-center justify-between">
                        <span className="text-[11px] font-bold text-primary uppercase tracking-wider flex items-center gap-1.5">
                          <MessageSquare className="w-3.5 h-3.5" /> Descrição Completa do Chamado
                        </span>
                      </div>
                      <textarea
                        placeholder="Descreva todos os detalhes do chamado, passos para reproduzir, ou a mensagem inicial do usuário..."
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        className="flex-1 w-full min-h-[200px] bg-transparent p-4 text-[13px] outline-none resize-none leading-relaxed"
                      />
                    </div>

                    {/* Solução se resolvido */}
                    {status === "RESOLVIDO" && (
                      <div className="mt-4 p-4 border border-emerald-200/50 bg-emerald-50/50 rounded-xl shrink-0">
                        <Label className="text-[11px] font-bold uppercase tracking-wider text-emerald-600 mb-2 block">
                          Solução / Resolução (Enviada ao cliente)
                        </Label>
                        <Textarea
                          placeholder="Descreva o que foi feito para solucionar este chamado..."
                          value={solutionText}
                          onChange={(e) => setSolutionText(e.target.value)}
                          className="min-h-[100px] border-emerald-200/50 focus-visible:ring-emerald-500/50 bg-white/50 text-[13px]"
                        />
                      </div>
                    )}

                    
                    {/* PAUSE REASON AND SLA PANEL */}
                    {["AGUARDANDO_USUARIO", "AGUARDANDO_TERCEIROS", "AGUARDANDO_PECA", "AGENDADO"].includes(status) && (
                      <div className="mt-4 p-4 rounded-xl border border-amber-200/60 dark:border-amber-900/30 bg-amber-50/50 dark:bg-amber-950/10 space-y-4 shrink-0">
                        <div className="flex items-center justify-between">
                           <span className="text-xs font-semibold uppercase tracking-wider text-amber-900 dark:text-amber-500 flex items-center gap-1.5">
                             <PauseCircle className="w-3.5 h-3.5" />
                             SLA Pausado
                           </span>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <label className="text-[11px] font-bold text-amber-900/70 dark:text-amber-500/70 uppercase tracking-wider mb-1.5 block">
                              Motivo da Pausa *
                            </label>
                            <select
                              value={pauseReason}
                              onChange={(e) => setPauseReason(e.target.value)}
                              className="flex h-9 w-full rounded-md border border-amber-200 dark:border-amber-900/30 bg-white dark:bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-amber-500"
                              required={["AGUARDANDO_USUARIO", "AGUARDANDO_TERCEIROS", "AGUARDANDO_PECA", "AGENDADO"].includes(status)}
                            >
                              <option value="">Selecione um motivo...</option>
                              <option value="Aguardando fornecedor">Aguardando fornecedor</option>
                              <option value="Aguardando suporte externo">Aguardando suporte externo</option>
                              <option value="Aguardando aprovação">Aguardando aprovação</option>
                              <option value="Aguardando usuário externo">Aguardando usuário externo</option>
                              <option value="Outro">Outro</option>
                            </select>
                          </div>
                          <div>
                            <label className="text-[11px] font-bold text-amber-900/70 dark:text-amber-500/70 uppercase tracking-wider mb-1.5 block">
                              Observação (Opcional)
                            </label>
                            <input 
                              placeholder="Detalhes adicionais..."
                              value={pauseNote}
                              onChange={(e) => setPauseNote(e.target.value)}
                              className="flex h-9 w-full rounded-md border border-amber-200 dark:border-amber-900/30 bg-white dark:bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-amber-500"
                            />
                          </div>
                        </div>
                      </div>
                    )}

                    {isEditing && (
                      <div className="mt-4 p-4 rounded-xl border border-border/40 bg-muted/10 shrink-0">
                        <div className="flex items-center justify-between mb-3">
                           <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                             <Clock className="w-3.5 h-3.5" />
                             SLA & Tempo
                           </span>
                           {["AGUARDANDO_USUARIO", "AGUARDANDO_TERCEIROS", "AGUARDANDO_PECA", "AGENDADO"].includes(status) ? (
                             <Badge variant="outline" className="bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-500 font-semibold text-[10px]">
                               <PauseCircle className="w-3 h-3 mr-1" /> SLA PAUSADO
                             </Badge>
                           ) : (
                             <Badge variant="outline" className="text-[10px] bg-background">
                               SLA ATIVO
                             </Badge>
                           )}
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                           <div>
                             <p className="text-[10px] text-muted-foreground uppercase">Tempo Total (Elapsed)</p>
                             <p className="text-sm font-medium">{getFormattedDuration()}</p>
                           </div>
                           <div>
                             <p className="text-[10px] text-muted-foreground uppercase">Em Espera (Pausas)</p>
                             <p className="text-sm font-medium">
                                {(() => {
                                  if (!pauses || pauses.length === 0) return "0 min";
                                  const mins = pauses.reduce((acc, p) => {
                                    if (p.endTime) return acc + (p.duration || 0);
                                    return acc + Math.floor((Date.now() - new Date(p.startTime).getTime()) / 60000);
                                  }, 0);
                                  const h = Math.floor(mins / 60);
                                  const m = mins % 60;
                                  return h > 0 ? `${h}h ${m}m` : `${m} min`;
                                })()}
                             </p>
                           </div>
                           <div>
                             <p className="text-[10px] text-muted-foreground uppercase">SLA Efetivo</p>
                             <p className="text-sm font-medium">
                               {(() => {
                                  const s = startTime ? new Date(startTime).getTime() : Date.now();
                                  const e = endTime ? new Date(endTime).getTime() : Date.now();
                                  const elapsedMins = Math.floor((e - s) / 60000);
                                  const pauseMins = pauses?.reduce((acc, p) => acc + (p.endTime ? (p.duration || 0) : Math.floor((Date.now() - new Date(p.startTime).getTime()) / 60000)), 0) || 0;
                                  const effective = Math.max(0, elapsedMins - pauseMins);
                                  const h = Math.floor(effective / 60);
                                  const m = effective % 60;
                                  return h > 0 ? `${h}h ${m}m` : `${m} min`;
                               })()}
                             </p>
                           </div>
                           <div>
                             <p className="text-[10px] text-muted-foreground uppercase">Previsão</p>
                             <p className="text-sm font-medium text-muted-foreground truncate" title={dueDate ? new Date(dueDate).toLocaleString("pt-BR") : "--"}>
                               {dueDate ? new Date(dueDate).toLocaleString("pt-BR") : "--"}
                             </p>
                           </div>
                        </div>
                        {["AGUARDANDO_USUARIO", "AGUARDANDO_TERCEIROS", "AGUARDANDO_PECA", "AGENDADO"].includes(status) && (
                           <div className="pt-3 mt-3 border-t border-border/50 flex justify-between items-center">
                              <span className="text-[11px] text-muted-foreground">O chamado precisa ser retomado para continuar contando o SLA.</span>
                              <Button 
                                type="button" 
                                variant="outline" 
                                size="sm" 
                                className="h-8 text-xs bg-emerald-500/10 text-emerald-600 border-emerald-200 hover:bg-emerald-500/20"
                                onClick={() => setStatus("EM_ATENDIMENTO")}
                              >
                                <PlayCircle className="w-3.5 h-3.5 mr-1.5" />
                                Retomar Atendimento
                              </Button>
                           </div>
                        )}
                      </div>
                    )}

                    {/* Observações Internas */}
                    <div className="mt-4 bg-muted/10 p-4 border border-border/40 rounded-xl shrink-0">
                      <Label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-2 block">
                        Observações da Equipe (Somente TI)
                      </Label>
                      <Textarea
                        placeholder="Anotações técnicas, alertas, etc..."
                        value={observations}
                        onChange={(e) => setObservations(e.target.value)}
                        className="min-h-[80px] bg-background border-input/60 text-[13px] shadow-none"
                      />
                    </div>
                  </div>
                )}

                {/* ABA: HISTÓRICO (TIMELINE) */}
                {activeTab === "TIMELINE" && (
                  <div className="space-y-4">
                    <h4 className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-4">
                      Trilha de Eventos e Alterações
                    </h4>
                    {historyEvents.length === 0 ? (
                      <p className="text-[13px] text-muted-foreground p-4 bg-muted/10 rounded-lg text-center border border-dashed border-border/50">
                        Nenhum evento registrado nesta timeline.
                      </p>
                    ) : (
                      <div className="space-y-4 border-l-2 border-primary/20 pl-5 ml-2">
                        {historyEvents.map((ev) => (
                          <div key={ev.id} className="relative flex flex-col gap-0.5 text-[13px]">
                            <div className="absolute -left-[27px] top-1.5 w-3 h-3 rounded-full bg-background border-2 border-primary" />
                            <div className="flex items-center justify-between">
                              <span className="font-semibold text-foreground">
                                {ev.description}
                              </span>
                              <span className="font-mono text-[11px] text-muted-foreground">
                                {new Date(ev.createdAt).toLocaleString("pt-BR", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit" })}
                              </span>
                            </div>
                            <p className="text-[11px] text-muted-foreground mt-0.5">
                              Autor: <span className="font-medium text-foreground/80">{ev.actorName || "Sistema"}</span>
                            </p>
                            {ev.oldValue && ev.newValue && (
                              <div className="text-[11px] bg-muted/30 p-2 rounded-md mt-1.5 font-mono border border-border/40">
                                De: <span className="line-through text-danger/80">{ev.oldValue}</span> <span className="mx-1 text-muted-foreground">→</span> 
                                Para: <span className="text-emerald-600 font-bold">{ev.newValue}</span>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* ABA: COMENTÁRIOS INTERNOS */}
                {activeTab === "COMMENTS" && (
                  <div className="space-y-4 flex flex-col h-full">
                    <div className="shrink-0 bg-background rounded-xl border border-border/60 shadow-sm overflow-hidden flex flex-col">
                      <div className="flex flex-col bg-background relative">
                        <Textarea 
                          rows={4}
                          placeholder={isInternalComment ? "Escreva uma nota interna (oculta do cliente)..." : "Escreva sua resposta (será enviada ao cliente)..."}
                          value={newComment}
                          onChange={(e) => setNewComment(e.target.value)}
                          className="w-full text-[13px] bg-transparent border-0 outline-none focus-visible:ring-0 resize-y custom-scrollbar min-h-[100px] p-4 pb-2 shadow-none"
                        />
                        {(!isInternalComment && signatureHtml) && (
                          <div className="px-4 pb-4">
                            <div className="text-[13px] text-muted-foreground" dangerouslySetInnerHTML={{ __html: signatureHtml }} />
                          </div>
                        )}
                      </div>
                      
                      <div className="bg-muted/30 border-t border-border/50 p-3 flex justify-between items-center gap-4 flex-wrap">
                        <div className="flex items-center gap-4">
                          <div className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              id="internalNote"
                              checked={isInternalComment}
                              onChange={(e) => setIsInternalComment(e.target.checked)}
                              className="rounded border-border text-primary cursor-pointer w-4 h-4"
                            />
                            <Label htmlFor="internalNote" className="text-[12px] font-semibold cursor-pointer text-muted-foreground">
                              Nota Interna
                            </Label>
                          </div>
                          
                          {!isInternalComment && (
                            <>
                              <div className="h-4 w-px bg-border/50 hidden sm:block" />
                              <button
                                type="button"
                                onClick={() => setShowSignatureSettings(true)}
                                className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground hover:text-primary flex items-center gap-1.5 transition-colors bg-background px-2.5 py-1.5 border border-border/60 rounded shadow-sm"
                              >
                                <Pencil className="w-3.5 h-3.5" /> Assinatura
                              </button>
                            </>
                          )}
                          
                          {!isInternalComment && ccAddresses && (
                            <>
                              <div className="h-4 w-px bg-border/50 hidden sm:block" />
                              <div className="flex items-center gap-2">
                                <input 
                                  type="checkbox" 
                                  id="replyAll" 
                                  checked={replyAll}
                                  onChange={(e) => setReplyAll(e.target.checked)}
                                  className="rounded border-border text-primary cursor-pointer w-4 h-4"
                                />
                                <Label htmlFor="replyAll" className="text-[12px] cursor-pointer text-muted-foreground" title={ccAddresses}>
                                  Responder Todos
                                </Label>
                              </div>
                            </>
                          )}
                        </div>
                        
                        <Button
                          type="button"
                          onClick={handleAddComment}
                          disabled={addingComment || !newComment.trim()}
                          className="h-9 px-5 font-bold"
                        >
                          <Send className="w-4 h-4 mr-2" />
                          Enviar
                        </Button>
                      </div>
                    </div>

                    <div className="space-y-3 flex-1 overflow-y-auto">
                      {comments.length === 0 ? (
                        <p className="text-[13px] text-muted-foreground p-4 text-center border border-dashed border-border/50 rounded-lg">
                          Nenhum comentário interno cadastrado.
                        </p>
                      ) : (
                        comments.map((c) => (
                          <div key={c.id} className="p-4 rounded-xl border border-border/60 bg-background shadow-sm space-y-1.5">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <span className="text-[13px] font-bold text-foreground">
                                  {c.author?.name || "Técnico TI"}
                                </span>
                                <Badge variant="outline" className="text-[9px] px-1.5 py-0 uppercase tracking-tight">
                                  {c.author?.role || "TI"}
                                </Badge>
                              </div>
                              <span className="text-[11px] text-muted-foreground font-mono">
                                {new Date(c.createdAt).toLocaleString("pt-BR")}
                              </span>
                            </div>
                            <p className="text-[13px] text-foreground mt-1 whitespace-pre-line leading-relaxed">
                              {c.content}
                            </p>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}

                {/* ABA: ANEXOS */}
                {activeTab === "ATTACHMENTS" && (
                  <div className="space-y-4 flex flex-col h-full">
                    <div className="flex flex-col gap-3 p-6 border-2 border-dashed border-primary/30 rounded-xl bg-primary/5 items-center justify-center text-center hover:bg-primary/10 transition-colors shrink-0">
                      <p className="text-[13px] text-muted-foreground font-medium">Anexe arquivos úteis ao chamado (PNG, JPG, PDF, DOCX, XLSX)</p>
                      <label className={`cursor-pointer inline-flex h-9 items-center justify-center rounded-md bg-primary px-5 text-[13px] font-bold text-primary-foreground shadow transition-all hover:bg-primary/90 hover:scale-[1.02] active:scale-[0.98] ${uploadingAttachment ? "opacity-50 pointer-events-none" : ""}`}>
                          {uploadingAttachment ? "Enviando..." : "Selecionar Arquivo"}
                          <input type="file" className="hidden" accept=".png,.jpg,.jpeg,.pdf,.docx,.xlsx" onChange={handleFileUpload} disabled={uploadingAttachment} />
                      </label>
                    </div>
                    <div className="space-y-2 mt-4 flex-1 overflow-y-auto">
                      {attachments.length === 0 ? (
                          <p className="text-[13px] text-muted-foreground text-center p-4 bg-muted/10 rounded-lg border border-dashed border-border/50">Nenhum anexo encontrado.</p>
                      ) : (
                          attachments.map((att) => (
                            <div key={att.id} className="flex items-center justify-between p-3.5 border border-border/60 rounded-xl bg-background shadow-sm hover:shadow-md transition-shadow group">
                                <div className="flex items-center gap-3 overflow-hidden">
                                  <div className="bg-primary/10 p-2.5 rounded-lg group-hover:bg-primary/20 transition-colors">
                                      <FileText className="w-4 h-4 flex-shrink-0 text-primary" />
                                  </div>
                                  <span className="text-[13px] font-semibold truncate group-hover:text-primary transition-colors">{att.fileName}</span>
                                </div>
                                <a href={att.fileUrl} target="_blank" rel="noreferrer" className="text-[11px] uppercase font-bold bg-primary/10 text-primary px-4 py-2 rounded-lg hover:bg-primary hover:text-primary-foreground transition-colors whitespace-nowrap ml-2">
                                  Baixar
                                </a>
                            </div>
                          ))
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Botões de Ação na Base da Coluna Direita (Apenas no painel de INFO) */}
              {activeTab === "INFO" && (
                <div className="p-4 border-t border-border/40 bg-muted/5 flex items-center justify-end gap-3 mt-auto shrink-0">
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => onOpenChange(false)}
                    disabled={saving}
                    className="text-[13px] font-semibold"
                  >
                    Cancelar
                  </Button>
                  <Button 
                    type="submit" 
                    disabled={saving}
                    className="px-6 py-5 text-[14px] shadow-md hover:shadow-lg transition-all"
                  >
                    {saving ? "Salvando..." : isEditing ? "Salvar Alterações" : "Criar Chamado"}
                    {!saving && <Send className="w-4 h-4 ml-2" />}
                  </Button>
                </div>
              )}
            </div>
          </form>
        )}
      </DialogContent>
      {showSignatureSettings && (
        <SignatureSettingsModal
          onClose={() => setShowSignatureSettings(false)}
          onSave={(html) => setSignatureHtml(html)}
        />
      )}
    </Dialog>
  );
}
