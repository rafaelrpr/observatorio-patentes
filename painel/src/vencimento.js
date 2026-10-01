// Aba Vencimento: quando termina o prazo maximo das patentes concedidas.
//
// O numero e um TETO LEGAL, nao o fim real: a base nao tem situacao
// juridica, entao nao sabe quem deixou de pagar anuidade (e caducou
// antes) nem quem ganhou prorrogacao. A pagina diz isso junto de cada
// numero. O calculo esta em preparar/05_vencimento.py.

import { inteiro, curto, pct, esc, apara } from "./formato.js";
import { onde, colPais, estado } from "./filtros.js";

// escolhas proprias da aba; o resto do recorte vem da lateral
export const venc = { k: "0", janela: 5 };

const TIPO = { "0": "patentes de invenção", "1": "modelos de utilidade",
               "": "patentes e modelos de utilidade" };

/** Liga os botoes da aba. `repintar` e o atualizar() da pagina. */
export function ligarVencimento($, repintar) {
  for (const [grupo, campo] of [["venc-tipo", "k"], ["venc-janela", "janela"]]) {
    for (const b of $(grupo).querySelectorAll("button")) {
      b.addEventListener("click", () => {
        const v = campo === "janela" ? Number(b.dataset.v) : b.dataset.v;
        if (venc[campo] === v) return;
        venc[campo] = v;
        for (const x of $(grupo).querySelectorAll("button")) {
          x.setAttribute("aria-pressed", String(x === b));
        }
        repintar();
      });
    }
  }
}

/**
 * Pinta a aba. `ctx` traz o que mora no app: motor, graficos, nomes de
 * pais e o titulo da subclasse no idioma escolhido.
 */
export async function pintarVencimento($, ctx) {
  const { motor, G, nomePais, isoPais, titulo, aoPais } = ctx;
  const V = window.META.vencimento;
  const ref = V.ano_ref;
  const ate = ref + venc.janela - 1;
  // Deposito recente = provavelmente ainda em exame. A invencao leva anos
  // para ser concedida; o modelo de utilidade, meses (a China, que tem
  // quase todos, concede em menos de um ano). Por isso a regua difere.
  const am = window.META.base.ano_max;
  const recente = `((k = 0 AND d >= ${am - 4}) OR (k = 1 AND d >= ${am - 1}))`;
  // periodo e situacao de concessao nao se aplicam: aqui tudo e concedido,
  // e o ano que importa e o do vencimento, nao o da publicacao
  const base = onde({ semAno: true, semConc: true });
  const cond = [base.replace(/^WHERE /, "")].filter(Boolean);
  if (venc.k !== "") cond.push(`k = ${Number(venc.k)}`);
  const w = cond.length ? "WHERE " + cond.join(" AND ") : "";
  const e = (x) => (w ? w + " AND " + x : "WHERE " + x);
  const col = colPais();

  const [anos, subs, terr] = await Promise.all([
    motor.sql(`SELECT v, sum(n) AS n,
                 sum(CASE WHEN ${recente} THEN n ELSE 0 END) AS rec
               FROM fv ${w} GROUP BY 1 ORDER BY 1`),
    motor.sql(`SELECT sub, sum(n) AS n FROM fv
               ${e(`v BETWEEN ${ref} AND ${ate} AND sub IS NOT NULL`)}
               GROUP BY 1 ORDER BY 2 DESC LIMIT 15`),
    motor.sql(`SELECT ${col} AS id, sum(n) AS n FROM fv
               ${e(`v BETWEEN ${ref} AND ${ate} AND ${col} <> 0`)}
               GROUP BY 1 ORDER BY 2 DESC LIMIT 15`),
  ]);

  const total = anos.reduce((s, r) => s + Number(r.n), 0);
  const naJanela = anos.filter((r) => r.v <= ate)
                       .reduce((s, r) => s + Number(r.n), 0);
  const esteAno = Number((anos.find((r) => r.v === ref) || {}).n || 0);
  // ano de pico so entre os anos completos: o fim da serie vem de
  // depositos recentes, muitos ainda em exame e fora da conta
  const completos = anos.filter((r) => Number(r.rec) <= 0.5 * Number(r.n));
  const pico = completos.reduce((m, r) => (Number(r.n) > Number(m.n) ? r : m),
                                completos[0] || { v: "—", n: 0 });

  const cartoes = [
    ["Com prazo correndo", curto(total),
     TIPO[venc.k] + " concedidas, prazo até " + ref + " ou depois"],
    ["Vencem em " + ref, curto(esteAno),
     total ? pct(100 * esteAno / total) + " das com prazo correndo" : "—"],
    ["Vencem até " + ate, curto(naJanela),
     total ? pct(100 * naJanela / total) + " — próximos " + venc.janela
             + " anos" : "—"],
    ["Ano com mais vencimentos", String(pico.v),
     pico.n ? inteiro(pico.n) + " no ano" : "—"],
  ];
  $("cartoes-venc").innerHTML = cartoes.map(([rot, val, nota]) =>
    '<div class="cartao"><p class="rotulo">' + esc(rot) + "</p>"
    + '<div class="valor">' + esc(val) + "</div>"
    + '<div class="nota">' + esc(nota) + "</div></div>").join("");

  G.colunas($("venc-ano"), anos.map((r) => {
    const n = Number(r.n), parcial = Number(r.rec) > 0.5 * n;
    return {
      rotulo: String(r.v), titulo: "Prazo máximo termina em " + r.v, n,
      apagado: parcial,
      extra: " concedidas"
        + (parcial ? "<br>a maior parte vem de depósitos recentes,"
                     + "<br>muitos ainda em exame: número parcial"
                   : ""),
    };
  }), { altura: 320 });
  const parciais = anos.filter((r) => Number(r.rec) > 0.5 * Number(r.n));
  $("sub-venc-ano").textContent = total
    ? "Cada coluna conta as " + TIPO[venc.k] + " concedidas cujo prazo "
      + "máximo termina naquele ano. É o teto da lei: muitas caducam antes, "
      + "por falta de anuidade, e a base não registra isso."
      + (parciais.length
          ? " Em tom neutro, " + parciais[0].v + " em diante: a maior parte "
            + "desses anos vem de depósitos recentes, muitos ainda em exame, "
            + "e o número vai crescer."
          : "")
      + " Onde o exame demora mais, como no INPI, a queda começa anos "
      + "antes disso: é fila de exame, não menos patentes."
    : "Nenhuma patente concedida com prazo correndo neste recorte.";

  const somaSub = subs.reduce((s, r) => s + Number(r.n), 0);
  G.barras($("venc-subs"), subs.map((r) => {
    const t = titulo(r.sub);
    return {
      rotulo: r.sub + (t ? " · " + t : ""), titulo: r.sub + (t ? " — " + t : ""),
      n: Number(r.n), share: naJanela ? 100 * Number(r.n) / naJanela : 0,
    };
  }), { unidade: "patentes vencem", base: "das que vencem na janela" });
  $("sub-venc-subs").textContent = subs.length
    ? "As subclasses com mais patentes cujo prazo termina de " + ref
      + " a " + ate + ". Juntas, as " + subs.length + " somam "
      + pct(naJanela ? 100 * somaSub / naJanela : 0) + " dos vencimentos "
      + "da janela."
    : "";

  G.barras($("venc-paises"), terr.map((r) => {
    const nome = nomePais(r.id);
    return {
      rotulo: nome, titulo: nome + " (" + isoPais(r.id) + ")", id: r.id,
      n: Number(r.n), share: naJanela ? 100 * Number(r.n) / naJanela : 0,
    };
  }), { unidade: "patentes vencem", base: "das que vencem na janela",
        aoClicar: (d) => aoPais(d.id) });
  $("sub-venc-paises").textContent = (estado.lente === "of"
      ? "Por escritório: onde a patente vale. Uma patente só protege no "
        + "país que a concedeu — o que não foi pedido no Brasil já é livre "
        + "aqui, com ou sem vencimento."
      : "Por país do titular: de onde é quem detém as patentes que vencem.")
    + " Clique num território para filtrá-lo.";
}

/** Nota de metodologia da aba, montada do resumo do preparo. */
export function notaVencimento($) {
  const V = window.META.vencimento;
  if (!V) return;
  const mu = Object.entries(V.prazo_mu)
    .filter(([, a]) => a !== 10)
    .map(([p, a]) => p + " " + a + " anos").join(", ");
  $("nota-venc").innerHTML = `
    <h4>O que esta aba mede</h4>
    <p>A base não traz data de vencimento nem situação jurídica. Traz a data
    de depósito e a de concessão, e com elas se calcula o <strong>prazo
    máximo</strong> que a lei dá a cada patente. É um teto: muitas caducam
    antes, por falta de pagamento da anuidade, e algumas ganham
    prorrogação — o ajuste de prazo dos EUA, o certificado complementar de
    fármacos e agroquímicos na Europa. Nenhuma das duas coisas está na base.</p>
    <h4>Como se calcula</h4>
    <ul>
      <li><strong>Invenção:</strong> 20 anos do depósito, o mínimo do acordo
      TRIPS, adotado por todos os membros da OMC. Nos EUA, para depósitos
      anteriores a 08/06/1995, o maior entre 17 anos da concessão e 20 do
      depósito.</li>
      <li><strong>Modelo de utilidade:</strong> o prazo de cada país — ${esc(mu)};
      10 anos nos demais, que é o mais comum (China, Japão, Coreia,
      Alemanha).</li>
      <li><strong>Concedida:</strong> a publicação traz data de concessão
      ou, nos escritórios que não preenchem essa data, código de publicação
      de concessão (B ou C na invenção, Y no modelo de utilidade). Sem
      isso o Brasil não teria nenhuma: ${inteiro(V.pelo_codigo)} das
      ${inteiro(V.pedidos)} concessões entraram pelo código, inclusive as
      ${inteiro(V.brasil)} do Brasil.</li>
      <li><strong>Unidade:</strong> o pedido, contado uma vez. O pedido
      publicado e a concessão são publicações separadas, e a mesma patente
      contaria duas vezes.</li>
      <li><strong>Fora:</strong> as ${inteiro(V.validacoes_ep)} validações
      nacionais de patentes europeias, que já contam uma vez no escritório
      europeu; o desenho industrial; e ${inteiro(V.sem_deposito)}
      concessões sem data de depósito.</li>
    </ul>
    <h4>Limites</h4>
    <p>Divisionais e continuações herdam o prazo do pedido original, mas a
    base traz a data do próprio pedido: para elas, o prazo sai mais longo
    do que é. Os depósitos dos últimos anos ainda estão em exame e só
    entram quando concedidos, por isso o fim da série é parcial. O filtro
    de período e o de situação de concessão, da lateral, não valem aqui;
    país, lente, setor e classificação valem. Das
    ${inteiro(V.pedidos)} concessões, ${inteiro(V.no_prazo)} têm prazo
    terminando em ${V.ano_ref} ou depois.</p>`;
}
