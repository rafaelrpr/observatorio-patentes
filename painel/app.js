// Observatorio Mundial de Patentes — orquestracao.
//
// Fluxo: sobe o DuckDB-WASM, anexa os cubos, monta duas views e repinta
// tudo a cada mudanca de filtro. Nenhum numero e escrito a mao: todos
// saem de uma consulta SQL sobre o arquivo local.

import * as motor from "./src/motor.js";
import * as G from "./src/graficos.js";
import { estado, colPais, setorAtual, onde, ondeTitulares, descricao, limpar }
  from "./src/filtros.js";
import { inteiro, curto, pct, um, esc, apara, capitaliza }
  from "./src/formato.js";
import { montarNotas, dicas } from "./src/metodologia.js";

// Sinal de vida para a rede de segurança do observatorio.html: se este
// módulo não carregar (o navegador bloqueia módulo em file:// sem
// permissão), aquele script clássico assume e explica.
window.__vivo = true;

const $ = (id) => document.getElementById(id);
const META = window.META;
const MALHA = window.MUNDO;

let duckdb = null;
let nomePorId = new Map();      // id -> nome em portugues
let isoPorId = new Map();       // id -> ISO
let idPorIso = new Map();
let nomePorIso = {};            // ISO -> nome em portugues, para o mapa
let subPorCodigo = new Map();   // "G06F" -> verbete
let clsPorCodigo = new Map();
let secPorCodigo = new Map();
let usaCodigoCompleto = false;  // consultas precisam da view pesada?
let ultimaTabela = { linhas: [], colunas: [], pagina: 0, total: 0 };
let repintando = false;
let pendente = false;

// ABAS. A pagina era uma rolagem so com sete paineis; agora cada aba e
// uma tela. Isso nao e so estetica: o Plotly mede zero em container
// escondido, entao desenhar o que nao esta visivel produzia grafico de
// altura zero. Repinta-se o que entra.
const ABAS = ["panorama", "territorios", "tecnologia", "tempo",
              "depositantes", "tabela", "metodologia"];
let aba = "panorama";

// =====================================================================
// carregamento sob demanda dos cubos
// =====================================================================
// Sob file:// o navegador lê o arquivo inteiro. Carregar os 152 MB dos
// dois cubos grandes na abertura atrasava a primeira tela — que não usa
// nenhum dos dois. Agora só chegam quando a pergunta exige.
const CUBOS = {
  fato_sub: ["fato_sub.parquet", "cubo por subclasse (9 MB)"],
  subclasses_usadas: ["subclasses_usadas.parquet", "subclasses"],
  paises: ["paises.parquet", "países"],
  ipc_uso: ["ipc_uso.parquet", "códigos usados na base"],
  fato: ["fato.parquet", "cubo por código IPC (95 MB)"],
  ipc_dic: ["ipc_dic.parquet", "dicionário da IPC (3 MB)"],
  titulares: ["titulares.parquet", "cubo de depositantes (57 MB)"],
};
const LEVES = [["fato_sub"], ["subclasses_usadas"], ["paises"], ["ipc_uso"]]
  .map(([n]) => [n, CUBOS[n][0], CUBOS[n][1]]);
const emCurso = new Map();

/** Anexa um cubo se ainda não estiver anexado. Seguro em paralelo. */
function garantir(nome) {
  if (!emCurso.has(nome)) {
    emCurso.set(nome, (async () => {
      await motor.anexar(nome, CUBOS[nome][0], duckdb);
      if (nome === "fato") {
        await motor.sql(`CREATE OR REPLACE VIEW f AS
          SELECT t.p, t.tp, t.a, t.g, t.n, u.ipc, u.sub, u.cls, u.sec
          FROM fato t LEFT JOIN ipc_uso u ON u.id = t.c`);
      }
    })());
  }
  return emCurso.get(nome);
}

/**
 * Roda um painel pesado sem travar a pintura do resto. O contador
 * mantém window.__ocupado verdadeiro até o último terminar, para o
 * teste não ler a tela pela metade.
 */
let emVoo = 0;
function voar(promessa) {
  emVoo++;
  return promessa.catch((e) => console.error("painel falhou:", e))
    .finally(() => {
      emVoo--;
      if (!repintando && emVoo === 0) window.__ocupado = false;
    });
}

// =====================================================================
// abertura
// =====================================================================
function aviso(texto, fracao) {
  $("ab-texto").textContent = texto;
  $("ab-barra").style.width = Math.round(fracao * 100) + "%";
}

function falhar(e) {
  const cx = $("erro-abertura");
  cx.hidden = false;
  const bloqueado = /Failed to fetch|NetworkError|TypeError/i.test(
    String(e && e.message));
  // Mesma página, dois caminhos: duplo clique na pasta e endereço
  // publicado. A causa provável de uma leitura falha é outra em cada um.
  const local = location.protocol === "file:";
  cx.innerHTML = bloqueado
    ? (local
      ? "<b>O navegador bloqueou a leitura dos arquivos locais.</b><br><br>"
        + "Esta página lê os dados de arquivos que estão na mesma pasta, e o "
        + "Chrome e o Edge só permitem isso quando são abertos com uma "
        + "permissão explícita.<br><br>Feche esta janela e abra o "
        + "<code>abrir.bat</code> que está na pasta — ele faz exatamente "
        + "isso."
      : "<b>Não foi possível baixar os dados do painel.</b><br><br>"
        + "Esta página lê cubos de dados que ficam ao lado dela no "
        + "servidor. Verifique a conexão e recarregue; se o erro "
        + "persistir, algum arquivo pode não ter subido na publicação.")
      + "<br><br><span style='color:var(--ink-faint)'>Detalhe técnico: "
      + esc(String(e && e.message)) + "</span>"
    : "<b>Não foi possível iniciar.</b><br><br>" + esc(String(e && e.stack || e));
  $("ab-titulo").textContent = "Não abriu";
  $("ab-texto").textContent = "";
}

async function abrir() {
  try {
    const r = await motor.iniciar(aviso);
    duckdb = r.duckdb;

    for (let i = 0; i < LEVES.length; i++) {
      aviso("carregando " + LEVES[i][2] + "...",
            0.2 + 0.6 * (i / LEVES.length));
      await garantir(LEVES[i][0]);
    }

    aviso("preparando as consultas...", 0.85);
    // view leve (6,6 milhoes) — atende tudo que para na subclasse
    await motor.sql(`CREATE OR REPLACE VIEW fs AS
      SELECT t.p, t.tp, t.a, t.g, t.n, d.sub,
             substr(d.sub, 1, 3) AS cls, substr(d.sub, 1, 1) AS sec
      FROM fato_sub t LEFT JOIN subclasses_usadas d ON d.id = t.s`);

    // quantas subclasses a base realmente usa — inclui as historicas,
    // que sao mais que as 655 da IPC vigente
    window.__nsub = Number((await motor.sql1(
      "SELECT count(*) AS n FROM subclasses_usadas")).n || 0);

    for (const r of await motor.sql("SELECT id, pais FROM paises")) {
      isoPorId.set(r.id, r.pais);
      idPorIso.set(r.pais, r.id);
    }
    for (const p of META.paises) {
    nomePorId.set(p.id, p.nome);
    if (p.iso) nomePorIso[p.iso] = p.nome;
  }
    for (const s of META.subclasses) subPorCodigo.set(s.sub, s);
    for (const c of META.classes) clsPorCodigo.set(c.c, c);
    for (const s of META.secoes) secPorCodigo.set(s.s, s);

    montarInterface();
    aviso("desenhando...", 0.97);
    await atualizar();
    $("abertura").remove();
  } catch (e) {
    console.error(e);
    falhar(e);
  }
}

// =====================================================================
// interface
// =====================================================================
function montarInterface() {
  const b = META.base;
  $("linha-base").innerHTML =
    inteiro(b.linhas) + " publicações de patente, de " + b.ano_min + " a "
    + b.ano_max + ", em " + b.paises + " escritórios. Fonte única: o arquivo "
    + "<code>" + esc(b.arquivo) + "</code>, extraído do Google Patents "
    + "(BigQuery) e lido aqui, no seu navegador.";

  // ------ paises
  const sel = $("f-pais");
  const ordenados = META.paises
    .filter((p) => p.of > 0 || p.ti > 0)
    .sort((a, b2) => b2.of + b2.ti - (a.of + a.ti));
  for (const p of ordenados) {
    const o = document.createElement("option");
    o.value = String(p.id);
    o.textContent = p.nome + " (" + p.iso + ")";
    o.dataset.busca = (p.nome + " " + p.iso).toLowerCase();
    o.dataset.qt = curto(p.of + p.ti);
    sel.appendChild(o);
  }
  ligarBuscaPais();

  // ------ anos
  for (const id of ["f-ano1", "f-ano2"]) {
    const s = $(id);
    const vazio = document.createElement("option");
    vazio.value = "";
    vazio.textContent = id === "f-ano1" ? "Desde o início" : "Até o fim";
    s.appendChild(vazio);
    for (let a = b.ano_max; a >= b.ano_min; a--) {
      const o = document.createElement("option");
      o.value = String(a);
      o.textContent = String(a);
      s.appendChild(o);
    }
    s.addEventListener("change", () => {
      estado[id === "f-ano1" ? "ano1" : "ano2"] = s.value;
      atualizar();
    });
  }

  // ------ setores
  const fs = $("f-setor");
  let grupoAtual = null, alvo = fs;
  for (const s of META.setores) {
    if (s.grupo !== grupoAtual) {
      grupoAtual = s.grupo;
      if (grupoAtual) {
        alvo = document.createElement("optgroup");
        alvo.label = grupoAtual;
        fs.appendChild(alvo);
      } else {
        alvo = fs;
      }
    }
    const o = document.createElement("option");
    o.value = s.id;
    o.textContent = s.nome;
    alvo.appendChild(o);
  }
  fs.addEventListener("change", () => {
    estado.setor = fs.value;
    estado.nivel = "sec"; estado.pai = "";
    atualizar();
  });

  // ------ IPC em cascata
  const fSec = $("f-sec"), fCls = $("f-cls"), fSub = $("f-sub");
  for (const s of META.secoes) {
    fSec.appendChild(new Option(s.s + " · " + s.pt, s.s));
  }
  const encherClasses = () => {
    fCls.length = 1;
    for (const c of META.classes) {
      if (!estado.sec || c.s === estado.sec) {
        fCls.appendChild(new Option(c.c + " · " + apara(c.t, 42), c.c));
      }
    }
  };
  const encherSubs = () => {
    fSub.length = 1;
    for (const s of META.subclasses) {
      if (estado.cls ? s.c === estado.cls
                     : (!estado.sec || s.s === estado.sec)) {
        fSub.appendChild(new Option(
          s.sub + " · " + apara(s.g || s.t, 40), s.sub));
      }
    }
  };
  encherClasses(); encherSubs();
  fSec.addEventListener("change", () => {
    estado.sec = fSec.value; estado.cls = ""; estado.sub = "";
    encherClasses(); encherSubs(); atualizar();
  });
  fCls.addEventListener("change", () => {
    estado.cls = fCls.value; estado.sub = "";
    if (estado.cls) { estado.sec = estado.cls[0]; fSec.value = estado.sec; }
    encherSubs(); atualizar();
  });
  fSub.addEventListener("change", () => {
    estado.sub = fSub.value;
    if (estado.sub) {
      estado.cls = estado.sub.slice(0, 3); estado.sec = estado.sub[0];
      fSec.value = estado.sec; encherClasses(); fCls.value = estado.cls;
    }
    atualizar();
  });

  $("f-conc").addEventListener("change", (e) => {
    estado.conc = e.target.value; atualizar();
  });

  for (const b2 of document.querySelectorAll(".lente button")) {
    b2.addEventListener("click", () => {
      estado.lente = b2.dataset.lente;
      estado.paises = [];
      for (const o of sel.options) o.selected = false;
      for (const x of document.querySelectorAll(".lente button")) {
        x.setAttribute("aria-pressed", String(x === b2));
      }
      atualizar();
    });
  }

  $("limpar").addEventListener("click", () => {
    limpar();
    sel.selectedIndex = -1;
    for (const o of sel.options) { o.selected = false; o.hidden = false; }
    $("busca-pais").value = "";
    $("pais-sugestoes").hidden = true;
    fichasPais();
    $("f-ano1").value = ""; $("f-ano2").value = "";
    $("f-setor").value = "tudo"; $("f-conc").value = "";
    fSec.value = ""; encherClasses(); fCls.value = ""; encherSubs();
    fSub.value = "";
    for (const x of document.querySelectorAll(".lente button")) {
      x.setAttribute("aria-pressed", String(x.dataset.lente === "of"));
    }
    atualizar();
  });

  // ------ tabela
  $("f-grao").addEventListener("change", () => {
    ultimaTabela.pagina = 0; atualizar();
  });
  let atraso = null;
  $("busca-tabela").addEventListener("input", () => {
    clearTimeout(atraso);
    atraso = setTimeout(() => { ultimaTabela.pagina = 0; atualizar(); }, 320);
  });
  $("tab-ant").addEventListener("click", () => {
    if (ultimaTabela.pagina > 0) { ultimaTabela.pagina--; pintarTabela(); }
  });
  $("tab-prox").addEventListener("click", () => {
    ultimaTabela.pagina++; pintarTabela();
  });
  $("baixar").addEventListener("click", baixarCSV);

  // ------ tema
  const desenharBotao = () => {
    const escuro = document.documentElement.dataset.theme !== "light";
    $("tema").innerHTML = escuro
      ? '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" '
        + 'stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" '
        + 'r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4'
        + 'M17.7 17.7l1.4 1.4M19.1 4.9l-1.4 1.4M6.3 17.7l-1.4 1.4"/></svg>'
      : '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" '
        + 'stroke="currentColor" stroke-width="2"><path d="M21 12.8A9 9 0 '
        + '1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg>';
  };
  desenharBotao();
  $("tema").addEventListener("click", () => {
    const claro = document.documentElement.dataset.theme === "light";
    document.documentElement.dataset.theme = claro ? "dark" : "light";
    desenharBotao();
    atualizar();
  });

  // ------ abas
  for (const b of $("abas").querySelectorAll("button")) {
    b.addEventListener("click", () => {
      if (b.dataset.v === aba) return;
      trocarAba(b.dataset.v);
    });
  }
  // abrir direto numa aba: observatorio.html#tecnologia
  const naUrl = location.hash.replace("#", "");
  if (ABAS.includes(naUrl)) aba = naUrl;
  aplicarAba();

  dicas($);
  montarNotas($, META);
}

function aplicarAba() {
  for (const v of ABAS) $("v-" + v).hidden = v !== aba;
  for (const b of $("abas").querySelectorAll("button")) {
    b.setAttribute("aria-pressed", String(b.dataset.v === aba));
  }
}

function trocarAba(nova) {
  aba = nova;
  aplicarAba();
  history.replaceState(null, "", "#" + nova);
  atualizar();
}

// =====================================================================
// consultas e repintura
// =====================================================================
/** A view leve basta, a menos que a pergunta chegue ao codigo completo. */
function vista() {
  usaCodigoCompleto = (estado.nivel === "ipc"
                       || $("f-grao").value === "ipc");
  return usaCodigoCompleto ? "f" : "fs";
}

async function atualizar() {
  if (repintando) { pendente = true; return; }
  repintando = true;
  window.__ocupado = true;
  document.body.style.cursor = "progress";
  try {
    // Fotografa o estado agora. Sem isso, um clique que chegue no meio
    // dos awaits faria a pagina misturar dois recortes: o numero de um e
    // o rotulo do outro.
    const v = vista();
    const w = onde();
    const col = colPais();
    const lente = estado.lente;
    const wTit = ondeTitulares(isoPorId);

    // os cubos grandes só são buscados quando a pergunta chega neles
    if (v === "f" || estado.nivel === "ipc") await garantir("fato");
    if ($("f-grao").value === "ipc") await garantir("ipc_dic");

    const resumo = await motor.sql1(`
      SELECT sum(n) AS tot,
             count(DISTINCT ${col}) AS paises,
             sum(CASE WHEN g THEN n ELSE 0 END) AS concedidas,
             count(DISTINCT sub) AS subclasses,
             min(CASE WHEN a > 0 THEN a END) AS a1,
             max(CASE WHEN a > 0 THEN a END) AS a2,
             sum(CASE WHEN a = 0 THEN n ELSE 0 END) AS sem_ano
      FROM ${v} ${w}`);
    const total = Number(resumo.tot || 0);

    $("achados-n").textContent = inteiro(total);
    $("achados-t").textContent = total === 1 ? "publicação no recorte"
                                             : "publicações no recorte";

    // a nota do recorte e barata e vale para qualquer aba
    atualizarNotaSetor();

    // Só a aba visível é desenhada. Antes eram sete painéis por
    // repintura, incluindo os dois que dependem do cubo de 57 MB.
    if (aba === "panorama") {
      pintarCartoes(resumo, total, lente, await crescimento(v, w, resumo));
      await Promise.all([
        pintarMapa(v, w, col),
        pintarRoscaSecoes(v, w, total),
      ]);
    } else if (aba === "territorios") {
      await pintarRanking(v, w, col, total);
    } else if (aba === "tecnologia") {
      pintarConcessao(resumo, total);
      await pintarPerfil(v, w, total);
    } else if (aba === "tempo") {
      await Promise.all([pintarSerie(v, w, col), pintarDecadas(v, w)]);
    } else if (aba === "depositantes") {
      // os dois dependem do cubo de 57 MB: não bloqueiam a tela
      voar(pintarTitulares(wTit));
      voar(pintarConcTitulares(wTit));
    } else if (aba === "tabela") {
      await carregarTabela(v, w, col, wTit);
    }
  } catch (e) {
    console.error("falha ao atualizar:", e);
  } finally {
    repintando = false;
    document.body.style.cursor = "";
    if (pendente) { pendente = false; atualizar(); }
    else if (emVoo === 0) window.__ocupado = false;
  }
}

/**
 * Crescimento por MEDIA ANUAL entre duas metades do periodo do recorte.
 *
 * Duas armadilhas evitadas aqui. A primeira: os dois ultimos anos estao
 * incompletos, porque o pedido leva cerca de 18 meses para ser
 * publicado — inclui-los faria toda serie parecer em queda. A segunda:
 * comparar totais de janelas de tamanhos diferentes inverte o sinal, e
 * por isso a conta e sobre a media por ano, nao sobre a soma.
 */
async function crescimento(v, w, r) {
  const fim = Math.min(Number(r.a2 || 0), META.base.ano_max - 2);
  // No maximo os dez ultimos anos uteis. Sem o teto, o recorte padrao
  // partiria 1817–2023 ao meio e anunciaria "+5.856%" — verdadeiro e
  // inutil.
  const ini = Math.max(Number(r.a1 || 0), fim - 9);
  if (!(ini > 0) || fim - ini < 3) return null;
  const meio = Math.floor((ini + fim) / 2);
  const q = await motor.sql1(`
    SELECT sum(CASE WHEN a BETWEEN ${ini} AND ${meio} THEN n ELSE 0 END) AS v1,
           sum(CASE WHEN a BETWEEN ${meio + 1} AND ${fim} THEN n ELSE 0 END) AS v2
    FROM ${v} ${w}`);
  const n1 = meio - ini + 1, n2 = fim - meio;
  const m1 = Number(q.v1 || 0) / n1, m2 = Number(q.v2 || 0) / n2;
  if (!(m1 > 0)) return null;
  return {
    pct: 100 * (m2 / m1 - 1),
    nota: `média por ano de ${meio + 1}–${fim} contra ${ini}–${meio}`,
  };
}

function pintarCartoes(r, total, lente, cresc) {
  const b = META.base;
  const universo = lente === "of" ? b.linhas
                                  : b.linhas - b.sem_pais_titular;
  const conc = Number(r.concedidas || 0);
  const cartoes = [
    ["Publicações", inteiro(total),
     total === universo ? "todo o universo da lente"
                        : pct(100 * total / universo, 2) + " do universo da lente"],
    ["Territórios", inteiro(r.paises || 0),
     lente === "of" ? "escritórios de depósito" : "países de titular"],
    ["Com data de concessão", curto(conc),
     total ? pct(100 * conc / total) + " do recorte" : "—"],
    ["Subclasses IPC", inteiro(r.subclasses || 0), "distintas no recorte"],
    ["Período", (r.a1 || "—") + "–" + (r.a2 || "—"),
     Number(r.sem_ano) ? inteiro(r.sem_ano) + " sem data" : "todas com data"],
  ];
  if (cresc) {
    cartoes.push(["Crescimento",
                  (cresc.pct >= 0 ? "+" : "−") + pct(Math.abs(cresc.pct)),
                  cresc.nota, cresc.pct >= 0 ? "--pos" : "--neg"]);
  }
  $("cartoes").innerHTML = cartoes.map(([rot, val, nota, cor]) =>
    '<div class="cartao"><p class="rotulo">' + esc(rot) + "</p>"
    + '<div class="valor"' + (cor ? ' style="color:var(' + cor + ')"' : "")
    + ">" + esc(val) + "</div>"
    + '<div class="nota">' + esc(nota) + "</div></div>").join("");
}

async function pintarMapa(v, w, col) {
  const comPoligono = new Set(META.paises.filter((p) => p.mapa)
                                         .map((p) => p.iso));
  // O MAPA ignora o filtro de país, porque ele É o seletor: filtrado,
  // esvaziava a tela justo quando o usuário acabava de escolher um país.
  // Os demais filtros valem. O selecionado ganha contorno.
  const wMapa = onde({ semPais: true });
  const mapaLinhas = await motor.sql(`
    SELECT ${col} AS id, sum(n) AS n FROM ${v} ${wMapa}
    ${wMapa ? "AND" : "WHERE"} ${col} <> 0
    GROUP BY 1 ORDER BY n DESC`);
  const totalMapa = mapaLinhas.reduce((s, d) => s + Number(d.n), 0);
  const todos = enriquecer(mapaLinhas, totalMapa);
  const noMapa = todos.filter((d) => comPoligono.has(d.iso));
  const marcados = new Set(estado.paises);
  G.mapa($("mapa"), noMapa, MALHA, (d) => selecionarPais(d.id), marcados,
         nomePorIso);

  const fora = todos.filter((d) => !comPoligono.has(d.iso));
  const somaFora = fora.reduce((s, d) => s + d.n, 0);
  $("sub-mapa").innerHTML = (marcados.size
      ? "Com país selecionado o mapa continua mostrando o mundo — ele é o "
        + "seletor. Os demais filtros valem, e o escolhido ganha contorno. "
      : "")
    + (somaFora
        ? inteiro(somaFora) + " publicações são de " + inteiro(fora.length)
          + " territórios sem polígono na malha (escritórios regionais e "
          + "microestados); eles aparecem no ranking."
        : "");
}

/** Territorios, do maior ao menor. Alimenta o ranking e a curva. */
function enriquecer(linhas, base) {
  return linhas.map((d) => ({
    id: d.id, n: Number(d.n), iso: isoPorId.get(d.id) || "?",
    nome: nomePorId.get(d.id) || isoPorId.get(d.id) || "?",
    share: base ? 100 * Number(d.n) / base : 0,
  }));
}

async function pintarRanking(v, w, col, total) {
  const lista = enriquecer(await motor.sql(`
    SELECT ${col} AS id, sum(n) AS n FROM ${v} ${w}
    ${w ? "AND" : "WHERE"} ${col} <> 0
    GROUP BY 1 ORDER BY n DESC`), total);

  G.barras($("ranking"), lista.slice(0, 15).map((d) => ({
    rotulo: d.nome, titulo: d.nome + " (" + d.iso + ")", n: d.n,
    share: d.share, id: d.id,
  })), { aoClicar: (d) => selecionarPais(d.id) });
  $("sub-ranking").textContent = lista.length > 15
    ? "São os 15 maiores de " + inteiro(lista.length) + " territórios."
    : inteiro(lista.length) + " territórios no recorte.";

  // ---- a curva de concentracao, no painel ao lado
  if (lista.length < 2) {
    G.limpar($("conc-terr"));
    $("conc-terr").innerHTML = '<p style="color:var(--ink-faint);'
      + 'font-size:.85rem;padding:40px 0;text-align:center">Um território '
      + "só no recorte: não há concentração para medir.</p>";
    $("sub-concentracao").textContent = "";
    return;
  }
  let acum = 0;
  const pontos = lista.slice(0, 40).map((d, i) => {
    acum += d.n;
    return { i: i + 1, acum: total ? 100 * acum / total : 0, nome: d.nome };
  });
  G.concentracao($("conc-terr"), pontos, "territórios, do maior ao menor");
  const metade = pontos.find((p) => p.acum >= 50);
  $("sub-concentracao").textContent = metade
    ? "Bastam " + inteiro(metade.i)
      + (metade.i === 1 ? " território" : " territórios")
      + " para chegar à metade do recorte."
    : "A curva cobre os " + inteiro(pontos.length) + " maiores e não "
      + "chega aos 50%: o recorte é muito distribuído.";
}

async function pintarConcTitulares(wTit) {
  const alvo = $("conc-tit");
  aguarde(alvo, "carregando o cubo de depositantes (57 MB)...");
  await garantir("titulares");
  const linhas = await motor.sql(`
    SELECT tit, sum(n) AS n FROM titulares ${wTit}
    GROUP BY 1 ORDER BY n DESC LIMIT 40`);
  const soma = Number((await motor.sql1(
    `SELECT sum(n) AS n FROM titulares ${wTit}`)).n || 0);
  if (!soma || linhas.length < 2) {
    G.limpar(alvo);
    alvo.innerHTML = '<p style="color:var(--ink-faint);font-size:.85rem;'
      + 'padding:40px 0;text-align:center">Não há depositante suficiente '
      + "no recorte para uma curva de concentração.</p>";
    $("sub-conc-tit").textContent = "";
    return;
  }
  let acum = 0;
  const pontos = linhas.map((r, i) => {
    acum += Number(r.n);
    return { i: i + 1, acum: 100 * acum / soma, nome: capitaliza(r.tit) };
  });
  G.concentracao(alvo, pontos, "depositantes, do maior ao menor");
  const metade = pontos.find((p) => p.acum >= 50);
  $("sub-conc-tit").textContent = (metade
    ? "Bastam " + inteiro(metade.i) + " depositantes para metade do que "
      + "está no cubo. "
    : "") + "Percentuais sobre as " + inteiro(soma) + " publicações do "
    + "recorte que o cubo de depositantes cobre.";
}

/**
 * Rosca das areas da IPC. Parte-do-todo legitima: a extracao guardou um
 * codigo por publicacao, entao cada publicacao cai numa secao so.
 */
async function pintarRoscaSecoes(v, w, total) {
  // A rosca desce com o filtro. Com a seção G escolhida havia uma fatia
  // só, e um gráfico de uma fatia não diz nada: agora ela mostra as
  // classes de G. Com uma classe escolhida, as subclasses dela.
  const nivel = estado.cls ? "sub" : (estado.sec ? "cls" : "sec");
  const titulo = {
    sec: "Áreas da classificação",
    cls: "Classes de " + estado.sec,
    sub: "Subclasses de " + estado.cls,
  }[nivel];
  $("tit-rosca").textContent = titulo;

  // O corte A–H só existe no nível da seção: a base carrega alguns
  // milhares de códigos malformados cuja primeira letra não é seção.
  const soAH = nivel === "sec" ? " AND sec BETWEEN 'A' AND 'H'" : "";
  const linhas = await motor.sql(`
    SELECT ${nivel} AS k, sum(n) AS n FROM ${v} ${w}
    ${w ? "AND" : "WHERE"} ${nivel} IS NOT NULL ${soAH}
    GROUP BY 1 ORDER BY n DESC`);

  const fatias = agrupar(linhas.map((r) => {
    const t = rotuloIPC(nivel, r.k);
    return { rotulo: t.curto, titulo: t.longo, n: Number(r.n), k: r.k };
  }), 6);
  const campo = { sec: "f-sec", cls: "f-cls", sub: "f-sub" }[nivel];
  G.rosca($("rosca-secoes"), fatias, {
    centro: "publicações", altura: 358,
    // Mexer no estado e repintar deixaria a cascata de selects
    // apontando para outro lugar. Mover o select e disparar o evento
    // dele faz o caminho inteiro: limpa o que está abaixo, reenche as
    // listas e repinta uma vez só.
    aoClicar: (f) => {
      if (!f.k) return;
      $(campo).value = f.k;
      $(campo).dispatchEvent(new Event("change"));
    },
  });

  const soma = linhas.reduce((a, r) => a + Number(r.n), 0);
  const maior = fatias[0];
  const oQue = { sec: "área", cls: "classe", sub: "subclasse" }[nivel];
  $("sub-rosca").innerHTML = (maior && fatias.length > 1
      ? "A maior " + oQue + " é " + esc(maior.titulo) + ", com "
        + pct(100 * maior.n / (soma || 1)) + " do recorte. Clique numa "
        + "fatia para filtrar por ela. "
      : "")
    + (nivel === "sec" && total > soma
        ? inteiro(total - soma) + " publicações ficam de fora: o código "
          + "IPC guardado não começa por uma seção válida (A–H)."
        : "");
}

/** Concedida ou nao: duas fatias, e a soma fecha em 100% por definicao. */
function pintarConcessao(r, total) {
  const conc = Number(r.concedidas || 0);
  G.rosca($("rosca-concessao"), [
    { rotulo: "Com data de concessão", n: conc },
    { rotulo: "Sem data de concessão", n: Math.max(0, total - conc),
      resto: true },
  ], { centro: "publicações", altura: 358 });
  $("sub-concessao").textContent = total
    ? pct(100 * conc / total) + " do recorte tem data de concessão. Isso "
      + "não é situação jurídica: a base não registra caducidade nem "
      + "anuidade paga."
    : "";
}

/**
 * Media anual por decada. O total mente aqui: a decada de 2020 tem menos
 * anos corridos que a anterior e apareceria em queda por isso. A ultima
 * coluna sai em tom neutro quando a decada esta incompleta.
 */
async function pintarDecadas(v, w) {
  const linhas = await motor.sql(`
    SELECT a - (a % 10) AS d, count(DISTINCT a) AS anos, sum(n) AS n
    FROM ${v} ${w} ${w ? "AND" : "WHERE"} a > 0
    GROUP BY 1 ORDER BY 1`);
  const uteis = linhas.filter((r) => Number(r.anos) > 0).slice(-8);
  const ultima = uteis.length ? Number(uteis[uteis.length - 1].d) : 0;
  G.colunas($("decadas"), uteis.map((r) => {
    const anos = Number(r.anos);
    return {
      rotulo: String(r.d) + "s", titulo: "Década de " + r.d,
      n: Math.round(Number(r.n) / anos), apagado: anos < 10,
      extra: "<br>" + inteiro(r.n) + " publicações em " + anos
             + (anos === 1 ? " ano com dado" : " anos com dado"),
    };
  }), { altura: 332 });
  const incompleta = uteis.filter((r) => Number(r.anos) < 10)
                          .map((r) => r.d + "s");
  $("sub-decadas").textContent = "Cada coluna é a média por ano da década, "
    + "não a soma: décadas com número diferente de anos não se comparam "
    + "pelo total."
    + (incompleta.length
        ? " Em tom neutro, " + incompleta.join(" e ")
          + (incompleta.length === 1 ? ", que não tem" : ", que não têm")
          + " os dez anos no recorte."
        : "")
    + (ultima >= META.base.ano_max - 9
        ? " Os dois últimos anos da base são incompletos: o pedido leva "
          + "cerca de 18 meses para ser publicado."
        : "");
}

/** Topo mais um balde de resto, para a rosca nao virar confete. */
function agrupar(itens, quantas) {
  if (itens.length <= quantas) return itens;
  const topo = itens.slice(0, quantas - 1);
  const cauda = itens.slice(quantas - 1);
  topo.push({
    rotulo: "Outras " + cauda.length,
    titulo: "As outras " + cauda.length + " categorias somadas",
    n: cauda.reduce((a, d) => a + d.n, 0), resto: true,
  });
  return topo;
}

/** Aviso de espera DENTRO do painel: tooltip escondido ninguem le. */
function aguarde(alvo, texto) {
  if (!alvo || (alvo.data && alvo.data.length)) return;
  alvo.innerHTML = '<p style="color:var(--ink-faint);font-size:.85rem;'
    + 'padding:40px 0;text-align:center">' + esc(texto) + "</p>";
}

async function pintarSerie(v, w, col) {
  const varios = estado.paises.length >= 2 && estado.paises.length <= 5;
  if (varios) {
    const linhas = await motor.sql(`
      SELECT ${col} AS id, a, sum(n) AS n FROM ${v} ${w}
      ${w ? "AND" : "WHERE"} a > 0 GROUP BY 1, 2 ORDER BY 1, 2`);
    const por = new Map();
    for (const r of linhas) {
      if (!por.has(r.id)) por.set(r.id, []);
      por.get(r.id).push({ a: r.a, n: Number(r.n) });
    }
    G.serie($("serie"), [...por.entries()].map(([id, pontos]) => ({
      nome: nomePorId.get(id) || isoPorId.get(id) || "?", pontos,
    })));
    $("sub-serie").textContent = "Comparação entre os "
      + estado.paises.length + " países selecionados.";
  } else {
    const linhas = await motor.sql(`
      SELECT a, sum(n) AS n FROM ${v} ${w}
      ${w ? "AND" : "WHERE"} a > 0 GROUP BY 1 ORDER BY 1`);
    G.serie($("serie"), [{
      nome: "Publicações",
      pontos: linhas.map((r) => ({ a: r.a, n: Number(r.n) })),
    }]);
    const pico = linhas.reduce((m, r) => (Number(r.n) > Number(m.n) ? r : m),
                               linhas[0] || { a: 0, n: 0 });
    $("sub-serie").textContent = linhas.length
      ? "Ano de pico: " + pico.a + ", com " + inteiro(pico.n)
        + " publicações. Selecione de 2 a 5 países para comparar."
      : "Sem dados no recorte.";
  }
}

async function pintarPerfil(v, w, total) {
  const nivel = estado.nivel;
  const campo = { sec: "sec", cls: "cls", sub: "sub", ipc: "ipc" }[nivel];
  const vv = nivel === "ipc" ? "f" : v;
  const extra = [];
  if (nivel === "cls" && estado.pai) extra.push(`sec = '${estado.pai}'`);
  if (nivel === "sub" && estado.pai) extra.push(`cls = '${estado.pai}'`);
  if (nivel === "ipc" && estado.pai) extra.push(`sub = '${estado.pai}'`);
  const w2 = extra.length ? (w ? w + " AND " + extra.join(" AND ")
                              : "WHERE " + extra.join(" AND ")) : w;

  // No nivel da secao, so A-H. A base carrega alguns milhares de codigos
  // malformados, cuja primeira letra nao e secao nenhuma; eles viravam
  // barras "0", "N", "R" sem explicacao no alto do grafico.
  const soAH = nivel === "sec" ? ` AND ${campo} BETWEEN 'A' AND 'H'` : "";
  const linhas = await motor.sql(`
    SELECT ${campo} AS k, sum(n) AS n FROM ${vv} ${w2}
    ${w2 ? "AND" : "WHERE"} ${campo} IS NOT NULL ${soAH}
    GROUP BY 1 ORDER BY n DESC LIMIT 14`);

  G.barras($("perfil"), linhas.map((r) => {
    const t = rotuloIPC(nivel, r.k);
    return {
      rotulo: t.curto, titulo: t.longo, n: Number(r.n),
      share: total ? 100 * Number(r.n) / total : 0,
      k: r.k, extra: t.extra,
    };
  }), {
    aoClicar: (d) => {
      if (nivel === "ipc") return;
      estado.nivel = { sec: "cls", cls: "sub", sub: "ipc" }[nivel];
      estado.pai = d.k;
      atualizar();
    },
  });
  $("sub-perfil").innerHTML = "Clique numa barra para descer um nível."
    + (nivel === "sec" && META.base.fora_ah
        ? " <span style='color:var(--ink-faint)'>Ficam de fora "
          + inteiro(META.base.fora_ah) + " publicações cujo código IPC não "
          + "começa por uma seção válida (A–H).</span>"
        : "");
  pintarMigalhas();
}

function rotuloIPC(nivel, k) {
  if (nivel === "sec") {
    const s = secPorCodigo.get(k);
    return { curto: k + " · " + (s ? s.pt : ""),
             longo: k + " — " + (s ? s.t : "sem verbete"), extra: "" };
  }
  if (nivel === "cls") {
    const c = clsPorCodigo.get(k);
    return { curto: k + " · " + apara(c ? c.t : "sem verbete", 34),
             longo: k + " — " + (c ? c.t : "sem verbete no dicionário"),
             extra: "" };
  }
  if (nivel === "sub") {
    const s = subPorCodigo.get(k);
    return {
      curto: k + (s && s.g ? " · " + apara(s.g, 30) : ""),
      longo: k + (s ? " — " + s.t : ""),
      extra: s ? (s.g ? "<br><i>" + s.g + "</i>" : "")
               : "<br><i>código fora da IPC 2026.01</i>",
    };
  }
  return { curto: k, longo: k, extra: "" };
}

function pintarMigalhas() {
  const m = $("migalhas");
  const cadeia = [["Seções", "sec", ""]];
  if (estado.nivel !== "sec" && estado.pai) {
    if (estado.nivel === "cls") cadeia.push(["Classes de " + estado.pai, null]);
    if (estado.nivel === "sub") cadeia.push(["Subclasses de " + estado.pai, null]);
    if (estado.nivel === "ipc") cadeia.push(["Códigos de " + estado.pai, null]);
  }
  m.innerHTML = "";
  cadeia.forEach(([rot, nivel], i) => {
    if (i) m.insertAdjacentHTML("beforeend", "<span>›</span>");
    if (nivel === null) {
      m.insertAdjacentHTML("beforeend",
        '<span style="color:var(--ink)">' + esc(rot) + "</span>");
    } else {
      const b = document.createElement("button");
      b.type = "button";
      b.textContent = rot;
      b.addEventListener("click", () => {
        estado.nivel = nivel; estado.pai = ""; atualizar();
      });
      m.appendChild(b);
    }
  });
}

async function pintarTitulares(w) {
  aguarde($("titulares"), "carregando o cubo de depositantes (57 MB)...");
  await garantir("titulares");
  const linhas = await motor.sql(`
    SELECT tit, any_value(tpais) AS tpais, sum(n) AS n
    FROM titulares ${w} GROUP BY 1 ORDER BY n DESC LIMIT 12`);
  const noRecorte = await motor.sql1(
    `SELECT sum(n) AS n FROM titulares ${w}`);
  const somaCubo = Number(noRecorte.n || 0);

  G.barras($("titulares"), linhas.map((r) => ({
    rotulo: capitaliza(r.tit), titulo: r.tit, n: Number(r.n),
    share: somaCubo ? 100 * Number(r.n) / somaCubo : 0,
    extra: r.tpais ? "<br>país do titular: "
                     + esc(nomePorId.get(idPorIso.get(r.tpais)) || r.tpais)
                   : "",
  })), {});
  $("sub-titulares").innerHTML = somaCubo
    ? "Percentuais sobre as " + inteiro(somaCubo) + " publicações do recorte "
      + "que o cubo de depositantes cobre — não sobre o recorte inteiro."
    : "Nenhum depositante do cubo no recorte.";
}

// =====================================================================
// tabela
// =====================================================================
/** Ano e identificador, nao quantidade: nada de separador de milhar. */
const ano = (v) => (v ? String(v) : "—");

/**
 * Codigo sem verbete: cai para o titulo da subclasse, que quase sempre
 * existe. G06F17/30, por exemplo, saiu da IPC em 2019 e ainda rotula
 * centenas de milhares de publicacoes.
 */
function semVerbete(codigo) {
  const s = subPorCodigo.get(String(codigo).slice(0, 4));
  return s ? "[fora da IPC 2026.01] " + (s.g || s.t)
           : "código fora da IPC 2026.01";
}

const GRAOS = {
  ipc: { v: "f", campo: "ipc", rotulo: "Código IPC" },
  sub: { v: "fs", campo: "sub", rotulo: "Subclasse" },
  pais: { v: "fs", campo: null, rotulo: "Território" },
  ano: { v: "fs", campo: "a", rotulo: "Ano" },
  tit: { v: "titulares", campo: "tit", rotulo: "Depositante" },
};

async function carregarTabela(v, w, col, wt) {
  const grao = $("f-grao").value;
  const busca = $("busca-tabela").value.trim();
  const g = GRAOS[grao];
  let linhas = [];

  if (grao === "tit") {
    await garantir("titulares");
    const filtro = busca
      ? (wt ? wt + " AND " : "WHERE ") + `upper(tit) LIKE upper('%${
          busca.replace(/'/g, "''")}%')`
      : wt;
    linhas = await motor.sql(`
      SELECT tit AS chave, any_value(tpais) AS tpais, sum(n) AS n,
             count(DISTINCT sub) AS subs, min(ano) AS a1, max(ano) AS a2
      FROM titulares ${filtro} GROUP BY 1 ORDER BY n DESC LIMIT 4000`);
    ultimaTabela.colunas = ["Depositante", "País do titular", "Publicações",
                            "Subclasses", "Primeiro ano", "Último ano"];
    ultimaTabela.linhas = linhas.map((r) => [
      capitaliza(r.chave), nomePorId.get(idPorIso.get(r.tpais)) || r.tpais || "—",
      Number(r.n), Number(r.subs), ano(r.a1), ano(r.a2),
    ]);
    ultimaTabela.tipos = ["t", "t", "n", "n", "a", "a"];
  } else if (grao === "pais") {
    const base = await motor.sql(`
      SELECT ${col} AS chave, sum(n) AS n,
             sum(CASE WHEN g THEN n ELSE 0 END) AS conc,
             count(DISTINCT sub) AS subs,
             min(CASE WHEN a > 0 THEN a END) AS a1,
             max(CASE WHEN a > 0 THEN a END) AS a2
      FROM ${v} ${w} ${w ? "AND" : "WHERE"} ${col} <> 0
      GROUP BY 1 ORDER BY n DESC`);
    const q = busca.toLowerCase();
    linhas = base.filter((r) => {
      if (!q) return true;
      const nome = (nomePorId.get(r.chave) || "") + " "
                 + (isoPorId.get(r.chave) || "");
      return nome.toLowerCase().includes(q);
    });
    ultimaTabela.colunas = ["Território", "ISO", "Publicações", "Concedidas",
                            "Subclasses", "De", "Até"];
    ultimaTabela.linhas = linhas.map((r) => [
      nomePorId.get(r.chave) || "?", isoPorId.get(r.chave) || "?",
      Number(r.n), Number(r.conc), Number(r.subs), ano(r.a1), ano(r.a2),
    ]);
    ultimaTabela.tipos = ["t", "t", "n", "n", "n", "a", "a"];
  } else if (grao === "ano") {
    const base = await motor.sql(`
      SELECT a AS chave, sum(n) AS n,
             sum(CASE WHEN g THEN n ELSE 0 END) AS conc,
             count(DISTINCT ${col}) AS paises,
             count(DISTINCT sub) AS subs
      FROM ${v} ${w} ${w ? "AND" : "WHERE"} a > 0
      GROUP BY 1 ORDER BY 1 DESC`);
    linhas = busca ? base.filter((r) => String(r.chave).includes(busca)) : base;
    ultimaTabela.colunas = ["Ano", "Publicações", "Concedidas", "Territórios",
                            "Subclasses"];
    ultimaTabela.linhas = linhas.map((r) => [
      ano(r.chave), Number(r.n), Number(r.conc), Number(r.paises),
      Number(r.subs),
    ]);
    ultimaTabela.tipos = ["a", "n", "n", "n", "n"];
  } else if (grao === "ipc") {
    // O titulo oficial vem do dicionario, por junção em SQL — sao 78.861
    // verbetes, grandes demais para carregar em memoria do lado do JS.
    // O recorte entra numa CTE antes da junção: sem isso a coluna `sub`
    // ficaria ambigua entre o cubo e o dicionario.
    const aspas = busca.replace(/'/g, "''").toUpperCase();
    const filtro = busca
      ? `WHERE upper(b.ipc) LIKE '%${aspas}%' OR upper(coalesce(d.t, ''))`
        + ` LIKE '%${aspas}%'`
      : "";
    linhas = await motor.sql(`
      WITH b AS (
        SELECT ipc, n, g, a, ${col} AS pc FROM f ${w}
        ${w ? "AND" : "WHERE"} ipc IS NOT NULL
      )
      SELECT b.ipc AS chave, coalesce(d.t, '') AS descr, sum(b.n) AS n,
             sum(CASE WHEN b.g THEN b.n ELSE 0 END) AS conc,
             count(DISTINCT b.pc) AS paises,
             min(CASE WHEN b.a > 0 THEN b.a END) AS a1,
             max(CASE WHEN b.a > 0 THEN b.a END) AS a2
      FROM b LEFT JOIN ipc_dic d ON d.ipc = b.ipc
      ${filtro}
      GROUP BY 1, 2 ORDER BY n DESC LIMIT 4000`);
    ultimaTabela.colunas = ["Código IPC", "Descrição", "Publicações",
                            "Concedidas", "Territórios", "De", "Até"];
    ultimaTabela.linhas = linhas.map((r) => [
      r.chave, r.descr || semVerbete(r.chave), Number(r.n),
      Number(r.conc), Number(r.paises), ano(r.a1), ano(r.a2),
    ]);
    ultimaTabela.tipos = ["t", "t", "n", "n", "n", "a", "a"];
  } else {
    const base = await motor.sql(`
      SELECT sub AS chave, sum(n) AS n,
             sum(CASE WHEN g THEN n ELSE 0 END) AS conc,
             count(DISTINCT ${col}) AS paises,
             min(CASE WHEN a > 0 THEN a END) AS a1,
             max(CASE WHEN a > 0 THEN a END) AS a2
      FROM fs ${w} ${w ? "AND" : "WHERE"} sub IS NOT NULL
      GROUP BY 1 ORDER BY n DESC LIMIT 4000`);
    const q = busca.toLowerCase();
    const descreve = (k) => {
      const s = subPorCodigo.get(k);
      return s ? (s.g ? s.g + " — " + s.t : s.t)
               : "subclasse fora da IPC 2026.01";
    };
    linhas = base.filter((r) => !q
      || String(r.chave).toLowerCase().includes(q)
      || descreve(r.chave).toLowerCase().includes(q));
    ultimaTabela.colunas = ["Subclasse", "Descrição", "Publicações",
                            "Concedidas", "Territórios", "De", "Até"];
    ultimaTabela.linhas = linhas.map((r) => [
      r.chave, descreve(r.chave), Number(r.n), Number(r.conc),
      Number(r.paises), ano(r.a1), ano(r.a2),
    ]);
    ultimaTabela.tipos = ["t", "t", "n", "n", "n", "a", "a"];
  }
  ultimaTabela.pagina = 0;
  $("sub-tabela").innerHTML = "Cada linha é um agregado do cubo, não uma "
    + "publicação individual — a base tem 166,9 milhões de registros e "
    + "carregá-los aqui derrubaria o navegador. Recorte: "
    + esc(descricao((id) => nomePorId.get(id) || "?")) + ".";
  pintarTabela();
}

function pintarTabela() {
  const POR_PAGINA = 40;
  const t = ultimaTabela;
  const paginas = Math.max(1, Math.ceil(t.linhas.length / POR_PAGINA));
  t.pagina = Math.max(0, Math.min(t.pagina, paginas - 1));
  const fatia = t.linhas.slice(t.pagina * POR_PAGINA,
                               (t.pagina + 1) * POR_PAGINA);

  const tipos = t.tipos || t.colunas.map(() => "t");
  $("tab-cab").innerHTML = t.colunas.map((c, i) =>
    '<th class="' + (tipos[i] === "t" ? "" : "num")
    + '" data-col="' + i + '">' + esc(c) + "</th>").join("");
  for (const th of $("tab-cab").children) {
    th.addEventListener("click", () => ordenar(Number(th.dataset.col)));
  }
  $("tab-corpo").innerHTML = fatia.map((l) =>
    "<tr>" + l.map((c, i) => {
      if (tipos[i] === "n") return '<td class="num">' + inteiro(c) + "</td>";
      if (tipos[i] === "a") return '<td class="num">' + esc(c) + "</td>";
      const classe = i === 0 ? "cod" : (i === 1 ? "larga" : "");
      return '<td class="' + classe + '">' + esc(c) + "</td>";
    }).join("") + "</tr>").join("");

  $("tab-pag").textContent = inteiro(t.linhas.length) + " linhas · página "
    + inteiro(t.pagina + 1) + " de " + inteiro(paginas);
  $("tab-ant").disabled = t.pagina === 0;
  $("tab-prox").disabled = t.pagina >= paginas - 1;
}

let ordemCol = -1, ordemAsc = false;
function ordenar(i) {
  ordemAsc = ordemCol === i ? !ordemAsc : false;
  ordemCol = i;
  ultimaTabela.linhas.sort((a, b) => {
    const x = a[i], y = b[i];
    const cmp = (typeof x === "number" && typeof y === "number")
      ? x - y : String(x).localeCompare(String(y), "pt-BR");
    return ordemAsc ? cmp : -cmp;
  });
  ultimaTabela.pagina = 0;
  pintarTabela();
}

function baixarCSV() {
  const t = ultimaTabela;
  const linhas = [
    ["# Observatório Mundial de Patentes — recorte: "
     + descricao((id) => nomePorId.get(id) || "?")],
    ["# Fonte: " + META.base.arquivo + " (Google Patents via BigQuery)"],
    ["# Unidade: publicação de patente. Um código IPC por publicação."],
    t.colunas,
    ...t.linhas,
  ];
  const csv = "﻿" + linhas.map((l) => l.map((c) => {
    const s = String(c == null ? "" : c);
    return /[";\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  }).join(";")).join("\r\n");

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "observatorio_patentes.csv";
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 2000);
}

// =====================================================================
// apoio
// =====================================================================
// =====================================================================
// o filtro de pais
// =====================================================================
// So o campo de busca aparece; as sugestoes surgem ao digitar e o que
// foi escolhido vira ficha. O <select multiple> segue existindo,
// escondido, porque o clique no mapa e o botao de limpar ja falavam com
// ele — trocar a interface nao precisava mexer nessas duas pontas.
function ligarBuscaPais() {
  const sel = $("f-pais");
  const campo = $("busca-pais");
  const lista = $("pais-sugestoes");
  let marcado = -1;

  function candidatos() {
    const t = campo.value.trim().toLowerCase();
    if (!t) return [];
    const achados = [];
    for (const o of sel.options) {
      if (o.selected || !o.dataset.busca.includes(t)) continue;
      achados.push(o);
      if (achados.length >= 8) break;
    }
    return achados;
  }

  function fechar() {
    lista.hidden = true;
    lista.replaceChildren();
    marcado = -1;
    campo.setAttribute("aria-expanded", "false");
  }

  function abrir() {
    if (!campo.value.trim()) { fechar(); return; }
    const achados = candidatos();
    lista.replaceChildren();
    if (!achados.length) {
      const li = document.createElement("li");
      li.className = "vazio";
      li.textContent = "nenhum país com esse nome";
      lista.appendChild(li);
    }
    for (const o of achados) {
      const li = document.createElement("li");
      li.setAttribute("role", "option");
      li.dataset.id = o.value;
      const nome = document.createElement("span");
      nome.textContent = o.textContent;
      const qt = document.createElement("span");
      qt.className = "qt";
      qt.textContent = o.dataset.qt;
      li.append(nome, qt);
      // mousedown, nao click: o blur do campo chega antes do click e
      // fecharia a lista debaixo do cursor
      li.addEventListener("mousedown", (ev) => {
        ev.preventDefault();
        escolher(Number(o.value));
      });
      lista.appendChild(li);
    }
    lista.hidden = false;
    marcado = -1;
    campo.setAttribute("aria-expanded", "true");
  }

  function escolher(id) {
    for (const o of sel.options) {
      if (Number(o.value) === id) o.selected = true;
    }
    estado.paises = [...sel.selectedOptions].map((o) => Number(o.value));
    campo.value = "";
    fechar();
    fichasPais();
    atualizar();
  }

  campo.addEventListener("input", abrir);
  campo.addEventListener("focus", abrir);
  campo.addEventListener("blur", () => setTimeout(fechar, 120));
  campo.addEventListener("keydown", (ev) => {
    if (ev.key === "Escape") { fechar(); return; }
    const itens = [...lista.querySelectorAll("li[data-id]")];
    if (!itens.length) return;
    if (ev.key === "ArrowDown" || ev.key === "ArrowUp") {
      ev.preventDefault();
      marcado += ev.key === "ArrowDown" ? 1 : -1;
      if (marcado < 0) marcado = itens.length - 1;
      if (marcado >= itens.length) marcado = 0;
      itens.forEach((li, i) =>
        li.setAttribute("aria-selected", String(i === marcado)));
      itens[marcado].scrollIntoView({ block: "nearest" });
    } else if (ev.key === "Enter") {
      ev.preventDefault();
      escolher(Number(itens[marcado >= 0 ? marcado : 0].dataset.id));
    }
  });
  fichasPais();
}

function fichasPais() {
  const sel = $("f-pais");
  const alvo = $("pais-fichas");
  if (!alvo) return;
  alvo.replaceChildren();
  for (const o of [...sel.selectedOptions]) {
    const f = document.createElement("span");
    f.className = "ficha";
    f.append(document.createTextNode(o.textContent));
    const x = document.createElement("button");
    x.type = "button";
    x.textContent = "\u00d7";
    x.setAttribute("aria-label", "tirar " + o.textContent + " do filtro");
    x.addEventListener("click", () => {
      o.selected = false;
      estado.paises = [...sel.selectedOptions].map((v) => Number(v.value));
      fichasPais();
      atualizar();
    });
    f.appendChild(x);
    alvo.appendChild(f);
  }
}

function selecionarPais(id) {
  const sel = $("f-pais");
  const jaTinha = estado.paises.includes(id);
  for (const o of sel.options) {
    if (Number(o.value) === id) o.selected = !jaTinha;
  }
  estado.paises = [...sel.selectedOptions].map((o) => Number(o.value));
  fichasPais();
  atualizar();
}

function atualizarNotaSetor() {
  const s = setorAtual();
  const alvo = $("corpo-nota-setor");
  const lista = s.subs.length && s.regra === "sub"
    ? "<p><strong>Códigos usados</strong> (" + s.subs.length + " subclasses): "
      + "<code>" + s.subs.join("</code> <code>") + "</code></p>"
    : (s.regra === "secao"
        ? "<p><strong>Regra de inclusão:</strong> o código IPC da publicação "
          + "começa por <code>" + s.subs.join("</code> ou <code>")
          + "</code>.</p>"
        : "");
  alvo.innerHTML =
    "<h4>" + esc(s.nome.replace(/^· /, "")) + "</h4>"
    + '<p class="destaque">' + esc(s.nota) + "</p>"
    + lista
    + (s.regra === "sub"
        ? "<p><strong>Regra de inclusão:</strong> a subclasse do código IPC "
          + "da publicação está na lista acima.</p>"
        : "")
    + "<p><strong>Fonte da definição:</strong> " + esc(s.fonte) + "</p>"
    + "<p><strong>Limitação que vale para todos os setores:</strong> a base "
    + "guarda <strong>um único código IPC por publicação</strong>, e ele não "
    + "é necessariamente o principal. Uma publicação que também tratava "
    + "deste setor, mas cujo código guardado caiu em outro, não aparece "
    + "aqui. O efeito é maior nos escritórios que classificam com mais "
    + "códigos — ver a metodologia geral.</p>";
  $("nota-setor").querySelector("summary").textContent =
    "Nota metodológica — " + s.nome.replace(/^· /, "");
}

abrir();
