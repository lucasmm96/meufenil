import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { RegistroDTO } from "@/react-app/services/registros.service";

export type FormatoExportacao = "csv" | "json" | "pdf";

function dataFormatada(data: string): string {
  return format(new Date(data + "T12:00:00"), "dd/MM/yyyy", { locale: ptBR });
}

function nomePadrao(formato: FormatoExportacao): string {
  const hoje = format(new Date(), "yyyy-MM-dd");
  return `historico-fenil-${hoje}.${formato}`;
}

function triggerDownload(blob: Blob, nome: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nome;
  a.click();
  URL.revokeObjectURL(url);
}

export function gerarConteudoCSV(registros: RegistroDTO[]): string {
  const cabecalho = ["Data", "Alimento", "Peso (g)", "Fenilalanina (mg)"];
  const linhas = registros.map((r) => [
    dataFormatada(r.data),
    `"${r.nome_alimento.replace(/"/g, '""')}"`,
    r.peso_g.toString(),
    r.fenil_mg.toFixed(1),
  ]);
  return [cabecalho.join(";"), ...linhas.map((l) => l.join(";"))].join("\r\n");
}

export function exportarCSV(registros: RegistroDTO[]): void {
  const conteudo = "﻿" + gerarConteudoCSV(registros);
  const blob = new Blob([conteudo], { type: "text/csv;charset=utf-8;" });
  triggerDownload(blob, nomePadrao("csv"));
}

export interface RegistroExportadoJSON {
  data: string;
  data_formatada: string;
  nome_alimento: string;
  peso_g: number;
  fenil_mg: number;
}

export function gerarConteudoJSON(registros: RegistroDTO[]): RegistroExportadoJSON[] {
  return registros.map((r) => ({
    data: r.data,
    data_formatada: dataFormatada(r.data),
    nome_alimento: r.nome_alimento,
    peso_g: r.peso_g,
    fenil_mg: r.fenil_mg,
  }));
}

export function exportarJSON(registros: RegistroDTO[]): void {
  const dados = gerarConteudoJSON(registros);
  const blob = new Blob([JSON.stringify(dados, null, 2)], {
    type: "application/json;charset=utf-8;",
  });
  triggerDownload(blob, nomePadrao("json"));
}

export interface OpcoesExportacaoPDF {
  nomeUsuario?: string | null;
  dataInicio?: string;
  dataFim?: string;
}

export function derivarPeriodoPDF(
  registros: RegistroDTO[],
  opcoes: Pick<OpcoesExportacaoPDF, "dataInicio" | "dataFim">
): { inicio: string; fim: string } | null {
  const datas = registros.map((r) => r.data).sort();
  const rawInicio = opcoes.dataInicio || datas[0];
  const rawFim = opcoes.dataFim || datas[datas.length - 1];
  if (!rawInicio || !rawFim) return null;
  return { inicio: dataFormatada(rawInicio), fim: dataFormatada(rawFim) };
}

export async function exportarPDF(
  registros: RegistroDTO[],
  opcoes: OpcoesExportacaoPDF = {}
): Promise<void> {
  const { jsPDF } = await import("jspdf");
  const { default: autoTable } = await import("jspdf-autotable");

  const doc = new jsPDF();

  doc.setFontSize(16);
  doc.text("Histórico de Fenilalanina", 14, 15);

  doc.setFontSize(11);
  doc.text(`Paciente: ${opcoes.nomeUsuario?.trim() || "Não informado"}`, 14, 23);

  const periodo = derivarPeriodoPDF(registros, opcoes);
  const periodoTexto = periodo ? `  •  Período: ${periodo.inicio} à ${periodo.fim}` : "";
  doc.setFontSize(10);
  doc.text(
    `Gerado em: ${format(new Date(), "dd/MM/yyyy", { locale: ptBR })}${periodoTexto}`,
    14,
    30
  );

  autoTable(doc, {
    startY: 38,
    head: [["Data", "Alimento", "Peso (g)", "Fenilalanina (mg)"]],
    body: registros.map((r) => [
      dataFormatada(r.data),
      r.nome_alimento,
      r.peso_g.toString(),
      r.fenil_mg.toFixed(1),
    ]),
    styles: { font: "helvetica", fontSize: 9 },
    headStyles: { fillColor: [79, 70, 229] },
  });

  doc.save(nomePadrao("pdf"));
}
