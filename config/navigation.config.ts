import {
  SquaresFour,
  Ticket,
  Users,
  Stack,
  Buildings,
  UserList,
  ChartBar,
  Gear,
  EnvelopeSimple,
  type IconProps
} from "@phosphor-icons/react";
import React from "react";

export interface NavigationItem {
  title: string;
  href: string;
  icon: React.ElementType<IconProps>;
  description: string;
}

export const NAVIGATION_ITEMS: NavigationItem[] = [
  {
    title: "Dashboard",
    href: "/dashboard",
    icon: SquaresFour,
    description: "Visão geral e indicadores",
  },
  {
    title: "Chamados",
    href: "/chamados",
    icon: Ticket,
    description: "Gestão de chamados e suporte",
  },
  {
    title: "Usuários",
    href: "/usuarios",
    icon: Users,
    description: "Técnicos e administradores",
  },
  {
    title: "Serviços",
    href: "/servicos",
    icon: Stack,
    description: "Catálogo de serviços",
  },
  {
    title: "Setores",
    href: "/setores",
    icon: Buildings,
    description: "Estrutura e departamentos",
  },
  {
    title: "Solicitantes",
    href: "/solicitantes",
    icon: UserList,
    description: "Clientes e solicitantes",
  },
  {
    title: "Relatórios",
    href: "/relatorios",
    icon: ChartBar,
    description: "Estatísticas e relatórios",
  },
  {
    title: "E-mails",
    href: "/emails-recebidos", // A rota pode continuar a mesma ou podemos mudar depois
    icon: EnvelopeSimple,
    description: "Gerenciar e-mails enviados e recebidos",
  },
  {
    title: "Configurações",
    href: "/configuracoes",
    icon: Gear,
    description: "Parâmetros do sistema e White Label",
  },
];
