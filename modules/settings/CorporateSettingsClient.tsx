"use client";

import React, { useState, useEffect } from "react";
import Image from "next/image";
import { motion, type Variants } from "framer-motion";
import {
  BuildingOffice,
  PaintBrush,
  UsersThree,
  FileText,
  Printer,
  ShieldCheck,
  Graph,
  Wrench,
  CheckCircle,
  WarningCircle,
  Sparkle,
  ArrowCounterClockwise,
  FloppyDisk,
  Warning,
  Export,
  Trash,
} from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { SectionCard } from "@/components/common/SectionCard";
import { useWhiteLabel } from "@/hooks/useWhiteLabel";
import { CorporateSettingsDTO } from "@/services/settings/settings.service";
import { CsvImportWizard } from "@/modules/import/CsvImportWizard";
import { RolesSettings } from "./RolesSettings";

const containerVariants: Variants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.1 }
  }
};

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 20, filter: "blur(4px)" },
  show: { 
    opacity: 1, 
    y: 0, 
    filter: "blur(0px)",
    transition: { type: "spring", stiffness: 100, damping: 20 } 
  }
};

export function CorporateSettingsClient() {
  const { config, updateConfig } = useWhiteLabel();
  const [activeTab, setActiveTab] = useState<
    "EMPRESA" | "APARENCIA" | "USUARIOS" | "FUNCOES" | "CHAMADOS" | "RELATORIOS" | "AUDITORIA" | "INTEGRACOES" | "FERRAMENTAS"
  >("EMPRESA");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"IDLE" | "SUCCESS" | "ERROR">("IDLE");
  const [errorMessage, setErrorMessage] = useState("");

  const [importWizardOpen, setImportWizardOpen] = useState(false);
  const [resetModalOpen, setResetModalOpen] = useState(false);
  const [resetConfirmText, setResetConfirmText] = useState("");
  const [resetting, setResetting] = useState(false);

  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [exportType, setExportType] = useState("tickets");
  const [exportMonth, setExportMonth] = useState("all");
  const [exporting, setExporting] = useState(false);

  const [testEmail, setTestEmail] = useState("");
  const [testingEmail, setTestingEmail] = useState(false);
  const [testEmailSuccess, setTestEmailSuccess] = useState("");
  const [testEmailError, setTestEmailError] = useState("");

  const [form, setForm] = useState<CorporateSettingsDTO>({
    companyId: "cg-construcoes-001",
    systemName: "CG Construções HelpDesk Pro",
    theme: "system",
    primaryColor: "#2563eb",
    secondaryColor: "#f1f5f9",
    department: "Departamento de TI",
    phone: "(11) 3456-7890",
    email: "ti@cgconstrucoes.com.br",
    website: "www.cgconstrucoes.com.br",
    address: "Av. Principal, 1000 - Centro",
    favicon: "/cg-logo.png",
    borderRadius: "0.5rem",
    compactMode: false,
    allowRegistration: false,
    minPasswordLen: 8,
    sessionTimeoutMin: 120,
    requireFirstAccess: true,
    maxLoginAttempts: 5,
    defaultStatus: "ABERTO",
    defaultOrigin: "MANUAL",
    defaultPriority: "MEDIA",
    defaultSlaHours: 24,
    autoArchive: true,
    archiveDays: 30,
    monthlyNumbering: true,
    reportShowLogo: true,
    reportShowFooter: true,
    reportDefaultTheme: "LIGHT",
    auditRetentionDays: 90,
    auditLogEnabled: true,
    recessActive: false,
    recessReturnDate: "",
  });

  // Carrega do back-end /api/settings
  useEffect(() => {
    async function loadSettings() {
      setLoading(true);
      try {
        const res = await fetch("/api/settings");
        if (res.ok) {
          const data = await res.json();
          setForm(data);
          // Sincroniza o White Label visual ao carregar
          updateConfig({
            systemName: data.systemName || "CG Construções HelpDesk Pro",
            logo: data.favicon || "/cg-logo.png",
            primaryColor: data.primaryColor || "#2563eb",
          });
        }
      } catch (err) {
        console.error("Erro ao carregar configurações:", err);
      } finally {
        setLoading(false);
      }
    }
    loadSettings();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleChange = (key: keyof CorporateSettingsDTO, value: any) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    // Se for alteração de aparência, reflete em tempo real no White Label
    if (key === "systemName") {
      updateConfig({ systemName: value });
    } else if (key === "primaryColor") {
      updateConfig({ primaryColor: value });
    } else if (key === "favicon") {
      updateConfig({ logo: value || "/cg-logo.png" });
    }
    setSaveStatus("IDLE");
  };

  const handleSave = async () => {
    setSaving(true);
    setSaveStatus("IDLE");
    try {
      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Erro ao salvar");
      }

      const updated = await res.json();
      setForm(updated);
      setSaveStatus("SUCCESS");
      setTimeout(() => setSaveStatus("IDLE"), 4000);
    } catch (err: any) {
      console.error(err);
      setErrorMessage(err.message || "Erro de conexão ao salvar");
      setSaveStatus("ERROR");
    } finally {
      setSaving(false);
    }
  };

  const handleRestoreDefaults = () => {
    setForm({
      companyId: "cg-construcoes-001",
      systemName: "CG Construções HelpDesk Pro",
      theme: "system",
      primaryColor: "#2563eb",
      secondaryColor: "#f1f5f9",
      department: "Departamento de TI",
      phone: "(11) 3456-7890",
      email: "ti@cgconstrucoes.com.br",
      website: "www.cgconstrucoes.com.br",
      address: "Av. Principal, 1000 - Centro",
      favicon: "/cg-logo.png",
      borderRadius: "0.5rem",
      compactMode: false,
      allowRegistration: false,
      minPasswordLen: 8,
      sessionTimeoutMin: 120,
      requireFirstAccess: true,
      maxLoginAttempts: 5,
      defaultStatus: "ABERTO",
      defaultOrigin: "MANUAL",
      defaultPriority: "MEDIA",
      defaultSlaHours: 24,
      autoArchive: true,
      archiveDays: 30,
      monthlyNumbering: true,
      reportShowLogo: true,
      reportShowFooter: true,
      reportDefaultTheme: "LIGHT",
      auditRetentionDays: 90,
      auditLogEnabled: true,
      recessActive: false,
      recessReturnDate: "",
    });
    updateConfig({
      systemName: "CG Construções HelpDesk Pro",
      logo: "/cg-logo.png",
      primaryColor: "#2563eb",
    });
  };

  const tabs = [
    { id: "EMPRESA", label: "Empresa", icon: BuildingOffice },
    { id: "APARENCIA", label: "Aparência", icon: PaintBrush },
    { id: "USUARIOS", label: "Usuários & RBAC", icon: UsersThree },
    { id: "FUNCOES", label: "Funções", icon: ShieldCheck },
    { id: "CHAMADOS", label: "Chamados & SLA", icon: FileText },
    { id: "RELATORIOS", label: "Relatórios & PDF", icon: Printer },
    { id: "AUDITORIA", label: "Auditoria & Logs", icon: ShieldCheck },
    { id: "INTEGRACOES", label: "Integrações", icon: Graph },
    { id: "FERRAMENTAS", label: "Ferramentas", icon: Wrench },
  ] as const;

  const handleTestEmail = async () => {
    if (!testEmail) {
      setTestEmailError("Informe um e-mail válido.");
      return;
    }
    setTestingEmail(true);
    setTestEmailSuccess("");
    setTestEmailError("");
    try {
      const res = await fetch("/api/settings/email/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to: testEmail }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Erro ao enviar e-mail");
      }
      setTestEmailSuccess(data.message || "E-mail de teste enviado com sucesso!");
    } catch (e: any) {
      setTestEmailError(e.message || "Falha ao enviar e-mail.");
    } finally {
      setTestingEmail(false);
    }
  };

  const handleExportData = () => {
    setExporting(true);
    let url = `/api/export?type=${exportType}`;
    if (exportType === "tickets" && exportMonth !== "all") {
      url += `&month=${exportMonth}`;
    }
    window.location.href = url;
    setTimeout(() => {
      setExporting(false);
      setExportModalOpen(false);
    }, 1000);
  };

  const handleResetDatabase = async () => {
    if (resetConfirmText !== "RESETAR") return;
    setResetting(true);
    try {
      const res = await fetch("/api/reset", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirmText: "RESETAR" }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Erro ao resetar banco de dados");
      }
      alert(data.message || "Banco de dados resetado com sucesso.");
      setResetModalOpen(false);
      setResetConfirmText("");
    } catch (e: any) {
      alert(e.message || "Erro ao resetar banco de dados");
    } finally {
      setResetting(false);
    }
  };

  const handleConnectGoogle = () => {
    window.location.href = "/api/settings/email/oauth";
  };

  const handleDisconnect = async () => {
    if (!confirm("Tem certeza que deseja desconectar o e-mail? O sistema parará de receber chamados automáticos.")) return;
    try {
      const res = await fetch("/api/settings/email/disconnect", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erro ao desconectar");
      alert("Conta desconectada com sucesso.");
      
      const refresh = await fetch("/api/settings");
      if (refresh.ok) setForm(await refresh.json());
    } catch (e: any) {
      alert("Falha ao desconectar: " + e.message);
    }
  };

  const handleCheckNow = async () => {
    if (!confirm("Isso iniciará a verificação imediata da caixa de entrada. Deseja continuar?")) return;
    try {
      const res = await fetch("/api/email/check", {
        method: "POST",
        headers: {
          "Authorization": "Bearer helpdesk-cron-secret-123"
        }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erro ao verificar");
      alert(`Verificação concluída.\nE-mails processados e chamados criados: ${data.processed || 0}\nErros encontrados: ${data.errors || 0}`);
      
      // Refresh form data
      const refresh = await fetch("/api/settings");
      if (refresh.ok) setForm(await refresh.json());
    } catch (e: any) {
      alert("Falha ao verificar e-mails: " + e.message);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-28 rounded-2xl bg-muted/40 border border-border" />
        <div className="h-12 w-full rounded-xl bg-muted/30 border border-border" />
        <div className="h-96 rounded-2xl bg-muted/20 border border-border" />
      </div>
    );
  }

  return (
    <motion.div 
      variants={containerVariants}
      initial="hidden"
      animate="show"
      className="space-y-6"
    >
      {/* CARD BANNER PRINCIPAL WHITE LABEL PREVIEW EM TEMPO REAL */}
      <motion.div variants={itemVariants} className="relative overflow-hidden rounded-[2rem] border border-primary/20 bg-gradient-to-r from-card via-card to-primary/5 p-8 shadow-xl">
        <div className="absolute top-0 right-0 p-32 bg-primary/5 rounded-full blur-3xl -z-10 -mr-20 -mt-20"></div>
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-white p-2.5 shadow-sm border border-border">
              <Image
                src={form.favicon || "/cg-logo.png"}
                alt={form.systemName}
                width={48}
                height={48}
                className="h-full w-full object-contain"
                priority
              />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-xl font-bold text-foreground">
                  {form.systemName}
                </h3>
                <Badge className="bg-primary/10 text-primary border-primary/20 hover:bg-primary/20 rounded-full px-3">
                  <Sparkle weight="fill" className="h-3 w-3 mr-1" />
                  White Label Ativo
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground mt-0.5">
                {form.department} • CNPJ 12.345.678/0001-99 • Sincronizado com PostgreSQL (Neon)
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-end md:self-center">
            <Button
              variant="outline"
              size="sm"
              onClick={handleRestoreDefaults}
              className="text-xs h-10 px-4 rounded-xl border-border/80 hover:bg-muted/50"
            >
              <ArrowCounterClockwise className="h-4 w-4 mr-2" />
              Restaurar Padrão
            </Button>
            <Button
              size="sm"
              onClick={handleSave}
              disabled={saving}
              className="font-semibold shadow-md text-xs h-10 px-6 rounded-xl transition-all hover:shadow-lg"
            >
              <FloppyDisk weight="fill" className="h-4 w-4 mr-2" />
              {saving ? "Salvando..." : "Salvar Alterações"}
            </Button>
          </div>
        </div>

        {saveStatus === "SUCCESS" && (
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-6 flex items-center gap-2 rounded-xl bg-success/10 border border-success/30 px-4 py-3 text-xs font-semibold text-success"
          >
            <CheckCircle weight="fill" className="h-5 w-5" />
            Configurações corporativas atualizadas com sucesso e aplicadas ao sistema!
          </motion.div>
        )}

        {saveStatus === "ERROR" && (
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-6 flex items-center gap-2 rounded-xl bg-danger/10 border border-danger/30 px-4 py-3 text-xs font-semibold text-danger"
          >
            <WarningCircle weight="fill" className="h-5 w-5" />
            {errorMessage}
          </motion.div>
        )}
      </motion.div>

      {/* BARRA DE NAVEGAÇÃO ENTRE AS 7 ABAS OBRIGATÓRIAS */}
      <motion.div variants={itemVariants} className="flex items-center gap-2 overflow-x-auto pb-2 border-b border-border/40 scrollbar-hide">
        {tabs.map((t) => {
          const Icon = t.icon;
          const isActive = activeTab === t.id;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setActiveTab(t.id)}
              className={`flex items-center gap-2 px-5 py-3 rounded-2xl text-xs font-display font-bold uppercase tracking-wider whitespace-nowrap transition-all duration-300 ${
                isActive
                  ? "bg-foreground text-background shadow-md scale-[1.02]"
                  : "bg-transparent border border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/50"
              }`}
            >
              <Icon weight={isActive ? "fill" : "duotone"} className="h-5 w-5" />
              {t.label}
            </button>
          );
        })}
      </motion.div>

      {/* CONTEÚDO DE CADA UMA DAS 7 ABAS */}
      <div className="space-y-6 pt-4">
        {/* ======================= ABA 1: EMPRESA ======================= */}
        {activeTab === "EMPRESA" && (
          <SectionCard
            title="Identidade da Empresa Cliente"
            description="Informações cadastrais e logomarca institucional da CG Construções."
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="space-y-2">
                <label className="text-xs font-display font-bold text-muted-foreground uppercase tracking-widest">
                  Nome do Sistema
                </label>
                <Input
                  value={form.systemName}
                  onChange={(e) => handleChange("systemName", e.target.value)}
                  placeholder="Ex: CG Construções HelpDesk Pro"
                  className="h-12 rounded-xl bg-background/50 border-border/80 focus-visible:ring-1 focus-visible:ring-primary/30"
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-display font-bold text-muted-foreground uppercase tracking-widest">
                  Departamento Responsável
                </label>
                <Input
                  value={form.department}
                  onChange={(e) => handleChange("department", e.target.value)}
                  placeholder="Ex: Departamento de TI"
                  className="h-12 rounded-xl bg-background/50 border-border/80 focus-visible:ring-1 focus-visible:ring-primary/30"
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-display font-bold text-muted-foreground uppercase tracking-widest">
                  Logomarca Oficial & Favicon (URL)
                </label>
                <Input
                  value={form.favicon}
                  onChange={(e) => handleChange("favicon", e.target.value)}
                  placeholder="Ex: /cg-logo.png"
                  className="font-mono text-xs h-12 rounded-xl bg-background/50 border-border/80 focus-visible:ring-1 focus-visible:ring-primary/30"
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-display font-bold text-muted-foreground uppercase tracking-widest">
                  E-mail Institucional de TI
                </label>
                <Input
                  value={form.email}
                  onChange={(e) => handleChange("email", e.target.value)}
                  placeholder="ti@cgconstrucoes.com.br"
                  className="h-12 rounded-xl bg-background/50 border-border/80 focus-visible:ring-1 focus-visible:ring-primary/30"
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-display font-bold text-muted-foreground uppercase tracking-widest">
                  Telefone de Suporte / Ramal
                </label>
                <Input
                  value={form.phone}
                  onChange={(e) => handleChange("phone", e.target.value)}
                  placeholder="(11) 3456-7890"
                  className="h-12 rounded-xl bg-background/50 border-border/80 focus-visible:ring-1 focus-visible:ring-primary/30"
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-display font-bold text-muted-foreground uppercase tracking-widest">
                  Website Corporativo
                </label>
                <Input
                  value={form.website}
                  onChange={(e) => handleChange("website", e.target.value)}
                  placeholder="www.cgconstrucoes.com.br"
                  className="h-12 rounded-xl bg-background/50 border-border/80 focus-visible:ring-1 focus-visible:ring-primary/30"
                />
              </div>

              <div className="space-y-2 md:col-span-2">
                <label className="text-xs font-display font-bold text-muted-foreground uppercase tracking-widest">
                  Endereço Sede / Unidade
                </label>
                <Input
                  value={form.address}
                  onChange={(e) => handleChange("address", e.target.value)}
                  placeholder="Av. Principal, 1000 - Centro"
                  className="h-12 rounded-xl bg-background/50 border-border/80 focus-visible:ring-1 focus-visible:ring-primary/30"
                />
              </div>
            </div>
          </SectionCard>
        )}

        {/* ======================= ABA 2: APARÊNCIA ======================= */}
        {activeTab === "APARENCIA" && (
          <SectionCard
            title="Aparência, Cores & Tema"
            description="Personalização do design system visual com visualização instantânea."
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-xs font-display font-bold text-muted-foreground uppercase tracking-widest block mb-2">
                  Tema Padrão do Sistema
                </label>
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { val: "LIGHT", label: "Claro" },
                    { val: "DARK", label: "Escuro" },
                    { val: "system", label: "Sistema" },
                  ].map((item) => (
                    <button
                      key={item.val}
                      type="button"
                      onClick={() => handleChange("theme", item.val)}
                      className={`py-3 px-4 rounded-xl border text-xs font-bold uppercase tracking-wider transition-all duration-300 ${
                        form.theme === item.val
                          ? "border-primary bg-primary text-background shadow-lg"
                          : "border-border/60 text-foreground hover:bg-muted/50 bg-background/50"
                      }`}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-display font-bold text-muted-foreground uppercase tracking-widest block mb-2">
                  Cor Primária Institucional
                </label>
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <input
                      type="color"
                      value={form.primaryColor}
                      onChange={(e) => handleChange("primaryColor", e.target.value)}
                      className="absolute inset-0 opacity-0 w-full h-full cursor-pointer z-10"
                    />
                    <div 
                      className="h-12 w-16 rounded-xl border-2 border-border/80 shadow-inner"
                      style={{ backgroundColor: form.primaryColor }}
                    />
                  </div>
                  <Input
                    value={form.primaryColor}
                    onChange={(e) => handleChange("primaryColor", e.target.value)}
                    className="font-mono text-sm h-12 w-32 rounded-xl bg-background/50 border-border/80 focus-visible:ring-1 focus-visible:ring-primary/30"
                  />
                  <Badge variant="outline" className="text-[10px] uppercase font-mono tracking-wider h-8 rounded-lg bg-background">
                    Padrão: #2563eb
                  </Badge>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-display font-bold text-muted-foreground uppercase tracking-widest block mb-2">
                  Arredondamento de Bordas
                </label>
                <select
                  value={form.borderRadius}
                  onChange={(e) => handleChange("borderRadius", e.target.value)}
                  className="w-full h-12 px-4 text-sm font-medium rounded-xl border border-border/80 bg-background/50 focus:outline-none focus:ring-1 focus:ring-primary/30"
                >
                  <option value="0.25rem">Pequeno (0.25rem)</option>
                  <option value="0.5rem">Padrão Moderno (0.5rem)</option>
                  <option value="0.75rem">Arredondado (0.75rem)</option>
                  <option value="1rem">Pílula (1rem)</option>
                </select>
              </div>

              <div className="flex items-center justify-between p-5 rounded-2xl border border-border/60 bg-card hover:bg-muted/20 transition-colors">
                <div className="space-y-1 max-w-[80%]">
                  <p className="text-sm font-display font-bold text-foreground">
                    Modo Compacto de Tabelas
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Reduz o preenchimento (padding) nas listagens para telas com alta densidade de dados.
                  </p>
                </div>
                <div className="relative flex items-center">
                  <input
                    type="checkbox"
                    checked={form.compactMode}
                    onChange={(e) => handleChange("compactMode", e.target.checked)}
                    className="peer sr-only"
                    id="compactMode"
                  />
                  <label
                    htmlFor="compactMode"
                    className="w-11 h-6 bg-muted-foreground/30 rounded-full peer peer-checked:bg-primary cursor-pointer transition-colors duration-300 relative after:content-[''] after:absolute after:top-1 after:left-1 after:bg-background after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-5"
                  ></label>
                </div>
              </div>
            </div>
          </SectionCard>
        )}

        {/* ======================= ABA 3: USUÁRIOS & RBAC ======================= */}
        {activeTab === "USUARIOS" && (
          <SectionCard
            title="Acesso, Senhas & Políticas RBAC"
            description="Controla segurança de autenticação, auto-cadastro e tempos de sessão."
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="flex items-center justify-between p-5 rounded-2xl border border-border/60 bg-card hover:bg-muted/20 transition-colors">
                <div className="space-y-1 max-w-[80%]">
                  <p className="text-sm font-display font-bold text-foreground">
                    Permitir Auto-Cadastro
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Permite que funcionários solicitem cadastro através da tela de login.
                  </p>
                </div>
                <div className="relative flex items-center">
                  <input
                    type="checkbox"
                    checked={form.allowRegistration}
                    onChange={(e) => handleChange("allowRegistration", e.target.checked)}
                    className="peer sr-only"
                    id="allowRegistration"
                  />
                  <label
                    htmlFor="allowRegistration"
                    className="w-11 h-6 bg-muted-foreground/30 rounded-full peer peer-checked:bg-primary cursor-pointer transition-colors duration-300 relative after:content-[''] after:absolute after:top-1 after:left-1 after:bg-background after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-5"
                  ></label>
                </div>
              </div>

              <div className="flex items-center justify-between p-5 rounded-2xl border border-border/60 bg-card hover:bg-muted/20 transition-colors">
                <div className="space-y-1 max-w-[80%]">
                  <p className="text-sm font-display font-bold text-foreground">
                    Forçar Redefinição no 1º Acesso
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Usuário deve redefinir senha temporária ao logar pela primeira vez.
                  </p>
                </div>
                <div className="relative flex items-center">
                  <input
                    type="checkbox"
                    checked={form.requireFirstAccess}
                    onChange={(e) => handleChange("requireFirstAccess", e.target.checked)}
                    className="peer sr-only"
                    id="requireFirstAccess"
                  />
                  <label
                    htmlFor="requireFirstAccess"
                    className="w-11 h-6 bg-muted-foreground/30 rounded-full peer peer-checked:bg-primary cursor-pointer transition-colors duration-300 relative after:content-[''] after:absolute after:top-1 after:left-1 after:bg-background after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-5"
                  ></label>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-display font-bold text-muted-foreground uppercase tracking-widest">
                  Tamanho Mínimo da Senha
                </label>
                <Input
                  type="number"
                  value={form.minPasswordLen}
                  onChange={(e) => handleChange("minPasswordLen", Number(e.target.value))}
                  min={6}
                  max={20}
                  className="h-12 rounded-xl bg-background/50 border-border/80 focus-visible:ring-1 focus-visible:ring-primary/30"
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-display font-bold text-muted-foreground uppercase tracking-widest">
                  Timeout da Sessão Inativa (Minutos)
                </label>
                <Input
                  type="number"
                  value={form.sessionTimeoutMin}
                  onChange={(e) => handleChange("sessionTimeoutMin", Number(e.target.value))}
                  min={15}
                  max={720}
                  className="h-12 rounded-xl bg-background/50 border-border/80 focus-visible:ring-1 focus-visible:ring-primary/30"
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-display font-bold text-muted-foreground uppercase tracking-widest">
                  Máximo de Tentativas Inválidas
                </label>
                <Input
                  type="number"
                  value={form.maxLoginAttempts}
                  onChange={(e) => handleChange("maxLoginAttempts", Number(e.target.value))}
                  min={3}
                  max={10}
                  className="h-12 rounded-xl bg-background/50 border-border/80 focus-visible:ring-1 focus-visible:ring-primary/30"
                />
              </div>
            </div>
          </SectionCard>
        )}

        {/* ======================= ABA 3.5: FUNCOES ======================= */}
        {activeTab === "FUNCOES" && (
          <SectionCard
            title="Gestão de Funções (Roles)"
            description="Crie e edite as funções que os usuários podem ter no sistema."
          >
            <RolesSettings />
          </SectionCard>
        )}

        {/* ======================= ABA 4: CHAMADOS & SLA ======================= */}
        {activeTab === "CHAMADOS" && (
          <SectionCard
            title="Parâmetros de Chamados & SLA Padrão"
            description="Valores iniciais aplicados automaticamente ao abrir ou gerenciar chamados."
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="space-y-2">
                <label className="text-xs font-display font-bold text-muted-foreground uppercase tracking-widest">
                  SLA Padrão (Horas)
                </label>
                <Input
                  type="number"
                  value={form.defaultSlaHours}
                  onChange={(e) => handleChange("defaultSlaHours", Number(e.target.value))}
                  min={1}
                  max={168}
                  className="h-12 rounded-xl bg-background/50 border-border/80 focus-visible:ring-1 focus-visible:ring-primary/30"
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-display font-bold text-muted-foreground uppercase tracking-widest">
                  Status Inicial
                </label>
                <select
                  value={form.defaultStatus}
                  onChange={(e) => handleChange("defaultStatus", e.target.value)}
                  className="w-full h-12 px-4 text-sm font-medium rounded-xl border border-border/80 bg-background/50 focus:outline-none focus:ring-1 focus:ring-primary/30"
                >
                  <option value="ABERTO">Aberto (Padrão)</option>
                  <option value="PENDENTE">Pendente (Triagem)</option>
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-display font-bold text-muted-foreground uppercase tracking-widest">
                  Origem Padrão
                </label>
                <select
                  value={form.defaultOrigin}
                  onChange={(e) => handleChange("defaultOrigin", e.target.value)}
                  className="w-full h-12 px-4 text-sm font-medium rounded-xl border border-border/80 bg-background/50 focus:outline-none focus:ring-1 focus:ring-primary/30"
                >
                  <option value="MANUAL">Manual (Portal Web)</option>
                  <option value="WHATSAPP">WhatsApp</option>
                  <option value="EMAIL">E-mail</option>
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-display font-bold text-muted-foreground uppercase tracking-widest">
                  Prioridade Padrão
                </label>
                <select
                  value={form.defaultPriority}
                  onChange={(e) => handleChange("defaultPriority", e.target.value)}
                  className="w-full h-12 px-4 text-sm font-medium rounded-xl border border-border/80 bg-background/50 focus:outline-none focus:ring-1 focus:ring-primary/30"
                >
                  <option value="BAIXA">Baixa</option>
                  <option value="MEDIA">Média (Padrão)</option>
                  <option value="ALTA">Alta</option>
                  <option value="URGENTE">Urgente</option>
                </select>
              </div>

              <div className="flex items-center justify-between p-5 rounded-2xl border border-border/60 bg-card hover:bg-muted/20 transition-colors md:col-span-2">
                <div className="space-y-1 max-w-[80%]">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-display font-bold text-foreground">
                      Numeração Sequencial com Reinício Mensal
                    </p>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    O número dos chamados é gerado por mês (ex: #1/07-2026) e reinicia no dia 1º de cada mês automaticamente.
                  </p>
                </div>
                <div className="relative flex items-center">
                  <input
                    type="checkbox"
                    checked={form.monthlyNumbering}
                    onChange={(e) => handleChange("monthlyNumbering", e.target.checked)}
                    className="peer sr-only"
                    id="monthlyNumbering"
                  />
                  <label
                    htmlFor="monthlyNumbering"
                    className="w-11 h-6 bg-muted-foreground/30 rounded-full peer peer-checked:bg-primary cursor-pointer transition-colors duration-300 relative after:content-[''] after:absolute after:top-1 after:left-1 after:bg-background after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-5"
                  ></label>
                </div>
              </div>

              <div className="flex items-center justify-between p-5 rounded-2xl border border-border/60 bg-card hover:bg-muted/20 transition-colors">
                <div className="space-y-1 max-w-[80%]">
                  <p className="text-sm font-display font-bold text-foreground">
                    Arquivar Resolvidos Automaticamente
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Mover chamados antigos finalizados para o arquivo histórico.
                  </p>
                </div>
                <div className="relative flex items-center">
                  <input
                    type="checkbox"
                    checked={form.autoArchive}
                    onChange={(e) => handleChange("autoArchive", e.target.checked)}
                    className="peer sr-only"
                    id="autoArchive"
                  />
                  <label
                    htmlFor="autoArchive"
                    className="w-11 h-6 bg-muted-foreground/30 rounded-full peer peer-checked:bg-primary cursor-pointer transition-colors duration-300 relative after:content-[''] after:absolute after:top-1 after:left-1 after:bg-background after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-5"
                  ></label>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-display font-bold text-muted-foreground uppercase tracking-widest">
                  Dias para Arquivar
                </label>
                <Input
                  type="number"
                  value={form.archiveDays}
                  onChange={(e) => handleChange("archiveDays", Number(e.target.value))}
                  min={7}
                  max={365}
                  className="h-12 rounded-xl bg-background/50 border-border/80 focus-visible:ring-1 focus-visible:ring-primary/30"
                />
              </div>
            </div>

            <div className="mt-8">
              <h4 className="text-sm font-bold text-foreground mb-4 uppercase tracking-wider">Recesso e Férias Coletivas</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5 p-5 rounded-2xl border border-border/60 bg-card hover:bg-muted/20 transition-colors">
                <div className="space-y-1">
                  <p className="text-sm font-display font-bold text-foreground">
                    Ativar Recesso (SLA e Auto-Respostas)
                  </p>
                  <p className="text-xs text-muted-foreground pr-4">
                    Quando ativo, os e-mails recebidos automaticamente receberão uma resposta de ausência e o prazo ficará pausado.
                  </p>
                </div>
                <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-end">
                  {form.recessActive && (
                    <div className="flex-1 w-full max-w-[200px]">
                      <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest block mb-1">
                        Data de Retorno
                      </label>
                      <Input
                        type="date"
                        value={form.recessReturnDate ? new Date(form.recessReturnDate).toISOString().split('T')[0] : ""}
                        onChange={(e) => handleChange("recessReturnDate", new Date(e.target.value).toISOString())}
                        className="h-10 text-xs rounded-xl bg-background/50 border-border/80"
                      />
                    </div>
                  )}
                  <div className="relative flex items-center pt-1 sm:pt-4">
                    <input
                      type="checkbox"
                      checked={form.recessActive}
                      onChange={(e) => handleChange("recessActive", e.target.checked)}
                      className="peer sr-only"
                      id="recessActive"
                    />
                    <label
                      htmlFor="recessActive"
                      className="w-11 h-6 bg-muted-foreground/30 rounded-full peer peer-checked:bg-primary cursor-pointer transition-colors duration-300 relative after:content-[''] after:absolute after:top-1 after:left-1 after:bg-background after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-5"
                    ></label>
                  </div>
                </div>
              </div>
            </div>
          </SectionCard>
        )}

        {/* ======================= ABA 5: RELATÓRIOS & PDF ======================= */}
        {activeTab === "RELATORIOS" && (
          <SectionCard
            title="Relatórios Executivos & Exportação PDF"
            description="Define diretrizes institucionais para documentos exportados pelo sistema."
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="flex items-center justify-between p-5 rounded-2xl border border-border/60 bg-card hover:bg-muted/20 transition-colors">
                <div className="space-y-1 max-w-[80%]">
                  <p className="text-sm font-display font-bold text-foreground">
                    Exibir Logomarca Oficial no Cabeçalho
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Inclui a logo da empresa no topo esquerdo do documento PDF.
                  </p>
                </div>
                <div className="relative flex items-center">
                  <input
                    type="checkbox"
                    checked={form.reportShowLogo}
                    onChange={(e) => handleChange("reportShowLogo", e.target.checked)}
                    className="peer sr-only"
                    id="reportShowLogo"
                  />
                  <label
                    htmlFor="reportShowLogo"
                    className="w-11 h-6 bg-muted-foreground/30 rounded-full peer peer-checked:bg-primary cursor-pointer transition-colors duration-300 relative after:content-[''] after:absolute after:top-1 after:left-1 after:bg-background after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-5"
                  ></label>
                </div>
              </div>

              <div className="flex items-center justify-between p-5 rounded-2xl border border-border/60 bg-card hover:bg-muted/20 transition-colors">
                <div className="space-y-1 max-w-[80%]">
                  <p className="text-sm font-display font-bold text-foreground">
                    Exibir Rodapé e Paginação
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Inclui assinatura em todas as páginas do PDF.
                  </p>
                </div>
                <div className="relative flex items-center">
                  <input
                    type="checkbox"
                    checked={form.reportShowFooter}
                    onChange={(e) => handleChange("reportShowFooter", e.target.checked)}
                    className="peer sr-only"
                    id="reportShowFooter"
                  />
                  <label
                    htmlFor="reportShowFooter"
                    className="w-11 h-6 bg-muted-foreground/30 rounded-full peer peer-checked:bg-primary cursor-pointer transition-colors duration-300 relative after:content-[''] after:absolute after:top-1 after:left-1 after:bg-background after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-5"
                  ></label>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-display font-bold text-muted-foreground uppercase tracking-widest">
                  Tema Padrão do Relatório PDF
                </label>
                <select
                  value={form.reportDefaultTheme}
                  onChange={(e) => handleChange("reportDefaultTheme", e.target.value)}
                  className="w-full h-12 px-4 text-sm font-medium rounded-xl border border-border/80 bg-background/50 focus:outline-none focus:ring-1 focus:ring-primary/30"
                >
                  <option value="LIGHT">Tema Claro (Fundo Branco Padrão)</option>
                  <option value="DARK">Tema Escuro (Corporativo Ardósia)</option>
                </select>
              </div>

              <div className="p-5 rounded-2xl border border-primary/20 bg-primary/5 flex items-start gap-4">
                <Printer weight="duotone" className="h-6 w-6 text-primary shrink-0 mt-0.5" />
                <div className="space-y-1.5">
                  <p className="text-sm font-display font-bold text-foreground">
                    Formato Fixo: Landscape (A4 Paisagem)
                  </p>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Conforme norma corporativa, todos os relatórios executivos gerenciais são desenhados vetorialmente na orientação Landscape para perfeita disposição das tabelas de BI.
                  </p>
                </div>
              </div>
            </div>
          </SectionCard>
        )}

        {/* ======================= ABA 6: AUDITORIA & LOGS ======================= */}
        {activeTab === "AUDITORIA" && (
          <SectionCard
            title="Políticas de Auditoria & Retenção"
            description="Controle de rastreabilidade, histórico de chamados e conformidade."
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="flex items-center justify-between p-5 rounded-2xl border border-border/60 bg-card hover:bg-muted/20 transition-colors">
                <div className="space-y-1 max-w-[80%]">
                  <p className="text-sm font-display font-bold text-foreground">
                    Registro de Log de Auditoria
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Registra todas as ações administrativas, alterações de status e permissões.
                  </p>
                </div>
                <div className="relative flex items-center">
                  <input
                    type="checkbox"
                    checked={form.auditLogEnabled}
                    onChange={(e) => handleChange("auditLogEnabled", e.target.checked)}
                    className="peer sr-only"
                    id="auditLogEnabled"
                  />
                  <label
                    htmlFor="auditLogEnabled"
                    className="w-11 h-6 bg-muted-foreground/30 rounded-full peer peer-checked:bg-primary cursor-pointer transition-colors duration-300 relative after:content-[''] after:absolute after:top-1 after:left-1 after:bg-background after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-5"
                  ></label>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-display font-bold text-muted-foreground uppercase tracking-widest">
                  Período de Retenção de Logs (Dias)
                </label>
                <Input
                  type="number"
                  value={form.auditRetentionDays}
                  onChange={(e) => handleChange("auditRetentionDays", Number(e.target.value))}
                  min={30}
                  max={1825}
                  className="h-12 rounded-xl bg-background/50 border-border/80 focus-visible:ring-1 focus-visible:ring-primary/30"
                />
              </div>

              <div className="p-5 rounded-2xl border border-border/60 bg-muted/10 md:col-span-2 space-y-3">
                <div className="flex items-center gap-3">
                  <ShieldCheck weight="duotone" className="h-6 w-6 text-success" />
                  <span className="font-display font-bold text-sm text-foreground">
                    Rastreamento Integral
                  </span>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  O módulo de auditoria no HelpDesk Pro grava alterações em <code className="font-mono text-primary bg-primary/10 px-1 rounded">tickets</code>, <code className="font-mono text-primary bg-primary/10 px-1 rounded">users</code> e <code className="font-mono text-primary bg-primary/10 px-1 rounded">settings</code>, possibilitando consultas jurídicas e gerenciais por período.
                </p>
              </div>
            </div>
          </SectionCard>
        )}

        {/* ======================= ABA 7: INTEGRAÇÕES ======================= */}
        {activeTab === "INTEGRACOES" && (
          <SectionCard
            title="Conectores Institucionais & Webhooks"
            description="Canais conectados à abertura de chamados e notificações corporativas."
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {/* WhatsApp Webhook Card */}
              <div className="p-5 rounded-2xl border border-border/60 bg-card hover:bg-muted/20 transition-colors space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-xl bg-success/10 text-success">
                      <Graph weight="duotone" className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-sm font-display font-bold text-foreground">
                        Conector WhatsApp API (Meta)
                      </p>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        Canal para abertura e notificações por celular
                      </p>
                    </div>
                  </div>
                  <Badge className="bg-success/10 text-success border-success/20 rounded-full px-3">
                    Conectado
                  </Badge>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-display font-bold text-muted-foreground uppercase tracking-wider">
                    Webhook URL Endpoint
                  </label>
                  <div className="flex items-center gap-2">
                    <Input
                      defaultValue="https://helpdesk.cgconstrucoes.com.br/api/webhooks/whatsapp"
                      readOnly
                      className="text-[11px] font-mono h-10 rounded-xl bg-background border-border/60"
                    />
                    <Button variant="outline" size="sm" className="h-10 rounded-xl shrink-0">
                      Testar
                    </Button>
                  </div>
                </div>
              </div>

              {/* SMTP / Email Card */}
              <div className="p-5 rounded-2xl border border-border/60 bg-card hover:bg-muted/20 transition-colors space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-xl bg-blue-500/10 text-blue-500">
                      <Export weight="duotone" className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-sm font-display font-bold text-foreground">
                        Integração SendGrid (E-mail)
                      </p>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        Notificações automáticas ao criar chamados e mais
                      </p>
                    </div>
                  </div>
                  <Badge className="bg-blue-500/10 text-blue-500 border-blue-500/20 rounded-full px-3">
                    Ativo (API Key)
                  </Badge>
                </div>
                <div className="space-y-3">
                  <label className="text-[10px] font-display font-bold text-muted-foreground uppercase tracking-wider">
                    E-mail de Teste
                  </label>
                  <div className="flex items-center gap-2">
                    <Input
                      type="email"
                      value={testEmail}
                      onChange={(e) => setTestEmail(e.target.value)}
                      placeholder="seu.email@exemplo.com"
                      className="text-[11px] font-mono h-10 rounded-xl bg-background border-border/60 flex-1"
                    />
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={handleTestEmail}
                      disabled={testingEmail || !testEmail}
                      className="h-10 rounded-xl shrink-0"
                    >
                      {testingEmail ? "Enviando..." : "Disparar Teste"}
                    </Button>
                  </div>
                  {testEmailSuccess && (
                    <p className="text-[11px] text-success font-medium flex items-center gap-1 mt-1">
                      <CheckCircle weight="fill" className="h-4 w-4" /> {testEmailSuccess}
                    </p>
                  )}
                  {testEmailError && (
                    <p className="text-[11px] text-danger font-medium flex items-center gap-1 mt-1">
                      <WarningCircle weight="fill" className="h-4 w-4" /> {testEmailError}
                    </p>
                  )}
                </div>
              </div>

              {/* IMAP Recebimento Card */}
              <div className="p-5 rounded-2xl border border-border/60 bg-card hover:bg-muted/20 transition-colors space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-xl bg-orange-500/10 text-orange-500">
                      <FileText weight="duotone" className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-sm font-display font-bold text-foreground">
                        Recebimento Automático de E-mails
                      </p>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        Ler caixa de entrada e criar chamados via IMAP + OAuth 2.0
                      </p>
                    </div>
                  </div>
                  {form.emailIntegrationStatus === "CONNECTED" && (
                    <Badge className="bg-success/10 text-success border-success/20 rounded-full px-3">
                      Conectado
                    </Badge>
                  )}
                  {form.emailIntegrationStatus === "DISCONNECTED" && (
                    <Badge className="bg-muted text-muted-foreground border-border/60 rounded-full px-3">
                      Desconectado
                    </Badge>
                  )}
                  {form.emailIntegrationStatus === "ERROR" && (
                    <Badge className="bg-danger/10 text-danger border-danger/20 rounded-full px-3">
                      Erro
                    </Badge>
                  )}
                </div>

                {form.emailIntegrationStatus === "ERROR" && form.emailCheckError && (
                  <div className="p-3 bg-danger/10 text-danger text-xs rounded-xl border border-danger/20">
                    {form.emailCheckError}
                  </div>
                )}

                <div className="flex flex-col gap-3 pt-2">
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Última verificação:</span>
                    <span className="font-medium text-foreground">{form.lastEmailCheck ? new Date(form.lastEmailCheck).toLocaleString('pt-BR') : 'Nunca'}</span>
                  </div>
                  <div className="flex justify-between text-xs mb-2">
                    <span className="text-muted-foreground">Último e-mail processado:</span>
                    <span className="font-medium text-foreground">{form.lastEmailProcessed ? new Date(form.lastEmailProcessed).toLocaleString('pt-BR') : 'Nenhum'}</span>
                  </div>

                  <div className="flex flex-col gap-3 mt-2">
                    <div className="grid grid-cols-2 gap-3">
                      <Button 
                        onClick={handleConnectGoogle} 
                        className="font-bold text-xs h-10 rounded-xl w-full" 
                        variant={form.emailIntegrationStatus === "CONNECTED" ? "outline" : "default"}
                      >
                        {form.emailIntegrationStatus === "CONNECTED" ? "Reconectar OAuth" : "Conectar Google Workspace"}
                      </Button>
                      <Button 
                        onClick={handleCheckNow} 
                        className="font-bold text-xs h-10 rounded-xl w-full"
                        variant="secondary"
                      >
                        Verificar Novos E-mails
                      </Button>
                    </div>
                    {form.emailIntegrationStatus === "CONNECTED" && (
                      <Button 
                        onClick={handleDisconnect} 
                        className="font-bold text-xs h-10 rounded-xl w-full text-danger border-danger/30 hover:bg-danger/10 hover:text-danger"
                        variant="outline"
                      >
                        Desconectar Conta
                      </Button>
                    )}
                  </div>
                  
                  <div className="mt-2 p-3 rounded-xl bg-primary/5 border border-primary/10 text-[10px] text-muted-foreground flex gap-2">
                    <CheckCircle className="h-3 w-3 text-primary shrink-0" />
                    <span>Requer configuração de <code>GOOGLE_CLIENT_ID</code> e <code>GOOGLE_CLIENT_SECRET</code> no servidor (`.env`) para funcionar corretamente. O cron pode ser chamado automaticamente via GET na rota <code>/api/email/check</code> usando o header Authorization.</span>
                  </div>
                </div>
              </div>

            </div>
          </SectionCard>
        )}

        {/* 8. ABA FERRAMENTAS — IMPORTAÇÃO CSV & RESET DE BANCO */}
        {activeTab === "FERRAMENTAS" && (
          <SectionCard
            title="Ferramentas & Manutenção do Banco de Dados"
            description="Importador inteligente de planilhas antigas e reinicialização segura de dados operacionais"
          >
            <div className="space-y-6">
              {/* Exportar Dados (Backup) */}
              <div className="glass-card rounded-[2rem] p-8 space-y-4">
                <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
                  <div className="flex items-start gap-4">
                    <div className="p-4 rounded-2xl bg-primary/10 text-primary shrink-0">
                      <FloppyDisk weight="duotone" className="h-8 w-8" />
                    </div>
                    <div>
                      <h3 className="text-lg font-display font-bold text-foreground">
                        Exportar Dados (Backup CSV)
                      </h3>
                      <p className="text-sm text-muted-foreground mt-2 max-w-2xl leading-relaxed">
                        Faça o backup dos seus chamados, lista de usuários, funcionários e serviços gerando uma planilha compatível com a nossa ferramenta de importação.
                      </p>
                    </div>
                  </div>
                  <Button
                    onClick={() => setExportModalOpen(true)}
                    className="shrink-0 font-semibold shadow-md h-12 px-6 rounded-xl w-full md:w-auto transition-all hover:shadow-lg"
                  >
                    <FloppyDisk className="h-5 w-5 mr-2" />
                    Exportar Backup
                  </Button>
                </div>
              </div>

              {/* Importador Inteligente de CSV */}
              <div className="glass-card rounded-[2rem] p-8 space-y-4">
                <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
                  <div className="flex items-start gap-4">
                    <div className="p-4 rounded-2xl bg-primary/10 text-primary shrink-0">
                      <Export weight="duotone" className="h-8 w-8" />
                    </div>
                    <div>
                      <h3 className="text-lg font-display font-bold text-foreground">
                        Importador Inteligente de Histórico CSV
                      </h3>
                      <p className="text-sm text-muted-foreground mt-2 max-w-2xl leading-relaxed">
                        Assistente em 5 etapas para importação de planilhas antigas. Mapeia colunas, prevê duplicidades, cria novos solicitantes e insere os registros preservando técnicos e serviços já cadastrados no banco.
                      </p>
                    </div>
                  </div>
                  <Button
                    onClick={() => setImportWizardOpen(true)}
                    className="shrink-0 font-semibold shadow-md h-12 px-6 rounded-xl w-full md:w-auto transition-all hover:shadow-lg"
                  >
                    <Export className="h-5 w-5 mr-2" />
                    Abrir Importador
                  </Button>
                </div>
              </div>

              {/* Reset Operacional do Banco */}
              <div className="glass-card !border-danger/30 !bg-danger/5 rounded-[2rem] p-8 space-y-4">
                <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
                  <div className="flex items-start gap-4">
                    <div className="p-4 rounded-2xl bg-danger/10 text-danger shrink-0">
                      <Trash weight="duotone" className="h-8 w-8" />
                    </div>
                    <div>
                      <div className="flex items-center gap-3">
                        <h3 className="text-lg font-display font-bold text-foreground">
                          Reset de Dados Operacionais
                        </h3>
                        <Badge className="bg-danger/10 text-danger border-danger/20 rounded-full px-3">
                          Ação Crítica
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground mt-2 max-w-2xl leading-relaxed">
                        Exclui todos os chamados, comentários, anexos e histórico operacional do sistema, mantendo a estrutura institucional intacta (Empresa, Setores, Serviços, Usuários e RBAC).
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="destructive"
                    onClick={() => setResetModalOpen(true)}
                    className="shrink-0 font-semibold shadow-md h-12 px-6 rounded-xl w-full md:w-auto transition-all hover:shadow-lg"
                  >
                    <Trash className="h-5 w-5 mr-2" />
                    Resetar Banco
                  </Button>
                </div>
              </div>
            </div>
          </SectionCard>
        )}
      </div>

      {/* MODAL DE EXPORTAÇÃO */}
      {exportModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-md p-4">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full max-w-md rounded-[2rem] border border-border bg-card p-8 shadow-2xl space-y-6"
          >
            <div className="flex items-center gap-4">
              <div className="p-4 rounded-2xl bg-primary/10 text-primary">
                <FloppyDisk weight="duotone" className="h-8 w-8" />
              </div>
              <div>
                <h3 className="text-xl font-display font-bold text-foreground">
                  Exportar Backup
                </h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Selecione o que deseja exportar.
                </p>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-xs font-display font-bold text-foreground uppercase tracking-widest block mb-2">
                  Tipo de Exportação
                </label>
                <select
                  value={exportType}
                  onChange={(e) => setExportType(e.target.value)}
                  className="w-full h-11 px-3 rounded-xl border border-input bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="tickets">Chamados</option>
                  <option value="requesters">Funcionários (Solicitantes)</option>
                  <option value="users">Usuários (Técnicos)</option>
                  <option value="services">Serviços</option>
                  <option value="emails">E-mails Recebidos</option>
                </select>
              </div>
              
              {exportType === "tickets" && (
                <div>
                  <label className="text-xs font-display font-bold text-foreground uppercase tracking-widest block mb-2">
                    Mês de Referência (Opcional)
                  </label>
                  <select
                    value={exportMonth}
                    onChange={(e) => setExportMonth(e.target.value)}
                    className="w-full h-11 px-3 rounded-xl border border-input bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                  >
                    <option value="all">Todos os Meses</option>
                    <option value="07-2026">Julho 2026</option>
                    <option value="08-2026">Agosto 2026</option>
                    <option value="09-2026">Setembro 2026</option>
                    <option value="10-2026">Outubro 2026</option>
                    <option value="11-2026">Novembro 2026</option>
                    <option value="12-2026">Dezembro 2026</option>
                  </select>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-3 pt-2 border-t border-border/60">
              <Button
                variant="outline"
                className="h-11 rounded-xl"
                onClick={() => setExportModalOpen(false)}
                disabled={exporting}
              >
                Cancelar
              </Button>
              <Button
                onClick={handleExportData}
                disabled={exporting}
                className="h-11 rounded-xl"
              >
                {exporting ? "Gerando..." : "Baixar CSV"}
              </Button>
            </div>
          </motion.div>
        </div>
      )}

      {/* MODAL DO IMPORTADOR CSV */}
      <CsvImportWizard
        open={importWizardOpen}
        onClose={() => setImportWizardOpen(false)}
      />

      {/* MODAL DE CONFIRMAÇÃO DE RESET DO BANCO */}
      {resetModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-md p-4">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full max-w-md rounded-[2rem] border border-border bg-card p-8 shadow-2xl space-y-6"
          >
            <div className="flex items-center gap-4">
              <div className="p-4 rounded-2xl bg-danger/10 text-danger">
                <Warning weight="duotone" className="h-8 w-8" />
              </div>
              <div>
                <h3 className="text-xl font-display font-bold text-foreground">
                  Confirmar Reset
                </h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Todos os dados operacionais serão excluídos.
                </p>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-muted/50 border border-border/60 text-sm text-muted-foreground space-y-2">
              <p className="font-bold text-foreground">Registros preservados:</p>
              <p>Empresa, Configurações, Setores, Serviços, Usuários, Cargos e Tema.</p>
            </div>

            <div className="space-y-3">
              <label className="text-xs font-display font-bold text-foreground uppercase tracking-widest">
                Digite <span className="text-danger">RESETAR</span> para confirmar:
              </label>
              <Input
                value={resetConfirmText}
                onChange={(e) => setResetConfirmText(e.target.value)}
                placeholder="RESETAR"
                className="font-mono text-center tracking-widest uppercase font-bold h-12 rounded-xl"
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-4">
              <Button
                variant="outline"
                onClick={() => {
                  setResetModalOpen(false);
                  setResetConfirmText("");
                }}
                disabled={resetting}
                className="h-12 px-6 rounded-xl"
              >
                Cancelar
              </Button>
              <Button
                variant="destructive"
                disabled={resetConfirmText !== "RESETAR" || resetting}
                onClick={handleResetDatabase}
                className="h-12 px-6 rounded-xl font-bold"
              >
                {resetting ? "Resetando..." : "Confirmar Reset"}
              </Button>
            </div>
          </motion.div>
        </div>
      )}
    </motion.div>
  );
}
