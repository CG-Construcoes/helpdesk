"use client";

import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Sun,
  Moon,
  Building2,
  Layout,
  Download,
} from "lucide-react";

export type PDFTheme = "LIGHT" | "DARK";
export type ReportMode =
  | "EXECUTIVO"
  | "OPERACIONAL"
  | "PRODUTIVIDADE"
  | "PERFORMANCE"
  | "PERSONALIZADO";

export interface ExportPDFModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentMode: ReportMode;
  periodLabel?: string;
  onGeneratePDF: (config: {
    theme: PDFTheme;
    mode: ReportMode;
  }) => void;
}

export function ExportPDFModal({
  open,
  onOpenChange,
  currentMode,
  periodLabel = "Últimos 30 dias",
  onGeneratePDF,
}: ExportPDFModalProps) {
  const [theme, setTheme] = useState<PDFTheme>("LIGHT");
  const [mode, setMode] = useState<ReportMode>(currentMode);
  const [isLoading, setIsLoading] = useState(false);

  React.useEffect(() => {
    fetch('/api/settings').then(res => res.json()).then(data => {
      if (data?.reportDefaultTheme) {
        setTheme(data.reportDefaultTheme);
      }
    }).catch(() => {});
  }, []);

  const handleConfirm = async () => {
    setIsLoading(true);
    try {
      await onGeneratePDF({ theme, mode });
    } finally {
      setIsLoading(false);
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[540px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Download className="h-5 w-5 text-primary" />
            Exportar Relatório Executivo Institucional
          </DialogTitle>
          <DialogDescription>
            O relatório será consolidado no backend com dados rigorosos de SLA e E-mail, gerando um documento corporativo A4 estruturado.
          </DialogDescription>
        </DialogHeader>

        <div className="py-3 space-y-5">
          {/* LAYOUT EXECUTIVO RETRATO (A4) INFORMATIVO */}
          <div className="p-3.5 rounded-xl border border-primary/20 bg-primary/5 flex items-start gap-3">
            <Layout className="h-5 w-5 text-primary shrink-0 mt-0.5" />
            <div className="space-y-0.5">
              <div className="flex items-center gap-2">
                <span className="font-bold text-sm text-foreground">
                  Formato Retrato (Portrait) A4
                </span>
                <Badge variant="default" className="text-[10px] px-1.5 py-0.5">
                  Automático
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                O documento possui 3 páginas dedicadas: Visão Executiva, Desempenho Operacional e Atenção a Críticos.
              </p>
            </div>
          </div>

          {/* SELEÇÃO DE TEMA (CLARO / ESCURO) */}
          <div>
            <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground block mb-2">
              Tema do Documento PDF
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setTheme("LIGHT")}
                className={`flex items-center gap-3 p-3 rounded-lg border text-left transition-all ${
                  theme === "LIGHT"
                    ? "border-primary bg-primary/10 ring-2 ring-primary"
                    : "border-border hover:bg-muted/40"
                }`}
              >
                <div className="p-2 rounded-md bg-amber-500/10 text-amber-500">
                  <Sun className="h-4 w-4" />
                </div>
                <div>
                  <p className="font-bold text-sm text-foreground">Tema Claro</p>
                  <p className="text-[11px] text-muted-foreground">
                    Fundo branco corporativo
                  </p>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setTheme("DARK")}
                className={`flex items-center gap-3 p-3 rounded-lg border text-left transition-all ${
                  theme === "DARK"
                    ? "border-primary bg-primary/10 ring-2 ring-primary"
                    : "border-border hover:bg-muted/40"
                }`}
              >
                <div className="p-2 rounded-md bg-blue-500/10 text-blue-500">
                  <Moon className="h-4 w-4" />
                </div>
                <div>
                  <p className="font-bold text-sm text-foreground">Tema Escuro</p>
                  <p className="text-[11px] text-muted-foreground">
                    Tons ardósia e tela
                  </p>
                </div>
              </button>
            </div>
          </div>

          {/* RESUMO DO CABEÇALHO E RODAPÉ GERADO */}
          <div className="bg-muted/30 border border-border rounded-lg p-3 text-xs space-y-1">
            <div className="flex items-center justify-between font-semibold text-foreground">
              <span className="flex items-center gap-1.5">
                <Building2 className="h-3.5 w-3.5 text-primary" />
                CG Construções — HelpDesk Pro
              </span>
              <span>Depto. de TI</span>
            </div>
            <div className="flex items-center justify-between text-muted-foreground text-[11px]">
              <span>Período: {periodLabel}</span>
              <span>Orientação: A4 Retrato ({theme === "LIGHT" ? "Claro" : "Escuro"})</span>
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2 mt-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isLoading}>
            Cancelar
          </Button>
          <Button onClick={handleConfirm} className="font-semibold" disabled={isLoading}>
            <Download className="h-4 w-4 mr-1.5" />
            {isLoading ? "Gerando..." : "Gerar Relatório Completo"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
