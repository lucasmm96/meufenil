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

export async function exportarPDF(registros: RegistroDTO[]): Promise<void> {
  const { jsPDF } = await import("jspdf");
  const { default: autoTable } = await import("jspdf-autotable");

  const doc = new jsPDF();

  doc.setFontSize(16);
  doc.text("Histórico de Fenilalanina", 14, 15);
  doc.setFontSize(10);
  doc.text(
    `Gerado em: ${format(new Date(), "dd/MM/yyyy", { locale: ptBR })}`,
    14,
    23
  );

  autoTable(doc, {
    startY: 30,
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
