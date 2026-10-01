// Desenho. Todo texto de numero chega pronto, em portugues: o Plotly
// formata na localidade inglesa e escreveria "4,000,000".

import { inteiro, curto, pct, marcas, marcasLog, apara } from "./formato.js";

const CFG = { displayModeBar: false, responsive: true, doubleClick: false };

/** Le as cores do tema vigente direto do CSS, para o tema claro funcionar. */
export function tema() {
  const s = getComputedStyle(document.documentElement);
  const v = (n) => s.getPropertyValue(n).trim();
  return {
    ink: v("--ink"), muted: v("--ink-muted"), faint: v("--ink-faint"),
    linha: v("--line"), sup: v("--surface"), sup2: v("--surface-2"),
    semDado: v("--sem-dado"), acento: v("--acento"), forte: v("--acento-forte"),
    rampa: [v("--r1"), v("--r2"), v("--r3"), v("--r4"), v("--r5"), v("--r6")],
    cats: [v("--c1"), v("--c2"), v("--c3"), v("--c4"), v("--c5")],
    corpo: s.getPropertyValue("--corpo").trim(),
  };
}

function base(t, alt) {
  return {
    height: alt, margin: { l: 8, r: 8, t: 6, b: 6 },
    paper_bgcolor: "rgba(0,0,0,0)", plot_bgcolor: "rgba(0,0,0,0)",
    font: { family: t.corpo, size: 12, color: t.muted },
    hoverlabel: {
      bgcolor: t.sup2, bordercolor: t.linha, align: "left",
      font: { family: t.corpo, size: 12.5, color: t.ink },
    },
    showlegend: false,
  };
}

const eixoX = (t, mx) => ({
  ...marcas(mx), zeroline: false, showgrid: true, gridcolor: t.linha,
  gridwidth: 1, showline: false, ticks: "", tickfont: { size: 11 },
  fixedrange: true,
});
const eixoY = (t) => ({
  automargin: true, showgrid: false, zeroline: false, showline: false,
  ticks: "", tickfont: { size: 11.5, color: t.ink }, fixedrange: true,
});

// ------------------------------------------------------------- mapa
export function mapa(alvo, linhas, malha, aoClicar, marcados, nomes) {
  const t = tema();
  const comDado = linhas.filter((d) => d.n > 0);
  if (!comDado.length) {
    Plotly.purge(alvo);
    alvo.innerHTML = '<p style="color:var(--ink-faint);font-size:.85rem;'
      + 'padding:40px 0;text-align:center">Nenhum país no recorte.</p>';
    return;
  }
  // Escala logaritmica: os Estados Unidos tem milhoes e o Uruguai tem
  // dezenas. Em escala linear o mapa inteiro fica de uma cor so.
  // CAMADA DE FUNDO. O choropleth so desenha o poligono que recebe
  // valor, e por isso o pais sem registro no recorte desaparecia do
  // mapa — sem cor e sem fronteira, como se nao existisse. Aqui ele
  // ganha o tom de "sem dado" e o contorno, e a dica dele diz que nao
  // ha registro, em vez de nao dizer nada. Sao 175 poligonos na malha
  // contra 106 escritorios na base, ou seja a maior parte do mapa.
  const temDado = new Set(comDado.map((d) => d.iso));
  const vazios = (malha.features || [])
    .map((f) => f.properties && f.properties.iso)
    .filter((iso) => iso && !temDado.has(iso));
  const fundo = vazios.length ? [{
    type: "choropleth", geojson: malha, locations: vazios,
    featureidkey: "properties.iso",
    z: vazios.map(() => 0),
    colorscale: [[0, t.semDado], [1, t.semDado]],
    zmin: 0, zmax: 1, showscale: false,
    marker: { line: { color: t.faint, width: 0.4 } },
    customdata: vazios.map((iso) => (nomes && nomes[iso]) || iso),
    hovertemplate: "<b>%{customdata}</b><br>sem registro neste recorte"
                 + "<extra></extra>",
  }] : [];

  const z = comDado.map((d) => Math.log10(d.n));
  const lo = Math.min(...z), hi = Math.max(...z);
  const escala = t.rampa.map((c, i) => [i / (t.rampa.length - 1), c]);
  const traco = {
    type: "choropleth", geojson: malha, locations: comDado.map((d) => d.iso),
    featureidkey: "properties.iso", z,
    zmin: lo, zmax: hi, colorscale: escala,
    // o territorio selecionado ganha contorno em vez de sumir do mapa
    marker: {
      line: {
        color: comDado.map((d) => (marcados && marcados.has(d.id)
                                   ? t.ink : t.sup)),
        width: comDado.map((d) => (marcados && marcados.has(d.id) ? 2 : 0.5)),
      },
    },
    customdata: comDado.map((d) => [d.nome, inteiro(d.n), pct(d.share)]),
    hovertemplate: "<b>%{customdata[0]}</b><br>%{customdata[1]} publicações"
                 + "<br>%{customdata[2]} do recorte<extra></extra>",
    colorbar: {
      ...marcasLog(lo, hi), thickness: 9, len: 0.68, x: 1, xpad: 0,
      outlinewidth: 0, tickfont: { size: 10, color: t.faint },
      title: { text: "", side: "top" },
    },
  };
  const layout = {
    ...base(t, 430), margin: { l: 0, r: 0, t: 0, b: 0 },
    geo: {
      visible: false, bgcolor: "rgba(0,0,0,0)",
      projection: { type: "natural earth" },
      lonaxis: { range: [-179, 179] }, lataxis: { range: [-58, 84] },
      showframe: false, showcoastlines: false,
    },
  };
  Plotly.react(alvo, fundo.concat([traco]), layout,
               { ...CFG, scrollZoom: false });
  alvo.removeAllListeners && alvo.removeAllListeners("plotly_click");
  alvo.on("plotly_click", (ev) => {
    const p = ev.points && ev.points[0];
    // o clique no fundo nao filtra: nao ha o que filtrar ali
    if (p && p.curveNumber === fundo.length) {
      aoClicar(comDado[p.pointIndex]);
    }
  });
}

// ---------------------------------------------------------- barras
/**
 * Barra horizontal de uma serie so. A identidade vem do rotulo do eixo,
 * nao da cor: oito secoes da IPC em oito cores nao passariam no teste de
 * separacao sob daltonismo, e o comprimento ja codifica a magnitude.
 */
export function barras(alvo, linhas, op = {}) {
  const t = tema();
  if (!linhas.length) {
    Plotly.purge(alvo);
    alvo.innerHTML = '<p style="color:var(--ink-faint);font-size:.85rem;'
      + 'padding:40px 0;text-align:center">Sem dados no recorte.</p>';
    return;
  }
  const dados = linhas.slice().reverse();
  const mx = Math.max(...dados.map((d) => d.n));
  const cor = op.cores || dados.map((d) => (d.apagado ? t.semDado : t.acento));
  const traco = {
    type: "bar", orientation: "h",
    x: dados.map((d) => d.n),
    y: dados.map((d, i) => apara(d.rotulo, 46) + "​".repeat(i)),
    marker: { color: cor, line: { width: 0 }, cornerradius: 4 },
    text: dados.map((d) => " " + curto(d.n)),
    textposition: "outside", cliponaxis: false, insidetextanchor: "start",
    textfont: { size: 11, color: t.muted, family: t.corpo },
    customdata: dados.map((d) => [d.titulo || d.rotulo, inteiro(d.n),
                                  pct(d.share), d.extra || ""]),
    hovertemplate: "<b>%{customdata[0]}</b><br>%{customdata[1]} "
                 + (op.unidade || "publicações")
                 + "<br>%{customdata[2]} " + (op.base || "do recorte")
                 + "%{customdata[3]}<extra></extra>",
  };
  const alt = op.altura || Math.max(190, 26 * dados.length + 34);
  const layout = {
    ...base(t, alt), bargap: 0.34,
    margin: { l: 8, r: 54, t: 4, b: 26 },
    xaxis: { ...eixoX(t, mx * 1.12), visible: false },
    yaxis: eixoY(t),
  };
  Plotly.react(alvo, [traco], layout, CFG);
  alvo.removeAllListeners && alvo.removeAllListeners("plotly_click");
  if (op.aoClicar) {
    alvo.on("plotly_click", (ev) => {
      const p = ev.points && ev.points[0];
      if (p) op.aoClicar(dados[p.pointIndex]);
    });
  }
}

// ----------------------------------------------------------- serie
export function serie(alvo, series, op = {}) {
  const t = tema();
  const validas = series.filter((s) => s.pontos.length);
  if (!validas.length) {
    Plotly.purge(alvo);
    alvo.innerHTML = '<p style="color:var(--ink-faint);font-size:.85rem;'
      + 'padding:40px 0;text-align:center">Sem dados no recorte.</p>';
    return;
  }
  const mx = Math.max(...validas.flatMap((s) => s.pontos.map((p) => p.n)));
  const tracos = validas.map((s, i) => ({
    type: "scatter", mode: "lines+markers", name: s.nome,
    x: s.pontos.map((p) => p.a), y: s.pontos.map((p) => p.n),
    line: { width: 2, color: validas.length > 1 ? t.cats[i % 5] : t.acento,
            shape: "spline", smoothing: 0.4 },
    marker: { size: 4, color: validas.length > 1 ? t.cats[i % 5] : t.acento },
    customdata: s.pontos.map((p) => [s.nome, inteiro(p.n), p.a]),
    hovertemplate: "<b>%{customdata[0]}</b> · %{customdata[2]}"
                 + "<br>%{customdata[1]} publicações<extra></extra>",
  }));
  const layout = {
    ...base(t, op.altura || 300),
    margin: { l: 52, r: 14, t: 6, b: 30 },
    showlegend: validas.length > 1,
    legend: { orientation: "h", y: -0.16, x: 0, font: { size: 11 } },
    hovermode: "x unified",
    xaxis: { showgrid: false, zeroline: false, showline: true,
             linecolor: t.linha, ticks: "outside", tickcolor: t.linha,
             ticklen: 3, tickfont: { size: 11 }, fixedrange: true,
             tickformat: "d" },
    yaxis: { ...marcas(mx), showgrid: true, gridcolor: t.linha,
             zeroline: false, showline: false, ticks: "",
             tickfont: { size: 11 }, fixedrange: true, rangemode: "tozero" },
  };
  Plotly.react(alvo, tracos, layout, CFG);
}

// ---------------------------------------------------- concentracao
export function concentracao(alvo, pontos, rotuloX) {
  const t = tema();
  if (pontos.length < 2) { Plotly.purge(alvo); alvo.innerHTML = ""; return; }
  const traco = {
    type: "scatter", mode: "lines", x: pontos.map((p) => p.i),
    y: pontos.map((p) => p.acum),
    line: { width: 2, color: t.acento, shape: "spline", smoothing: 0.3 },
    fill: "tozeroy", fillcolor: t.acento + "22",
    customdata: pontos.map((p) => [inteiro(p.i), pct(p.acum), p.nome]),
    hovertemplate: "<b>%{customdata[2]}</b><br>até aqui: %{customdata[1]}"
                 + " do recorte<extra></extra>",
  };
  const layout = {
    ...base(t, 244), margin: { l: 46, r: 14, t: 6, b: 34 },
    xaxis: { title: { text: rotuloX, font: { size: 11, color: t.faint },
                      standoff: 8 },
             showgrid: false, zeroline: false, showline: true,
             linecolor: t.linha, tickfont: { size: 11 }, fixedrange: true },
    yaxis: { tickvals: [0, 25, 50, 75, 100],
             ticktext: ["0", "25%", "50%", "75%", "100%"],
             range: [0, 103], showgrid: true, gridcolor: t.linha,
             zeroline: false, tickfont: { size: 11 }, fixedrange: true },
  };
  Plotly.react(alvo, [traco], layout, CFG);
}

// ----------------------------------------------------------- rosca
/**
 * Rosca de parte-do-todo. Legitima aqui por um motivo verificavel: a
 * extracao guardou UM codigo IPC por publicacao, entao cada publicacao
 * cai numa fatia so e os percentuais fecham em 100%. Onde a soma nao
 * fechasse, isto seria uma barra.
 *
 * A cor nao carrega identidade — ela e a rampa sequencial, na ordem do
 * tamanho. Identidade vem do rotulo, colado na propria fatia. Oito
 * matizes categoricos nao passariam no teste de separacao sob
 * daltonismo em fundo escuro; ja foi medido neste projeto.
 */
export function rosca(alvo, fatias, op = {}) {
  const t = tema();
  const validas = fatias.filter((f) => f.n > 0);
  if (validas.length < 2) {
    Plotly.purge(alvo);
    alvo.innerHTML = '<p style="color:var(--ink-faint);font-size:.85rem;'
      + 'padding:40px 0;text-align:center">'
      + (validas.length ? "Uma categoria só no recorte."
                        : "Sem dados no recorte.") + "</p>";
    return;
  }
  const soma = validas.reduce((a, f) => a + f.n, 0);
  // a rampa vai do mais escuro ao mais claro; o resto fica neutro
  const cor = validas.map((f, i) => (f.resto ? t.semDado
    : t.rampa[Math.min(t.rampa.length - 1,
                       Math.round(i * (t.rampa.length - 1)
                                  / Math.max(1, validas.length - 1)))]));
  const traco = {
    type: "pie", hole: op.furo === undefined ? 0.56 : op.furo,
    labels: validas.map((f) => apara(f.rotulo, 26)),
    values: validas.map((f) => f.n),
    sort: false, direction: "clockwise", rotation: 0,
    marker: { colors: cor, line: { color: t.sup, width: 2 } },
    textinfo: "label+percent", textposition: "outside",
    automargin: true,
    outsidetextfont: { size: 11, color: t.muted, family: t.corpo },
    // o %{percent} do Plotly sai em ingles ("1.37%"); o percentual vai
    // pronto, no formato brasileiro, como todo numero da pagina
    texttemplate: "%{label}<br>%{customdata[2]}",
    customdata: validas.map((f) => [f.titulo || f.rotulo, inteiro(f.n),
                                    pct(100 * f.n / soma), f.extra || ""]),
    hovertemplate: "<b>%{customdata[0]}</b><br>%{customdata[1]} publicações"
                 + "<br>%{customdata[2]} do recorte"
                 + "%{customdata[3]}<extra></extra>",
  };
  const layout = {
    ...base(t, op.altura || 330), margin: { l: 10, r: 10, t: 14, b: 14 },
    annotations: [{
      text: "<b>" + curto(soma) + "</b><br><span style='font-size:10px'>"
            + (op.centro || "no recorte") + "</span>",
      showarrow: false, x: 0.5, y: 0.5, xref: "paper", yref: "paper",
      font: { size: 19, color: t.ink, family: t.corpo }, align: "center",
    }],
  };
  Plotly.react(alvo, [traco], layout, CFG);
  alvo.removeAllListeners && alvo.removeAllListeners("plotly_click");
  if (op.aoClicar) {
    alvo.on("plotly_click", (ev) => {
      const p = ev.points && ev.points[0];
      if (p && !validas[p.pointNumber].resto) {
        op.aoClicar(validas[p.pointNumber]);
      }
    });
  }
}

// --------------------------------------------------------- colunas
/** Barra vertical, para quando a categoria e uma ordem no tempo. */
export function colunas(alvo, itens, op = {}) {
  const t = tema();
  if (!itens.length) {
    Plotly.purge(alvo);
    alvo.innerHTML = '<p style="color:var(--ink-faint);font-size:.85rem;'
      + 'padding:40px 0;text-align:center">Sem dados no recorte.</p>';
    return;
  }
  const mx = Math.max(...itens.map((d) => d.n));
  const traco = {
    type: "bar",
    x: itens.map((d) => d.rotulo), y: itens.map((d) => d.n),
    marker: {
      color: itens.map((d) => (d.apagado ? t.semDado : t.acento)),
      line: { width: 0 }, cornerradius: 4,
    },
    text: itens.map((d) => curto(d.n)), textposition: "outside",
    cliponaxis: false,
    textfont: { size: 11, color: t.muted, family: t.corpo },
    customdata: itens.map((d) => [d.titulo || d.rotulo, inteiro(d.n),
                                  d.extra || ""]),
    hovertemplate: "<b>%{customdata[0]}</b><br>%{customdata[1]}"
                 + "%{customdata[2]}<extra></extra>",
  };
  const layout = {
    ...base(t, op.altura || 300), bargap: 0.3,
    margin: { l: 52, r: 12, t: 18, b: 34 },
    xaxis: { showgrid: false, zeroline: false, showline: true,
             linecolor: t.linha, ticks: "", tickfont: { size: 11 },
             fixedrange: true, type: "category" },
    yaxis: { ...marcas(mx * 1.1), showgrid: true, gridcolor: t.linha,
             zeroline: false, showline: false, ticks: "",
             tickfont: { size: 11 }, fixedrange: true, rangemode: "tozero" },
  };
  Plotly.react(alvo, [traco], layout, CFG);
}

export function limpar(alvo) {
  Plotly.purge(alvo);
  alvo.innerHTML = "";
}
