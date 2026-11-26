export type SpecialPlotKind = 'polar' | 'ternary' | 'smith' | 'groupplot' | 'contour' | 'quiver';

export interface GroupPlotConfig {
  rows: number;
  cols: number;
  sharedAxes: boolean;
  exprs: string[];
}

export function evalExprXY(expr: string, x: number, y: number): number | null {
  try {
    const js = expr
      .replace(/deg\(x\)/g, 'x')
      .replace(/\^/g, '**')
      .replace(/\bpi\b/gi, 'Math.PI')
      .replace(/\bsin\(/g, 'Math.sin(')
      .replace(/\bcos\(/g, 'Math.cos(')
      .replace(/\btan\(/g, 'Math.tan(')
      .replace(/\bexp\(/g, 'Math.exp(')
      .replace(/\bsqrt\(/g, 'Math.sqrt(')
      .replace(/\babs\(/g, 'Math.abs(')
      .replace(/\bln\(/g, 'Math.log(');
    const fn = new Function('x', 'y', `return (${js});`);
    const v = Number(fn(x, y));
    return Number.isFinite(v) ? v : null;
  } catch {
    return null;
  }
}

export function generateSpecialPgfLatex(params: {
  kind: SpecialPlotKind;
  plotTitle: string;
  xLabel: string;
  yLabel: string;
  xMin: number;
  xMax: number;
  yMin: number;
  yMax: number;
  gridMode: string;
  colormapName: string;
  polarExpr: string;
  ternaryCoords: string;
  smithCoords: string;
  group: GroupPlotConfig;
  contourExpr: string;
  contourLevels: number;
  quiverU: string;
  quiverV: string;
}): { code: string; libs: string[] } {
  const {
    kind,
    plotTitle,
    xLabel,
    yLabel,
    xMin,
    xMax,
    yMin,
    yMax,
    gridMode,
    colormapName,
    polarExpr,
    ternaryCoords,
    smithCoords,
    group,
    contourExpr,
    contourLevels,
    quiverU,
    quiverV,
  } = params;

  if (kind === 'polar') {
    return {
      libs: ['polar'],
      code: `\\begin{tikzpicture}
  \\begin{polaraxis}[
    title={${plotTitle}},
    grid=${gridMode}
  ]
    \\addplot[domain=0:360, samples=120, thick, blue] {${polarExpr}};
  \\end{polaraxis}
\\end{tikzpicture}`,
    };
  }

  if (kind === 'ternary') {
    const pts = ternaryCoords
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean)
      .map((l) => `(${l})`)
      .join(' ');
    return {
      libs: ['ternary'],
      code: `\\begin{tikzpicture}
  \\begin{ternaryaxis}[
    title={${plotTitle}},
    xlabel={A (\\%)},
    ylabel={B (\\%)},
    zlabel={C (\\%)},
    grid=${gridMode}
  ]
    \\addplot3[only marks, mark=*, color=blue] coordinates { ${pts} };
  \\end{ternaryaxis}
\\end{tikzpicture}`,
    };
  }

  if (kind === 'smith') {
    const pts = smithCoords
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean)
      .map((l) => `(${l})`)
      .join(' ');
    return {
      libs: ['smithchart'],
      code: `\\begin{tikzpicture}
  \\begin{smithchart}[
    title={${plotTitle}}
  ]
    \\addplot+[thick, mark=o] coordinates { ${pts} };
  \\end{smithchart}
\\end{tikzpicture}`,
    };
  }

  if (kind === 'groupplot') {
    const total = group.rows * group.cols;
    const sharedOpts = group.sharedAxes
      ? ',\n      xlabels at=edge bottom,\n      ylabels at=edge left'
      : '';
    const cells = Array.from({ length: total }, (_, idx) => {
      const expr = group.exprs[idx] || 'sin(x)';
      return `    \\nextgroupplot[title={Subgráfico ${idx + 1}}]\n    \\addplot[thick, blue, domain=${xMin}:${xMax}, samples=80] {${expr}};`;
    }).join('\n');
    return {
      libs: ['groupplots'],
      code: `\\begin{tikzpicture}
  \\begin{groupplot}[
    group style={
      group size=${group.cols} by ${group.rows}${sharedOpts}
    },
    width=5.5cm,
    height=4.2cm,
    grid=${gridMode}
  ]
${cells}
  \\end{groupplot}
\\end{tikzpicture}`,
    };
  }

  if (kind === 'contour') {
    return {
      libs: [],
      code: `\\begin{tikzpicture}
  \\begin{axis}[
    title={${plotTitle}},
    xlabel={${xLabel}},
    ylabel={${yLabel}},
    view={0}{90},
    colormap name=${colormapName},
    colorbar,
    grid=${gridMode}
  ]
    \\addplot3[
      contour lua={number=${contourLevels}},
      domain=${xMin}:${xMax},
      domain y=${yMin}:${yMax},
      samples=25
    ] {${contourExpr}};
  \\end{axis}
\\end{tikzpicture}`,
    };
  }

  // quiver
  return {
    libs: [],
    code: `\\begin{tikzpicture}
  \\begin{axis}[
    title={${plotTitle}},
    xlabel={${xLabel}},
    ylabel={${yLabel}},
    xmin=${xMin}, xmax=${xMax},
    ymin=${yMin}, ymax=${yMax},
    grid=${gridMode}
  ]
    \\addplot3[
      blue,
      quiver={
        u={${quiverU}},
        v={${quiverV}},
        scale arrows=0.35
      },
      -Stealth,
      domain=${xMin}:${xMax},
      domain y=${yMin}:${yMax},
      samples=11
    ] {0};
  \\end{axis}
\\end{tikzpicture}`,
  };
}

