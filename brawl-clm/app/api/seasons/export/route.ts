import ExcelJS from 'exceljs';
import { NextRequest, NextResponse } from 'next/server';
import {
  exportSeasonRowsServer,
  getActiveSeasonServer,
  getClubsForSeasonServer,
} from '@/lib/server/dashboard';
import { requireStaff } from '@/lib/server/auth';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const runtime = 'nodejs';

type ExportRow = Awaited<ReturnType<typeof exportSeasonRowsServer>>[number];
type ClubRow = Awaited<ReturnType<typeof getClubsForSeasonServer>>[number];

const TITLE_FILL = {
  type: 'pattern' as const,
  pattern: 'solid' as const,
  fgColor: { argb: 'FF0F172A' },
};

const HEADER_FILL = {
  type: 'pattern' as const,
  pattern: 'solid' as const,
  fgColor: { argb: 'FF111827' },
};

const SUMMARY_FILL = {
  type: 'pattern' as const,
  pattern: 'solid' as const,
  fgColor: { argb: 'FFF8FAFC' },
};

const BAD_FILL = {
  type: 'pattern' as const,
  pattern: 'solid' as const,
  fgColor: { argb: 'FFFDE2E2' },
};

const BLUE_FILL = {
  type: 'pattern' as const,
  pattern: 'solid' as const,
  fgColor: { argb: 'FFDBEAFE' },
};

const GOOD_FILL = {
  type: 'pattern' as const,
  pattern: 'solid' as const,
  fgColor: { argb: 'FFD9FBE7' },
};

const CARD_FILL = {
  type: 'pattern' as const,
  pattern: 'solid' as const,
  fgColor: { argb: 'FF0B1220' },
};

const THIN_BORDER = {
  top: { style: 'thin' as const, color: { argb: 'FF334155' } },
  left: { style: 'thin' as const, color: { argb: 'FF334155' } },
  bottom: { style: 'thin' as const, color: { argb: 'FF334155' } },
  right: { style: 'thin' as const, color: { argb: 'FF334155' } },
};

function safeFileName(value: string) {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9-_]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase();
}

function uniqueSheetName(value: string, used: Set<string>) {
  const normalized =
    value
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[\\/?*\[\]:]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim() || 'Club';

  let candidate = normalized.slice(0, 31);
  let index = 2;

  while (used.has(candidate)) {
    const suffix = ` ${index}`;
    candidate = `${normalized.slice(0, Math.max(0, 31 - suffix.length))}${suffix}`;
    index += 1;
  }

  used.add(candidate);
  return candidate;
}

function formatDateTime(value?: string | null) {
  if (!value) return '--';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '--';

  return new Intl.DateTimeFormat('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Europe/Paris',
  }).format(date);
}

function formatDateOnly(value?: string | null) {
  if (!value) return '--';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '--';

  return new Intl.DateTimeFormat('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZone: 'Europe/Paris',
  }).format(date);
}

function roleRank(role: string) {
  if (role === 'Président') return 0;
  if (role === 'Vice-président') return 1;
  return 2;
}

function numberValue(value: unknown) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function getPerformanceStatus(
  push: number,
  objective: number,
  bigObjective: number,
): 'bad' | 'neutral' | 'blue' | 'good' {
  if (bigObjective > 0 && push >= bigObjective) return 'good';
  if (bigObjective > 0 && push >= bigObjective / 2) return 'blue';
  if (objective > 0 && push < objective) return 'bad';
  return 'neutral';
}

function getPerformanceLabel(push: number, objective: number, bigObjective: number) {
  const status = getPerformanceStatus(push, objective, bigObjective);

  if (status === 'good') return 'Gros objectif atteint';
  if (status === 'blue') return 'Moitié du gros objectif atteinte';
  if (status === 'bad') return 'Sous objectif';
  return 'Objectif atteint';
}

function getFillForStatus(status: 'bad' | 'neutral' | 'blue' | 'good') {
  if (status === 'good') return GOOD_FILL;
  if (status === 'blue') return BLUE_FILL;
  if (status === 'bad') return BAD_FILL;
  return undefined;
}

function getMemberStatusLabel(status?: string | null, isNew?: boolean, joinedAt?: string | null) {
  if (isNew) return `Nouveau - arrivé le ${formatDateOnly(joinedAt)}`;
  if (status === 'left') return 'Ex-membre';
  if (status === 'inactive') return 'Inactif';
  return 'Actif';
}

function applyCardCell(sheet: ExcelJS.Worksheet, ref: string) {
  const cell = sheet.getCell(ref);
  cell.fill = CARD_FILL;
  cell.border = THIN_BORDER;
  return cell;
}

function addInfoRow(
  sheet: ExcelJS.Worksheet,
  rowIndex: number,
  label: string,
  value: string | number,
) {
  const labelCell = applyCardCell(sheet, `A${rowIndex}`);
  sheet.mergeCells(`B${rowIndex}:D${rowIndex}`);
  const valueCell = applyCardCell(sheet, `B${rowIndex}`);

  labelCell.value = label;
  valueCell.value = value;

  labelCell.font = { color: { argb: 'FFCBD5E1' }, bold: true };
  valueCell.font = { color: { argb: 'FFFFFFFF' } };
}

function addStatRow(
  sheet: ExcelJS.Worksheet,
  rowIndex: number,
  label: string,
  value: string | number,
  numFmt?: string,
) {
  const labelCell = applyCardCell(sheet, `F${rowIndex}`);
  sheet.mergeCells(`G${rowIndex}:H${rowIndex}`);
  const valueCell = applyCardCell(sheet, `G${rowIndex}`);

  labelCell.value = label;
  valueCell.value = value;

  if (numFmt) valueCell.numFmt = numFmt;

  labelCell.font = { color: { argb: 'FFCBD5E1' }, bold: true };
  valueCell.font = { color: { argb: 'FFFFFFFF' }, bold: true };
}

function addClubSheet(
  workbook: ExcelJS.Workbook,
  sheetName: string,
  club: ClubRow,
  rows: ExportRow[],
  season: {
    name: string;
    seasonNumber?: number | null;
    startsAt?: string | null;
    endsAt?: string | null;
  },
) {
  const sheet = workbook.addWorksheet(sheetName);
  sheet.properties.defaultRowHeight = 22;
  sheet.views = [{ state: 'frozen', ySplit: 8 }];

  sheet.columns = [
    { key: 'name', width: 24 },
    { key: 'role', width: 18 },
    { key: 'memberStatus', width: 28 },
    { key: 'start', width: 16 },
    { key: 'end', width: 16 },
    { key: 'push', width: 14 },
    { key: 'objective', width: 16 },
    { key: 'bigObjective', width: 18 },
    { key: 'result', width: 24 },
    { key: 'notes', width: 34 },
  ];

  sheet.mergeCells('A1:J1');
  const titleCell = sheet.getCell('A1');
  titleCell.value = `${club.name} - Détail saison`;
  titleCell.fill = TITLE_FILL;
  titleCell.font = { color: { argb: 'FFFFFFFF' }, bold: true, size: 16 };
  titleCell.alignment = { vertical: 'middle', horizontal: 'left' };

  sheet.mergeCells('A2:J2');
  const subtitleCell = sheet.getCell('A2');
  subtitleCell.value = `${season.name} • ${season.seasonNumber ? `Saison ${season.seasonNumber}` : 'Saison active'} • Export du ${formatDateTime(new Date().toISOString())}`;
  subtitleCell.font = { color: { argb: 'FFCBD5E1' }, italic: true };
  subtitleCell.alignment = { vertical: 'middle', horizontal: 'left' };

  addInfoRow(sheet, 4, 'Club', club.name);
  addInfoRow(sheet, 5, 'Power rank', club.powerRank);
  addInfoRow(sheet, 6, 'Début saison', formatDateTime(season.startsAt));
  addInfoRow(sheet, 7, 'Fin saison', season.endsAt ? formatDateTime(season.endsAt) : '--');

  addStatRow(sheet, 4, 'Objectif club', numberValue(club.objective), '#,##0');
  addStatRow(sheet, 5, 'Gros objectif', numberValue(club.bigObjective), '#,##0');
  addStatRow(sheet, 6, 'Membres exportés', rows.length, '0');

  const headerRowIndex = 9;
  const headers = [
    'Pseudo',
    'Rôle',
    'Statut',
    'TR début saison',
    'TR fin saison',
    'Push saison',
    'Objectif',
    'Gros objectif',
    'Résultat',
    'Notes',
  ];

  const headerRow = sheet.getRow(headerRowIndex);
  headers.forEach((header, index) => {
    const cell = headerRow.getCell(index + 1);
    cell.value = header;
    cell.fill = HEADER_FILL;
    cell.font = { color: { argb: 'FFFFFFFF' }, bold: true };
    cell.border = THIN_BORDER;
    cell.alignment = {
      vertical: 'middle',
      horizontal: index >= 3 && index <= 7 ? 'center' : 'left',
    };
  });
  headerRow.height = 24;

  const sortedRows = [...rows].sort((a, b) => {
    const roleDelta = roleRank(a.role) - roleRank(b.role);
    if (roleDelta !== 0) return roleDelta;

    const pushA = numberValue(a.trophies_push ?? (numberValue(a.trophies_live) - numberValue(a.trophies_start)));
    const pushB = numberValue(b.trophies_push ?? (numberValue(b.trophies_live) - numberValue(b.trophies_start)));
    if (pushB !== pushA) return pushB - pushA;

    return String(a.player_name).localeCompare(String(b.player_name), 'fr');
  });

  if (sortedRows.length === 0) {
    sheet.mergeCells('A10:J10');
    const emptyCell = sheet.getCell('A10');
    emptyCell.value = 'Aucun membre trouvé pour ce club dans cette saison.';
    emptyCell.fill = SUMMARY_FILL;
    emptyCell.font = { color: { argb: 'FF475569' }, italic: true };
    emptyCell.alignment = { vertical: 'middle', horizontal: 'center' };
    emptyCell.border = THIN_BORDER;
  }

  sortedRows.forEach((entry, index) => {
    const rowNumber = headerRowIndex + 1 + index;
    const row = sheet.getRow(rowNumber);

    const start = numberValue(entry.trophies_start);
    const end = numberValue(entry.trophies_live);
    const push = numberValue(entry.trophies_push ?? end - start);
    const objective = numberValue(entry.objective_trophies ?? club.objective);
    const bigObjective = numberValue(entry.big_objective_trophies ?? club.bigObjective);
    const status = getPerformanceStatus(push, objective, bigObjective);
    const fill = getFillForStatus(status);

    row.getCell(1).value = entry.player_name;
    row.getCell(2).value = entry.role;
    row.getCell(3).value = getMemberStatusLabel(entry.status, (entry as any).is_new, (entry as any).joined_at);
    row.getCell(4).value = start;
    row.getCell(5).value = end;
    row.getCell(6).value = push;
    row.getCell(7).value = objective;
    row.getCell(8).value = bigObjective;
    row.getCell(9).value = getPerformanceLabel(push, objective, bigObjective);
    row.getCell(10).value = entry.notes || '';

    row.eachCell((cell, colNumber) => {
      cell.border = THIN_BORDER;
      cell.alignment = {
        vertical: 'middle',
        horizontal: colNumber >= 4 && colNumber <= 8 ? 'center' : 'left',
        wrapText: colNumber === 10,
      };

      if (colNumber >= 4 && colNumber <= 8) {
        cell.numFmt = '#,##0';
      }

      if (fill) cell.fill = fill;
    });

    if (entry.role !== 'Membre') {
      row.getCell(1).font = { bold: true, color: { argb: 'FF0F172A' } };
      row.getCell(2).font = { bold: true, color: { argb: 'FF0F172A' } };
    }

    row.height = entry.notes ? 32 : 22;
  });

  const firstDataRow = headerRowIndex + 1;
  const lastDataRow = Math.max(firstDataRow, headerRowIndex + sortedRows.length);
  const statsRow = lastDataRow + 3;

  sheet.mergeCells(`A${statsRow}:C${statsRow}`);
  const avgLabelCell = applyCardCell(sheet, `A${statsRow}`);
  avgLabelCell.value = 'Moyenne du clan';
  avgLabelCell.font = { color: { argb: 'FFFFFFFF' }, bold: true };

  const avgValueCell = applyCardCell(sheet, `D${statsRow}`);
  avgValueCell.value =
    sortedRows.length > 0
      ? { formula: `AVERAGE(F${firstDataRow}:F${lastDataRow})` }
      : 0;
  avgValueCell.numFmt = '#,##0';
  avgValueCell.font = { color: { argb: 'FFFFFFFF' }, bold: true };
  avgValueCell.alignment = { vertical: 'middle', horizontal: 'center' };

  const objLabelCell = applyCardCell(sheet, `F${statsRow}`);
  objLabelCell.value = 'Objectif club';
  objLabelCell.font = { color: { argb: 'FFFFFFFF' }, bold: true };

  const objValueCell = applyCardCell(sheet, `G${statsRow}`);
  objValueCell.value = numberValue(club.objective);
  objValueCell.numFmt = '#,##0';
  objValueCell.font = { color: { argb: 'FFFFFFFF' }, bold: true };
  objValueCell.alignment = { vertical: 'middle', horizontal: 'center' };

  const bigObjLabelCell = applyCardCell(sheet, `F${statsRow + 1}`);
  bigObjLabelCell.value = 'Gros objectif';
  bigObjLabelCell.font = { color: { argb: 'FFFFFFFF' }, bold: true };

  const bigObjValueCell = applyCardCell(sheet, `G${statsRow + 1}`);
  bigObjValueCell.value = numberValue(club.bigObjective);
  bigObjValueCell.numFmt = '#,##0';
  bigObjValueCell.font = { color: { argb: 'FFFFFFFF' }, bold: true };
  bigObjValueCell.alignment = { vertical: 'middle', horizontal: 'center' };

  sheet.mergeCells(`A${statsRow + 3}:J${statsRow + 3}`);
  const legendCell = sheet.getCell(`A${statsRow + 3}`);
  legendCell.value =
    'Rouge = sous objectif • Jaune = objectif atteint mais gros objectif non atteint • Vert = gros objectif atteint';
  legendCell.font = { color: { argb: 'FF64748B' }, italic: true, size: 10 };
}

function addSummarySheet(
  workbook: ExcelJS.Workbook,
  season: {
    name: string;
    seasonNumber?: number | null;
    startsAt?: string | null;
    endsAt?: string | null;
  },
  clubs: ClubRow[],
  groupedRows: Map<string, ExportRow[]>,
) {
  const sheet = workbook.addWorksheet('Résumé');
  sheet.properties.defaultRowHeight = 22;
  sheet.columns = [
    { width: 24 },
    { width: 14 },
    { width: 14 },
    { width: 16 },
    { width: 14 },
    { width: 12 },
    { width: 12 },
  ];

  sheet.mergeCells('A1:G1');
  const titleCell = sheet.getCell('A1');
  titleCell.value = `Export intégral - ${season.name}`;
  titleCell.fill = TITLE_FILL;
  titleCell.font = { color: { argb: 'FFFFFFFF' }, bold: true, size: 16 };

  sheet.mergeCells('A2:G2');
  sheet.getCell('A2').value =
    `${season.seasonNumber ? `Saison ${season.seasonNumber}` : 'Saison active'} • Début ${formatDateTime(season.startsAt)} • Fin ${season.endsAt ? formatDateTime(season.endsAt) : '--'}`;
  sheet.getCell('A2').font = { color: { argb: 'FFCBD5E1' }, italic: true };

  const headers = ['Club', 'Objectif', 'Gros obj.', 'Moyenne clan', '% objectif', '>= obj.', '>= gros'];
  const headerRow = sheet.getRow(4);

  headers.forEach((header, index) => {
    const cell = headerRow.getCell(index + 1);
    cell.value = header;
    cell.fill = HEADER_FILL;
    cell.font = { color: { argb: 'FFFFFFFF' }, bold: true };
    cell.border = THIN_BORDER;
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
  });

  clubs.forEach((club, index) => {
    const rows = groupedRows.get(club.name) ?? [];
    const pushes = rows.map((entry) =>
      numberValue(entry.trophies_push ?? (numberValue(entry.trophies_live) - numberValue(entry.trophies_start))),
    );

    const members = pushes.length;
    const objective = numberValue(club.objective);
    const bigObjective = numberValue(club.bigObjective);
    const average = members > 0 ? pushes.reduce((sum, value) => sum + value, 0) / members : 0;
    const reachedObjective = pushes.filter((value) => value >= objective).length;
    const reachedBigObjective = pushes.filter((value) => value >= bigObjective).length;

    const row = sheet.getRow(5 + index);
    row.values = [
      club.name,
      objective,
      bigObjective,
      average,
      objective > 0 ? average / objective : 0,
      reachedObjective,
      reachedBigObjective,
    ];

    row.eachCell((cell, colNumber) => {
      cell.border = THIN_BORDER;
      cell.alignment = {
        vertical: 'middle',
        horizontal: colNumber === 1 ? 'left' : 'center',
      };

      if ([2, 3, 4, 6, 7].includes(colNumber)) {
        cell.numFmt = '#,##0';
      }

      if (colNumber === 5) {
        cell.numFmt = '0.0%';
      }

      cell.fill = SUMMARY_FILL;
    });

    const avgStatus = getPerformanceStatus(average, objective, bigObjective);
    const avgFill = getFillForStatus(avgStatus);
    if (avgFill) {
      row.getCell(4).fill = avgFill;
      row.getCell(5).fill = avgFill;
    }
  });
}

export async function GET(request: NextRequest) {
  try {
    await requireStaff(request);
    const activeSeason = await getActiveSeasonServer();

    const [clubs, rows] = await Promise.all([
      getClubsForSeasonServer(activeSeason.id),
      exportSeasonRowsServer(activeSeason.id),
    ]);

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'OpenAI';
    workbook.lastModifiedBy = 'OpenAI';
    workbook.created = new Date();
    workbook.modified = new Date();
    workbook.calcProperties.fullCalcOnLoad = true;

    const groupedRows = new Map<string, ExportRow[]>();
    for (const row of rows) {
      const bucket = groupedRows.get(row.club_name) ?? [];
      bucket.push(row);
      groupedRows.set(row.club_name, bucket);
    }

    addSummarySheet(workbook, activeSeason, clubs, groupedRows);

    const usedSheetNames = new Set<string>(['Résumé']);
    for (const club of clubs) {
      const clubRows = groupedRows.get(club.name) ?? [];
      const sheetName = uniqueSheetName(club.name, usedSheetNames);
      addClubSheet(workbook, sheetName, club, clubRows, activeSeason);
    }

    const fileName =
      `${safeFileName(`saison-${activeSeason.seasonNumber ?? 'active'}-${activeSeason.name}`) || 'export-saison'}.xlsx`;

    const buffer = await workbook.xlsx.writeBuffer();

    return new NextResponse(Buffer.from(buffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${fileName}"`,
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
      },
    });
  } catch (error) {
    console.error('EXPORT SAISON ERROR:', error);

    const message = error instanceof Error ? error.message : 'Unknown export error';
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
