/**
 * Export PDF générique, réutilisé par toutes les pages qui ont un bouton
 * « Exporter » (Historique, Monitoring…). Génère un vrai fichier .pdf
 * téléchargé côté client — pas d'appel backend, le tableau exporté est
 * exactement ce que l'utilisateur voit à l'écran au moment du clic
 * (déjà filtré/trié par la page).
 */
import { jsPDF } from 'jspdf'
import { autoTable } from 'jspdf-autotable'

export interface ExportPdfColumn {
  header: string
  key: string
}

export interface ExportPdfOptions {
  /** Titre affiché en haut du document. */
  title: string
  /** Ligne secondaire optionnelle (ex: région, période). */
  subtitle?: string
  columns: ExportPdfColumn[]
  rows: Record<string, string | number>[]
  /** Nom du fichier téléchargé, avec extension .pdf. */
  filename: string
}

export function exportTableToPdf({ title, subtitle, columns, rows, filename }: ExportPdfOptions): void {
  const doc = new jsPDF({ orientation: 'landscape' })

  doc.setFontSize(15)
  doc.setTextColor(6, 35, 52)
  doc.text(title, 14, 15)

  let cursorY = 15
  if (subtitle) {
    cursorY += 6
    doc.setFontSize(10)
    doc.setTextColor(100, 100, 100)
    doc.text(subtitle, 14, cursorY)
  }

  cursorY += 6
  doc.setFontSize(8.5)
  doc.setTextColor(150, 150, 150)
  doc.text(`Généré le ${new Date().toLocaleString('fr-FR')} — données de démonstration`, 14, cursorY)

  autoTable(doc, {
    startY: cursorY + 5,
    head: [columns.map((c) => c.header)],
    body: rows.map((row) => columns.map((c) => String(row[c.key] ?? ''))),
    styles: { fontSize: 8.5, cellPadding: 2.5 },
    headStyles: { fillColor: [6, 35, 52], textColor: 255, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [245, 247, 250] },
    margin: { left: 14, right: 14 },
  })

  doc.save(filename)
}
