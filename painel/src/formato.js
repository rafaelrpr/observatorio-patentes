// Numero em portugues. O Plotly formata na localidade inglesa e escreve
// "4,000,000": em lugar nenhum se deixa o Plotly formatar um numero — os
// ticks saem de marcas() e todo texto de dica vai pronto por customdata.

const fInt = new Intl.NumberFormat("pt-BR");
const fUm = new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 1,
                                             maximumFractionDigits: 1 });
const fDois = new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 2,
                                               maximumFractionDigits: 2 });

export const inteiro = (v) => fInt.format(Math.round(Number(v) || 0));
export const um = (v) => fUm.format(Number(v) || 0);

export function pct(v, casas = 1) {
  const n = Number(v) || 0;
  return (casas === 0 ? inteiro(n) : (casas === 2 ? fDois : fUm).format(n)) + "%";
}

/** 4.732.109 -> "4,7 mi". Para eixo e cartao, onde o numero cheio nao cabe. */
export function curto(v) {
  const n = Number(v) || 0;
  const esc = (x, suf) =>
    (Math.abs(x - Math.round(x)) < 0.05 ? inteiro(x) : um(x)) + suf;
  if (n >= 1e9) return esc(n / 1e9, " bi");
  if (n >= 1e6) return esc(n / 1e6, " mi");
  if (n >= 1e3) return esc(n / 1e3, " mil");
  return inteiro(n);
}

/** Marcas de eixo ja formatadas, porque o Plotly as escreveria em ingles. */
export function marcas(maximo, quantas = 5) {
  if (!(maximo > 0)) return { tickvals: [0], ticktext: ["0"] };
  const bruto = maximo / quantas;
  const mag = Math.pow(10, Math.floor(Math.log10(bruto)));
  const passo = [1, 2, 2.5, 5, 10].map((k) => k * mag)
    .find((k) => k >= bruto) || 10 * mag;
  const vals = [];
  for (let v = 0; v <= maximo * 1.0001; v += passo) vals.push(v);
  return { tickvals: vals, ticktext: vals.map(curto) };
}

/** Marcas de uma escala logaritmica: as potencias de dez do intervalo. */
export function marcasLog(minExp, maxExp) {
  const vals = [], txt = [];
  for (let e = Math.floor(minExp); e <= Math.ceil(maxExp); e++) {
    vals.push(e);
    txt.push(curto(Math.pow(10, e)));
  }
  return { tickvals: vals, ticktext: txt };
}

/** Corta um texto longo preservando palavra inteira. */
export function apara(t, max) {
  t = String(t || "");
  if (t.length <= max) return t;
  const corte = t.slice(0, max);
  const esp = corte.lastIndexOf(" ");
  return (esp > max * 0.6 ? corte.slice(0, esp) : corte) + "…";
}

/** Escapa texto que vai para dentro de HTML. */
export function esc(t) {
  return String(t == null ? "" : t)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Nome proprio a partir do caixa-alta do Google ("SAMSUNG ELECTRONICS"). */
export function capitaliza(t) {
  const s = String(t || "").trim();
  if (!s) return "";
  if (s !== s.toUpperCase()) return s;
  const miudas = new Set(["de", "da", "do", "e", "of", "and", "the", "for",
                          "et", "von", "van", "der", "di", "la", "le"]);
  const siglas = new Set(["S", "A", "SA", "LTD", "LTDA", "INC", "LLC", "PLC",
                          "GMBH", "AG", "KG", "BV", "NV", "AB", "AS", "OY",
                          "SAS", "SRL", "SPA", "KK", "CO", "CORP", "IBM",
                          "LG", "SK", "NEC", "NTT", "BASF", "3M", "USA",
                          "UK", "EUA", "P", "L", "S/A"]);
  return s.split(/\s+/).map((p, i) => {
    const limpo = p.replace(/[^A-Za-z0-9]/g, "");
    if (siglas.has(limpo)) return p;
    const baixo = p.toLowerCase();
    if (i > 0 && miudas.has(baixo)) return baixo;
    return baixo.charAt(0).toUpperCase() + baixo.slice(1);
  }).join(" ");
}
