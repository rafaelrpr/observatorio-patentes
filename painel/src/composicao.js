// Aba "Composicao dos setores", dentro da Metodologia.
//
// Uma lista de 39 setores com todas as subclasses de cada um, de uma vez,
// seria uma parede. Aqui se escolhe o setor numa fileira de botoes e so
// ele aparece: as atividades da CNAE que o definem, as subclasses de
// nucleo por familia, com o motivo de cada uma, e — recolhida — a
// fronteira, o que chegou perto e ficou de fora.
//
// Nenhum numero e digitado: o volume de cada subclasse vem do meta.js, que
// o preparo calculou sobre a base inteira.

import { inteiro, pct, esc } from "./formato.js";

/**
 * titulo(s)  -> titulo da subclasse no idioma escolhido
 * aoFiltrar(id) -> leva o setor para o filtro do painel
 */
export function montarComposicao($, META, { titulo, aoFiltrar }) {
  const setores = META.setores.filter((s) => s.sc);
  const porSub = new Map(META.subclasses.map((s) => [s.sub, s]));
  const nDe = (sub) => Number((porSub.get(sub) || {}).n || 0);
  const soma = (subs) => subs.reduce((a, x) => a + nDe(x), 0);
  let escolhido = setores[0].id;

  const vazios = setores.filter((s) => !s.subs.length);
  $("comp-intro").innerHTML = `
    <p>Cada setor da coluna <strong>SC Competitiva</strong> do de-para de
    CNAE do Observatório virou um recorte da IPC, com o mesmo nome. A
    pergunta é sempre a mesma, e na mesma direção: dadas as atividades da
    CNAE marcadas com o nome do setor, que subclasses de <em>toda</em> a
    IPC correspondem ao que elas fabricam — ou à técnica com que
    trabalham, nos setores primários e de serviço.</p>
    <p class="destaque">Entra como <strong>núcleo</strong> a subclasse em
    que mais da metade das publicações, medidas por grupo principal na
    própria base, pertence ao setor. As de <strong>fronteira</strong>
    ficam registradas e fora da conta. Uma subclasse pode ser núcleo de
    mais de um setor — a colheita é da Agropecuária e das Máquinas —,
    então os setores não somam o total da base. Juntos, eles alcançam
    ${pct(META.base.cobertura_setores)} das publicações com subclasse
    válida.</p>
    <p>${inteiro(vazios.length)} setores não têm núcleo: são serviços sem
    técnica patenteável própria, ou atividades que a IPC dissolve dentro
    de subclasses maiores. Eles aparecem aqui, com o motivo, e não aparecem
    no filtro — um filtro que devolve zero não é uma escolha.</p>`;

  function linha(sub, porque) {
    const s = porSub.get(sub);
    return "<tr><td class='cod'>" + esc(sub)
      + (s && s.x ? " <span class='marca'>extinta</span>" : "")
      + "</td><td class='larga'>" + esc(s ? titulo(s) : "—")
      + "</td><td class='num'>" + inteiro(nDe(sub))
      + "</td><td class='larga porque'>" + esc(porque || "") + "</td></tr>";
  }

  function tabela(subs, porque, rotulo) {
    return "<div class='rolagem' style='max-height:none'>"
      + "<table class='dados comp'><thead><tr><th>Subclasse</th>"
      + "<th>Título</th><th class='num'>Publicações</th><th>" + rotulo
      + "</th></tr></thead><tbody>"
      + subs.map((x) => linha(x, porque(x))).join("")
      + "</tbody></table></div>";
  }

  function botoes() {
    $("comp-setores").innerHTML = setores.map((s) =>
      "<button type='button' class='chip" + (s.subs.length ? "" : " vazio")
      + "' data-id='" + s.id + "' aria-pressed='" + (s.id === escolhido)
      + "'>" + esc(s.nome) + "<span>" + (s.subs.length || "—")
      + "</span></button>").join("");
    for (const b of $("comp-setores").querySelectorAll("button")) {
      b.addEventListener("click", () => { escolhido = b.dataset.id; pintar(); });
    }
  }

  function pintar() {
    botoes();
    const s = setores.find((x) => x.id === escolhido);
    const total = soma(s.subs);
    const porque = (x) => s.porque[x];
    let h = "<h4>" + esc(s.nome) + "</h4>";
    if (s.subs.length) {
      h += "<p class='resumo'><strong>" + inteiro(s.subs.length)
        + "</strong> subclasses de núcleo · <strong>" + inteiro(total)
        + "</strong> publicações na base inteira"
        + (s.familias.length ? " · " + s.familias.length + " famílias" : "")
        + "</p>";
    }
    h += "<p><strong>Atividades da CNAE</strong> que o de-para marca como "
      + "“" + esc(s.sc) + "” — " + esc(s.divisoes) + " da CNAE:</p>"
      + "<ul class='cnae'>" + s.cnae.map((g) =>
        "<li><code>" + g.g + "</code> " + esc(g.nome) + "</li>").join("")
      + "</ul>";
    if (!s.subs.length) {
      h += "<p class='destaque'>" + esc(s.sem_nucleo) + "</p>";
    } else if (s.familias.length) {
      for (const f of s.familias) {
        h += "<h5>" + esc(f.longo || f.nome) + "<span>CNAE "
          + f.cnae.map(esc).join(", ") + " · " + f.subs.length
          + (f.subs.length === 1 ? " subclasse" : " subclasses") + " · "
          + inteiro(soma(f.subs)) + " publicações</span></h5>"
          + tabela(f.subs, porque, "Por que entra");
      }
    } else {
      h += tabela(s.subs, porque, "Por que entra");
    }
    if (s.fronteira.length) {
      const pf = new Map(s.fronteira.map((f) => [f.sub, f.porque]));
      h += "<details class='fronteira'><summary>Fronteira — "
        + s.fronteira.length + (s.fronteira.length === 1
          ? " subclasse que chegou perto e ficou de fora"
          : " subclasses que chegaram perto e ficaram de fora")
        + "</summary><p>Parte do conteúdo pertence ao setor, mas não a "
        + "maior parte. Não entram em nenhuma conta do painel.</p>"
        + tabela([...pf.keys()], (x) => pf.get(x), "Por que fica de fora")
        + "</details>";
    }
    if (s.subs.length) {
      h += "<p style='margin-top:12px'><button type='button' class='botao' "
        + "id='comp-filtrar'>Ver este setor no painel</button></p>";
    }
    h += "<p class='fonte-comp'>Tabela: <code>" + esc(s.fonte_tabela)
      + "</code> · títulos da IPC 2026.01 (OMPI) · volume: base inteira, "
      + "um código IPC por publicação</p>";
    $("comp-detalhe").innerHTML = h;
    const bt = $("comp-filtrar");
    if (bt) bt.addEventListener("click", () => aoFiltrar(s.id));
  }

  pintar();
  return {
    /** Abre a composicao no setor escolhido no filtro, se for um setor. */
    selecionar(id) {
      if (setores.some((s) => s.id === id)) { escolhido = id; pintar(); }
    },
    repintar: pintar,
  };
}
