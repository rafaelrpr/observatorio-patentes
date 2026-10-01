// Estado dos filtros e traducao para SQL.
//
// Um principio: o filtro nunca "conserta" o dado. Se o usuario pede a
// lente do titular, o universo passa a ser so o que declara pais do
// titular — e a pagina diz quanto ficou de fora, em vez de somar as duas
// lentes, o que contaria a mesma publicacao duas vezes.

import { lista } from "./motor.js";

export const estado = {
  lente: "of",        // "of" = escritorio do deposito | "ti" = pais do titular
  paises: [],         // ids de pais
  ano1: "", ano2: "", // vazio = todo o periodo, inclusive sem data
  setor: "tudo",
  familia: "",        // familia dentro do setor, quando ele tem
  sec: "", cls: "", sub: "",
  conc: "",
  nivel: "sec",       // detalhamento do perfil tecnologico
  pai: "",            // no pai do detalhamento
};

export const colPais = () => (estado.lente === "of" ? "p" : "tp");

/** O setor escolhido, do catalogo montado a partir dos dicionarios. */
export function setorAtual() {
  return (window.META.setores.find((s) => s.id === estado.setor)
          || window.META.setores[0]);
}

/** A familia escolhida dentro do setor, ou null. */
export function familiaAtual() {
  if (!estado.familia) return null;
  return (setorAtual().familias || []).find((f) => f.id === estado.familia)
         || null;
}

/** As subclasses que o recorte de setor deixa passar: a familia, se houver. */
export function subsDoSetor() {
  const f = familiaAtual();
  return f ? f.subs : setorAtual().subs;
}

/**
 * Condicoes sobre a view `f` (o cubo mestre ja com secao, classe e
 * subclasse). Devolve um array de pedacos para juntar com AND.
 */
export function condicoes({ semPais = false, semIpc = false, semAno = false,
                             semConc = false } = {}) {
  const c = [];
  const col = colPais();

  // A lente do titular so existe onde o titular declara pais. Sem esta
  // linha, o "pais 0" (sem informacao) viraria o maior do mundo.
  if (estado.lente === "ti") c.push("tp <> 0");

  if (!semPais) {
    const ps = lista(estado.paises);
    if (ps) c.push(`${col} IN (${ps})`);
  }
  if (!semAno) {
    if (estado.ano1 !== "") c.push(`a >= ${Number(estado.ano1)}`);
    if (estado.ano2 !== "") c.push(`a <= ${Number(estado.ano2)}`);
  }
  if (!semConc) {
    if (estado.conc === "1") c.push("g");
    if (estado.conc === "0") c.push("NOT g");
  }

  if (!semIpc) {
    const s = setorAtual();
    if (s.regra === "secao") {
      c.push(`sec IN (${lista(s.subs)})`);
    } else if (s.regra === "sub") {
      c.push(`sub IN (${lista(subsDoSetor())})`);
    }
    if (estado.sub) c.push(`sub = '${estado.sub}'`);
    else if (estado.cls) c.push(`cls = '${estado.cls}'`);
    else if (estado.sec) c.push(`sec = '${estado.sec}'`);
  }
  return c;
}

export function onde(op = {}) {
  const c = condicoes(op);
  return c.length ? "WHERE " + c.join(" AND ") : "";
}

/**
 * As mesmas condicoes traduzidas para o cubo de depositantes, que guarda
 * pais e subclasse como TEXTO (e nao tem codigo IPC completo nem
 * concessao). O que nao existe la e simplesmente omitido — e a dica do
 * grafico avisa.
 */
export function ondeTitulares(mapaPais) {
  const c = [];
  const col = estado.lente === "of" ? "pais" : "tpais";
  if (estado.lente === "ti") c.push("tpais IS NOT NULL");
  if (estado.paises.length) {
    const isos = estado.paises.map((id) => mapaPais.get(id))
                              .filter(Boolean).map((x) => `'${x}'`);
    if (isos.length) c.push(`${col} IN (${isos.join(",")})`);
    else c.push("1 = 0");
  }
  if (estado.ano1 !== "") c.push(`ano >= ${Number(estado.ano1)}`);
  if (estado.ano2 !== "") c.push(`ano <= ${Number(estado.ano2)}`);

  const s = setorAtual();
  if (s.regra === "secao") {
    c.push("(" + s.subs.map((x) => `sub LIKE '${x}%'`).join(" OR ") + ")");
  } else if (s.regra === "sub") {
    c.push(`sub IN (${lista(subsDoSetor())})`);
  }
  if (estado.sub) c.push(`sub = '${estado.sub}'`);
  else if (estado.cls) c.push(`sub LIKE '${estado.cls}%'`);
  else if (estado.sec) c.push(`sub LIKE '${estado.sec}%'`);
  return c.length ? "WHERE " + c.join(" AND ") : "";
}

/** Frase curta que descreve o recorte, para subtitulos e para o CSV. */
export function descricao(nomePais) {
  const p = [];
  p.push(estado.lente === "of" ? "por escritório de depósito"
                               : "por país do titular");
  if (estado.paises.length === 1) p.push(nomePais(estado.paises[0]));
  else if (estado.paises.length > 1) p.push(`${estado.paises.length} países`);
  else p.push("mundo");
  const s = setorAtual();
  if (s.id !== "tudo") p.push(s.nome);
  const f = familiaAtual();
  if (f) p.push(f.nome);
  if (estado.sub) p.push(estado.sub);
  else if (estado.cls) p.push(estado.cls);
  else if (estado.sec) p.push("seção " + estado.sec);
  if (estado.ano1 !== "" || estado.ano2 !== "") {
    p.push((estado.ano1 || "início") + "–" + (estado.ano2 || "fim"));
  }
  if (estado.conc === "1") p.push("só concedidas");
  if (estado.conc === "0") p.push("sem data de concessão");
  return p.join(" · ");
}

export function limpar() {
  Object.assign(estado, {
    lente: "of", paises: [], ano1: "", ano2: "", setor: "tudo",
    familia: "", sec: "", cls: "", sub: "", conc: "", nivel: "sec", pai: "",
  });
}
