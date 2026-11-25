export type TableEngine = 'tabularray' | 'classic';
export type ColumnAlign = 'l' | 'c' | 'r' | 'X' | 'p3' | 'S';
export type BorderStyle = 'booktabs' | 'grid' | 'minimal';
export type CellBgColor = 'none' | 'gray' | 'blue' | 'amber' | 'green' | 'rose';

export interface TableCellData {
  text: string;
  rowSpan: number;
  colSpan: number;
  hiddenBy?: { r: number; c: number };
  bold?: boolean;
  italic?: boolean;
  bg?: CellBgColor;
}

export interface TableNote {
  id: number;
  text: string;
}

export interface TableConfig {
  engine: TableEngine;
  columns: ColumnAlign[];
  cells: TableCellData[][];
  borderStyle: BorderStyle;
  zebra: boolean;
  multipage: boolean;
  wrapInTableEnv: boolean;
  caption: string;
  label: string;
  notes: TableNote[];
}

const COLOR_MAP_CLASSIC: Record<Exclude<CellBgColor, 'none'>, string> = {
  gray: 'gray!15',
  blue: 'blue!12',
  amber: 'amber!18',
  green: 'green!12',
  rose: 'red!12',
};

const COLOR_MAP_TBLR: Record<Exclude<CellBgColor, 'none'>, string> = {
  gray: 'gray9',
  blue: 'azure9',
  amber: 'yellow9',
  green: 'green9',
  rose: 'red9',
};

function formatCellText(cell: TableCellData): string {
  let out = cell.text;
  if (cell.bold) out = `\\textbf{${out}}`;
  if (cell.italic) out = `\\textit{${out}}`;
  return out;
}

function colSpecForClassic(col: ColumnAlign): string {
  switch (col) {
    case 'p3':
      return 'p{3cm}';
    case 'S':
      return 'S';
    default:
      return col;
  }
}

function colSpecForTblr(col: ColumnAlign): string {
  switch (col) {
    case 'p3':
      return 'Q[l,wd=3cm]';
    case 'X':
      return 'X[l]';
    case 'S':
      return 'S';
    default:
      return col;
  }
}

export function generateTableOutput(cfg: TableConfig): {
  code: string;
  packages: string[];
} {
  const packages = new Set<string>();
  const hasNotes = cfg.notes.length > 0;
  const hasX = cfg.columns.includes('X');
  const hasS = cfg.columns.includes('S');
  const hasColors = cfg.zebra || cfg.cells.some((row) => row.some((c) => c.bg && c.bg !== 'none'));
  const hasMultirow = cfg.cells.some((row) => row.some((c) => c.rowSpan > 1));

  if (cfg.engine === 'tabularray') {
    packages.add('\\usepackage{tabularray}');
    const libs: string[] = [];
    if (cfg.borderStyle === 'booktabs') libs.push('booktabs');
    if (hasS) libs.push('siunitx');
    if (libs.length > 0) {
      packages.add(`\\UseTblrLibrary{${libs.join(', ')}}`);
    }
    if (hasColors) {
      packages.add('\\usepackage{xcolor}');
    }

    const colspec = cfg.columns.map(colSpecForTblr).join(' ');
    const tblrOptions: string[] = [`  colspec = {${colspec}}`];

    if (cfg.borderStyle === 'grid') {
      tblrOptions.push('  hlines, vlines');
    }
    if (cfg.multipage) {
      tblrOptions.push('  rowhead = 1');
    }
    if (cfg.zebra && cfg.cells.length > 1) {
      tblrOptions.push('  row{even} = {bg=gray9}');
    }
    tblrOptions.push('  row{1} = {font=\\bfseries}');

    if (hasNotes && cfg.multipage) {
      tblrOptions.push(`  caption = {${cfg.caption}}`);
      tblrOptions.push(`  label = {${cfg.label || 'tab:tabela'}}`);
    }

    // Cell-specific bg colors
    cfg.cells.forEach((row, ri) => {
      row.forEach((cell, ci) => {
        if (!cell.hiddenBy && cell.bg && cell.bg !== 'none') {
          tblrOptions.push(`  cell{${ri + 1}}{${ci + 1}} = {bg=${COLOR_MAP_TBLR[cell.bg]}}`);
        }
      });
    });

    if (hasNotes) {
      cfg.notes.forEach((n) => {
        tblrOptions.push(`  note{${n.id}} = {${n.text}}`);
      });
    }

    const envName = cfg.multipage
      ? 'longtblr'
      : hasNotes
      ? 'talltblr'
      : 'tblr';

    const bodyLines: string[] = [];
    if (cfg.borderStyle === 'booktabs') bodyLines.push('  \\toprule');

    cfg.cells.forEach((row, ri) => {
      const rowCells = row.map((cell) => {
        if (cell.hiddenBy) return '';
        const text = formatCellText(cell);
        if (cell.rowSpan > 1 || cell.colSpan > 1) {
          return `\\SetCell[r=${cell.rowSpan}, c=${cell.colSpan}]{c} ${text}`;
        }
        return text;
      });
      bodyLines.push(`  ${rowCells.join(' & ')} \\\\`);
      if (cfg.borderStyle === 'booktabs' && ri === 0 && cfg.cells.length > 1) {
        bodyLines.push('  \\midrule');
      }
    });

    if (cfg.borderStyle === 'booktabs') bodyLines.push('  \\bottomrule');

    const tblrHeader =
      envName === 'talltblr'
        ? `\\begin{talltblr}[\n  caption = {${cfg.caption}},\n  label = {${cfg.label || 'tab:tabela'}},\n${cfg.notes
            .map((n) => `  note{${n.id}} = {${n.text}}`)
            .join(',\n')}\n]{`
        : `\\begin{${envName}}{`;

    const tblrOptsFinal =
      envName === 'talltblr'
        ? tblrOptions.filter((o) => !o.trim().startsWith('note{'))
        : tblrOptions;

    const tblrBlock = [
      tblrHeader,
      ...tblrOptsFinal.map((o, idx) => (idx < tblrOptsFinal.length - 1 ? `${o},` : o)),
      `}`,
      ...bodyLines,
      `\\end{${envName}}`,
    ].join('\n');

    if (cfg.multipage || !cfg.wrapInTableEnv) {
      return { code: tblrBlock, packages: Array.from(packages) };
    }

    if (envName === 'talltblr') {
      return {
        code: [`\\begin{table}[htbp]`, `  \\centering`, tblrBlock, `\\end{table}`].join('\n'),
        packages: Array.from(packages),
      };
    }

    return {
      code: [
        `\\begin{table}[htbp]`,
        `  \\centering`,
        `  \\caption{${cfg.caption}}`,
        `  \\label{${cfg.label || 'tab:tabela'}}`,
        tblrBlock,
        `\\end{table}`,
      ].join('\n'),
      packages: Array.from(packages),
    };
  }

  // --- CLASSIC STACK ---
  if (cfg.borderStyle === 'booktabs') packages.add('\\usepackage{booktabs}');
  if (hasMultirow) packages.add('\\usepackage{multirow}');
  if (hasX) packages.add('\\usepackage{tabularx}');
  if (cfg.multipage) packages.add('\\usepackage{longtable}');
  if (hasS) packages.add('\\usepackage{siunitx}');
  if (hasNotes) packages.add('\\usepackage{threeparttable}');
  if (hasColors) packages.add('\\usepackage[table]{xcolor}');

  const rawCols = cfg.columns.map(colSpecForClassic);
  const colSpec =
    cfg.borderStyle === 'grid' ? `|${rawCols.join('|')}|` : rawCols.join(' ');

  const envName = cfg.multipage ? 'longtable' : hasX ? 'tabularx' : 'tabular';
  const openEnv =
    envName === 'tabularx'
      ? `\\begin{tabularx}{\\textwidth}{${colSpec}}`
      : `\\begin{${envName}}{${colSpec}}`;

  const bodyLines: string[] = [];
  if (cfg.borderStyle === 'booktabs') {
    bodyLines.push('  \\toprule');
  } else if (cfg.borderStyle === 'grid') {
    bodyLines.push('  \\hline');
  }

  cfg.cells.forEach((row, ri) => {
    const rowOut: string[] = [];
    const cmidrules: string[] = [];

    for (let ci = 0; ci < row.length; ci++) {
      const cell = row[ci];
      if (cell.hiddenBy) {
        if (cell.hiddenBy.c === ci) {
          // Covered vertically by a multirow above -> needs empty slot
          rowOut.push('');
        }
        continue;
      }

      let inner = formatCellText(cell);
      if (cell.bg && cell.bg !== 'none') {
        inner = `\\cellcolor{${COLOR_MAP_CLASSIC[cell.bg]}}${inner}`;
      }

      if (cell.rowSpan > 1 && cell.colSpan > 1) {
        inner = `\\multicolumn{${cell.colSpan}}{c}{\\multirow{${cell.rowSpan}}{*}{${inner}}}`;
        cmidrules.push(`\\cmidrule(lr){${ci + 1}-${ci + cell.colSpan}}`);
      } else if (cell.colSpan > 1) {
        const alignChar = cfg.borderStyle === 'grid' ? '|c|' : 'c';
        inner = `\\multicolumn{${cell.colSpan}}{${alignChar}}{${inner}}`;
        cmidrules.push(`\\cmidrule(lr){${ci + 1}-${ci + cell.colSpan}}`);
      } else if (cell.rowSpan > 1) {
        inner = `\\multirow{${cell.rowSpan}}{*}{${inner}}`;
      }
      rowOut.push(inner);
    }

    if (cfg.zebra && ri > 0 && ri % 2 === 1) {
      bodyLines.push('  \\rowcolor{gray!12}');
    }
    bodyLines.push(`  ${rowOut.join(' & ')} \\\\`);

    if (cfg.borderStyle === 'booktabs') {
      if (cmidrules.length > 0 && ri === 0) {
        bodyLines.push(`  ${cmidrules.join(' ')}`);
      } else if (ri === 0 && cfg.cells.length > 1) {
        bodyLines.push('  \\midrule');
      }
    } else if (cfg.borderStyle === 'grid') {
      bodyLines.push('  \\hline');
    }

    if (cfg.multipage && ri === 0) {
      bodyLines.push('  \\endhead');
    }
  });

  if (cfg.borderStyle === 'booktabs') bodyLines.push('  \\bottomrule');

  const tabularBlock = [openEnv, ...bodyLines, `\\end{${envName}}`].join('\n');

  if (cfg.multipage || !cfg.wrapInTableEnv) {
    return { code: tabularBlock, packages: Array.from(packages) };
  }

  const innerLines: string[] = [];
  if (hasNotes) {
    innerLines.push('  \\begin{threeparttable}');
  }
  innerLines.push(`  \\caption{${cfg.caption}}`);
  innerLines.push(`  \\label{${cfg.label || 'tab:tabela'}}`);
  innerLines.push(tabularBlock);
  if (hasNotes) {
    innerLines.push('  \\begin{tablenotes}');
    cfg.notes.forEach((n) => {
      innerLines.push(`    \\item [${n.id}] ${n.text}`);
    });
    innerLines.push('  \\end{tablenotes}');
    innerLines.push('  \\end{threeparttable}');
  }

  return {
    code: [`\\begin{table}[htbp]`, `  \\centering`, ...innerLines, `\\end{table}`].join('\n'),
    packages: Array.from(packages),
  };
}

