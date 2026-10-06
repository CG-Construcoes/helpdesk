import { prisma } from "@/lib/prisma";

export interface CorporateSettingsDTO {
  id?: string;
  companyId: string;
  systemName: string;
  theme: string;
  primaryColor: string;
  secondaryColor: string;
  department: string;
  cnpj: string;
  phone: string;
  email: string;
  website: string;
  address: string;
  favicon: string;
  borderRadius: string;
  compactMode: boolean;
  allowRegistration: boolean;
  minPasswordLen: number;
  sessionTimeoutMin: number;
  requireFirstAccess: boolean;
  maxLoginAttempts: number;
  defaultStatus: string;
  defaultOrigin: string;
  defaultPriority: string;
  defaultSlaHours: number;
  autoArchive: boolean;
  archiveDays: number;
  monthlyNumbering: boolean;
  reportShowLogo: boolean;
  reportShowFooter: boolean;
  reportDefaultTheme: string;
  auditRetentionDays: number;
  auditLogEnabled: boolean;
  googleRefreshToken?: string | null;
  emailIntegrationStatus?: string;
  lastEmailCheck?: Date | null;
  lastEmailProcessed?: Date | null;
  emailCheckError?: string | null;
  recessActive?: boolean;
  recessReturnDate?: string | null;
}

const DEFAULT_COMPANY_ID = "cg-construcoes-001";

export async function getCorporateSettings(): Promise<CorporateSettingsDTO> {
  // Busca ou cria a configuração padrão da CG Construções
  let settings = await prisma.settings.findFirst({
    where: {
      OR: [
        { companyId: DEFAULT_COMPANY_ID },
        { company: { name: { contains: "CG" } } },
      ],
    },
  });

  if (!settings) {
    // Garante que existe a empresa CG Construções
    let company = await prisma.company.findFirst();
    if (!company) {
      company = await prisma.company.create({
        data: {
          id: DEFAULT_COMPANY_ID,
          name: "CG Construções",
          logo: "/cg-logo.png",
          active: true,
        },
      });
    }

    settings = await prisma.settings.create({
      data: {
        companyId: company.id,
        systemName: "CG Construções HelpDesk Pro",
        theme: "system",
        primaryColor: "#2563eb",
        secondaryColor: "#f1f5f9",
        department: "Departamento de TI",
        cnpj: "12.345.678/0001-99",
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
      },
    });
  }

  return {
    id: settings.id,
    companyId: settings.companyId,
    systemName: settings.systemName,
    theme: settings.theme,
    primaryColor: settings.primaryColor,
    secondaryColor: settings.secondaryColor,
    department: (settings as any).department ?? "Departamento de TI",
    cnpj: (settings as any).cnpj ?? "12.345.678/0001-99",
    phone: (settings as any).phone ?? "(11) 3456-7890",
    email: (settings as any).email ?? "ti@cgconstrucoes.com.br",
    website: (settings as any).website ?? "www.cgconstrucoes.com.br",
    address: (settings as any).address ?? "Av. Principal, 1000 - Centro",
    favicon: (settings as any).favicon ?? "/cg-logo.png",
    borderRadius: (settings as any).borderRadius ?? "0.5rem",
    compactMode: (settings as any).compactMode ?? false,
    allowRegistration: (settings as any).allowRegistration ?? false,
    minPasswordLen: (settings as any).minPasswordLen ?? 8,
    sessionTimeoutMin: (settings as any).sessionTimeoutMin ?? 120,
    requireFirstAccess: (settings as any).requireFirstAccess ?? true,
    maxLoginAttempts: (settings as any).maxLoginAttempts ?? 5,
    defaultStatus: (settings as any).defaultStatus ?? "ABERTO",
    defaultOrigin: (settings as any).defaultOrigin ?? "MANUAL",
    defaultPriority: (settings as any).defaultPriority ?? "MEDIA",
    defaultSlaHours: (settings as any).defaultSlaHours ?? 24,
    autoArchive: (settings as any).autoArchive ?? true,
    archiveDays: (settings as any).archiveDays ?? 30,
    monthlyNumbering: (settings as any).monthlyNumbering ?? true,
    reportShowLogo: (settings as any).reportShowLogo ?? true,
    reportShowFooter: (settings as any).reportShowFooter ?? true,
    reportDefaultTheme: (settings as any).reportDefaultTheme ?? "LIGHT",
    auditRetentionDays: (settings as any).auditRetentionDays ?? 90,
    auditLogEnabled: (settings as any).auditLogEnabled ?? true,
    googleRefreshToken: (settings as any).googleRefreshToken,
    emailIntegrationStatus: (settings as any).emailIntegrationStatus,
    lastEmailCheck: (settings as any).lastEmailCheck,
    lastEmailProcessed: (settings as any).lastEmailProcessed,
    emailCheckError: (settings as any).emailCheckError,
  };
}

export async function updateCorporateSettings(
  data: Partial<CorporateSettingsDTO>,
  actorId?: string,
  actorName?: string
): Promise<CorporateSettingsDTO> {
  const current = await getCorporateSettings();

  const updated = await prisma.settings.update({
    where: { id: current.id },
    data: {
      systemName: data.systemName ?? current.systemName,
      theme: data.theme ?? current.theme,
      primaryColor: data.primaryColor ?? current.primaryColor,
      secondaryColor: data.secondaryColor ?? current.secondaryColor,
      department: data.department ?? current.department,
      cnpj: data.cnpj ?? current.cnpj,
      phone: data.phone ?? current.phone,
      email: data.email ?? current.email,
      website: data.website ?? current.website,
      address: data.address ?? current.address,
      favicon: data.favicon ?? current.favicon,
      borderRadius: data.borderRadius ?? current.borderRadius,
      compactMode: data.compactMode ?? current.compactMode,
      allowRegistration: data.allowRegistration ?? current.allowRegistration,
      minPasswordLen: data.minPasswordLen ?? current.minPasswordLen,
      sessionTimeoutMin: data.sessionTimeoutMin ?? current.sessionTimeoutMin,
      requireFirstAccess: data.requireFirstAccess ?? current.requireFirstAccess,
      maxLoginAttempts: data.maxLoginAttempts ?? current.maxLoginAttempts,
      defaultStatus: data.defaultStatus ?? current.defaultStatus,
      defaultOrigin: data.defaultOrigin ?? current.defaultOrigin,
      defaultPriority: data.defaultPriority ?? current.defaultPriority,
      defaultSlaHours: data.defaultSlaHours ?? current.defaultSlaHours,
      autoArchive: data.autoArchive ?? current.autoArchive,
      archiveDays: data.archiveDays ?? current.archiveDays,
      monthlyNumbering: data.monthlyNumbering ?? current.monthlyNumbering,
      reportShowLogo: data.reportShowLogo ?? current.reportShowLogo,
      reportShowFooter: data.reportShowFooter ?? current.reportShowFooter,
      reportDefaultTheme: data.reportDefaultTheme ?? current.reportDefaultTheme,
      auditRetentionDays: data.auditRetentionDays ?? current.auditRetentionDays,
      auditLogEnabled: data.auditLogEnabled ?? current.auditLogEnabled,
      googleRefreshToken: data.googleRefreshToken !== undefined ? data.googleRefreshToken : current.googleRefreshToken,
      emailIntegrationStatus: data.emailIntegrationStatus !== undefined ? data.emailIntegrationStatus : current.emailIntegrationStatus,
      lastEmailCheck: data.lastEmailCheck !== undefined ? data.lastEmailCheck : current.lastEmailCheck,
      lastEmailProcessed: data.lastEmailProcessed !== undefined ? data.lastEmailProcessed : current.lastEmailProcessed,
      emailCheckError: data.emailCheckError !== undefined ? data.emailCheckError : current.emailCheckError,
    },
  });

  // Grava log de auditoria da alteração de configurações
  try {
    await prisma.auditLog.create({
      data: {
        userId: actorId || null,
        action: "UPDATE_CORPORATE_SETTINGS",
        entity: "Settings",
        entityId: updated.id,
        details: JSON.stringify({
          previous: current,
          new: data,
          actor: actorName || "Administrador",
        }),
      },
    });
  } catch (err) {
    console.warn("Aviso ao salvar log de auditoria das configurações:", err);
  }

  return {
    id: updated.id,
    companyId: updated.companyId,
    systemName: updated.systemName,
    theme: updated.theme,
    primaryColor: updated.primaryColor,
    secondaryColor: updated.secondaryColor,
    department: (updated as any).department ?? "Departamento de TI",
    cnpj: (updated as any).cnpj ?? "12.345.678/0001-99",
    phone: (updated as any).phone ?? "(11) 3456-7890",
    email: (updated as any).email ?? "ti@cgconstrucoes.com.br",
    website: (updated as any).website ?? "www.cgconstrucoes.com.br",
    address: (updated as any).address ?? "Av. Principal, 1000 - Centro",
    favicon: (updated as any).favicon ?? "/cg-logo.png",
    borderRadius: (updated as any).borderRadius ?? "0.5rem",
    compactMode: (updated as any).compactMode ?? false,
    allowRegistration: (updated as any).allowRegistration ?? false,
    minPasswordLen: (updated as any).minPasswordLen ?? 8,
    sessionTimeoutMin: (updated as any).sessionTimeoutMin ?? 120,
    requireFirstAccess: (updated as any).requireFirstAccess ?? true,
    maxLoginAttempts: (updated as any).maxLoginAttempts ?? 5,
    defaultStatus: (updated as any).defaultStatus ?? "ABERTO",
    defaultOrigin: (updated as any).defaultOrigin ?? "MANUAL",
    defaultPriority: (updated as any).defaultPriority ?? "MEDIA",
    defaultSlaHours: (updated as any).defaultSlaHours ?? 24,
    autoArchive: (updated as any).autoArchive ?? true,
    archiveDays: (updated as any).archiveDays ?? 30,
    monthlyNumbering: (updated as any).monthlyNumbering ?? true,
    reportShowLogo: (updated as any).reportShowLogo ?? true,
    reportShowFooter: (updated as any).reportShowFooter ?? true,
    reportDefaultTheme: (updated as any).reportDefaultTheme ?? "LIGHT",
    auditRetentionDays: (updated as any).auditRetentionDays ?? 90,
    auditLogEnabled: (updated as any).auditLogEnabled ?? true,
    googleRefreshToken: (updated as any).googleRefreshToken,
    emailIntegrationStatus: (updated as any).emailIntegrationStatus,
    lastEmailCheck: (updated as any).lastEmailCheck,
    lastEmailProcessed: (updated as any).lastEmailProcessed,
    emailCheckError: (updated as any).emailCheckError,
  };
}
