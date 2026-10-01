// Notas metodologicas e as dicas dos izinhos de informacao.
//
// Regra que vale para as duas coisas: nenhum numero aqui e digitado. Tudo
// vem de META, que o preparo escreveu a partir do proprio arquivo.

import { inteiro, pct, um, curto, esc } from "./formato.js";

// sem nome de arquivo: a origem e o Google Patents, e e isso que o leitor
// precisa saber (pedido do usuario)
const FONTE = "Base: Google Patents, via BigQuery, lida no navegador.";

/** Preenche os <span> das dicas. O ultimo paragrafo nomeia a base. */
export function dicas($) {
  const b = window.META.base;
  const t = window.TITULARES || {};
  const vigentes = window.META.subclasses.filter((s) => !s.x).length;
  const pares = {
    "dica-pais":
      "Dois campos diferentes da base respondem a pergunta \"de que país é "
      + "esta patente\", e eles não querem dizer a mesma coisa. "
      + "<b>Escritório</b> usa <code>country_code</code>: onde o pedido foi "
      + "depositado, ou seja, que mercado se quis proteger. <b>Titular</b> "
      + "usa <code>assignee_country_code</code>: de onde é quem detém a "
      + "patente, ou seja, quem produziu a tecnologia. Somar as duas "
      + "contaria a mesma publicação duas vezes, por isso escolhe-se uma.",
    "dica-periodo":
      "Ano de <code>publication_date</code>. Deixando os dois campos em "
      + "branco, entram também as " + inteiro(b.sem_publicacao)
      + " publicações sem data válida; ao escolher qualquer limite, elas "
      + "saem. Os últimos anos da série estão incompletos: o pedido leva "
      + "cerca de 18 meses para ser publicado.",
    "dica-setor":
      "Os setores da coluna SC Competitiva do de-para de CNAE do "
      + "Observatório, com o mesmo nome e em ordem alfabética: para cada um, as "
      + "subclasses da IPC que correspondem ao que as atividades dele "
      + "fabricam, ou à técnica com que trabalham. Ficam de fora do seletor "
      + "os setores sem nenhuma subclasse própria. Quais subclasses estão "
      + "em cada setor, e por quê, está na aba Metodologia, em Composição "
      + "dos setores. As oito seções da IPC ficam no filtro de "
      + "Classificação, logo abaixo.",
    "dica-familia":
      "Aparece quando o setor escolhido se divide. As famílias seguem os "
      + "grupos da CNAE do próprio setor no de-para — carnes, laticínios, "
      + "bebidas —, e onde a IPC não separa dois grupos eles viram uma "
      + "família só. No TIC são as onze famílias de produto do estudo. Cada "
      + "subclasse cai numa família só.",
    "dica-ipc":
      "Classificação Internacional de Patentes, edição 2026.01: "
      + inteiro(window.META.secoes.length) + " seções, "
      + inteiro(window.META.classes.length) + " classes, "
      + inteiro(vigentes) + " subclasses e "
      + inteiro(b.codigos_dic) + " códigos. Os três campos encaixam em "
      + "cascata. Os títulos aparecem em português; o botão PT | EN, no "
      + "alto da página, mostra o inglês oficial da OMPI. A tradução vai "
      + "até a subclasse — os códigos completos ficam no inglês oficial. "
      + "Atenção: a base usa " + inteiro(b.subclasses_base)
      + " subclasses, mais que as " + inteiro(vigentes)
      + " vigentes — o excedente são códigos históricos, já retirados da "
      + "classificação, que continuam rotulando publicações antigas. As "
      + "que ainda pesam, como a H01L, estão na lista marcadas como "
      + "extintas.",
    "dica-situacao":
      "Só existe o que a base traz: <code>grant_date</code> preenchida ou "
      + "não. Isso <b>não</b> é situação jurídica. Uma patente pode ter "
      + "sido concedida e depois caducado por falta de anuidade, e a base "
      + "não registra isso. O prazo máximo de cada patente concedida está "
      + "na aba Vencimento.",
    "dica-venc-ano":
      "Ano em que termina o prazo máximo da lei: 20 anos do depósito na "
      + "invenção; no modelo de utilidade, o prazo de cada país (15 anos no "
      + "Brasil, 10 na China). É o teto, não o vencimento real — a base não "
      + "sabe quem deixou de pagar a anuidade. Cada patente conta uma vez, "
      + "pelo pedido.",
    "dica-venc-subs":
      "As subclasses da IPC com mais patentes cujo prazo termina na janela "
      + "escolhida: as tecnologias que mais vão entrar em domínio público. "
      + "Respeita o setor e a classificação escolhidos na lateral.",
    "dica-venc-paises":
      "Onde vencem, pela lente da lateral: escritório (onde a patente vale) "
      + "ou país do titular (de quem ela é). A proteção é territorial: o "
      + "que não foi pedido num país já é livre nele, com ou sem "
      + "vencimento.",
    "dica-mapa":
      "Cor em escala logarítmica, porque o maior escritório tem milhões de "
      + "publicações e o menor tem dezenas — em escala linear o mapa "
      + "inteiro ficaria de uma cor só. Territórios pequenos demais para a "
      + "malha 1:110 milhões, e os escritórios regionais como o Europeu e o "
      + "PCT, não têm polígono: aparecem no ranking, não no mapa.",
    "dica-serie":
      "Contagem por ano de publicação. Selecionando de 2 a 5 países, o "
      + "gráfico passa a comparar um contra o outro. Acima de 5 séries "
      + "não há paleta que se distinga com segurança, então a comparação "
      + "volta ao agregado.",
    "dica-perfil":
      "Detalhamento em cascata: clique numa barra para descer de seção para "
      + "classe, de classe para subclasse e de subclasse para o código "
      + "completo. O rótulo traz o código e a explicação curta em "
      + "português quando existe; o título oficial da OMPI aparece ao "
      + "passar o mouse.",
    "dica-titulares":
      "Campo <code>assignee_name</code>, já harmonizado pelo Google — ele "
      + "reúne as variações de grafia, mas subsidiárias nacionais podem "
      + "aparecer separadas da matriz. São "
      + inteiro(b.linhas - b.sem_titular) + " publicações com titular "
      + "declarado, de " + inteiro(b.nomes_titulares) + " nomes distintos. Levar "
      + "todos ao navegador custaria centenas de megabytes, então o cubo "
      + "guarda os " + inteiro(t.titulares) + " maiores — os "
      + inteiro(t.topo_mundo) + " maiores do mundo mais os "
      + inteiro(t.topo_pais) + " maiores de cada escritório, para "
      + "não apagar o líder de um país pequeno. Cobrem "
      + pct(100 * t.cobertas / t.com_titular)
      + " das publicações com titular.",
    "dica-ranking":
      "Os 15 maiores territórios do recorte, respeitando todos os filtros "
      + "— inclusive o de país, ao contrário do mapa. Barra de uma cor só "
      + "de propósito: o comprimento já codifica a magnitude e o rótulo do "
      + "eixo dá a identidade. Clique numa barra para filtrar por ela. "
      + "Escritórios regionais, como o Europeu e o PCT, aparecem aqui com "
      + "o nome por extenso, porque não são países.",
    "dica-conc":
      "Quanto do recorte está nas mãos dos maiores territórios. A curva "
      + "acumula do maior para o menor: onde ela cruza os 50%, esse é o "
      + "número de territórios que responde por metade de tudo. A curva "
      + "cobre no máximo os 40 maiores.",
    "dica-conc-tit":
      "A mesma leitura da curva de territórios, aplicada a quem detém as "
      + "patentes. Ela roda sobre o cubo de depositantes, que cobre os "
      + "maiores nomes e não a cauda inteira — por isso os percentuais são "
      + "sobre o que o cubo cobre, e a linha abaixo diz quanto é.",
    "dica-rosca":
      "As oito seções da IPC, de A a H. A rosca é legítima aqui por um "
      + "motivo verificável: a extração guardou <b>um</b> código IPC por "
      + "publicação, então cada publicação cai numa seção só e as fatias "
      + "fecham em 100%. A cor é a rampa sequencial na ordem do tamanho, "
      + "não identidade — oito matizes categóricos não se separariam com "
      + "segurança sob daltonismo, e isso já foi medido neste projeto. A "
      + "identidade vem do rótulo colado na fatia. As seções menores "
      + "entram num balde de resto, em tom neutro.",
    "dica-concessao":
      "Duas fatias, e a soma fecha em 100% por definição: a base tem "
      + "<code>grant_date</code> preenchida ou vazia, e não existe terceiro "
      + "caso. Isso <b>não</b> é situação jurídica — uma patente pode ter "
      + "sido concedida e depois caducado por falta de anuidade, e a base "
      + "não registra isso.",
    "dica-decadas":
      "Média por ano de cada década, nunca a soma. Comparar janelas com "
      + "número diferente de anos inverte o sinal: pelo total, a década de "
      + "2020 aparece abaixo da anterior só porque tem menos anos "
      + "corridos. A coluna em tom neutro é a década que não tem os dez "
      + "anos dentro do recorte.",
    "dica-tabela":
      "Cada linha é um <b>agregado</b>, não uma publicação. A unidade de "
      + "análise continua sendo a publicação, identificada por "
      + "<code>publication_number</code> — conferido: "
      + inteiro(b.linhas) + " linhas para " + inteiro(b.pubs)
      + " publicações distintas, " + inteiro(b.duplicadas) + " duplicadas "
      + "— mas trazer " + curto(b.linhas) + " de registros para a interface "
      + "derrubaria o navegador. O CSV baixa o que está na tabela.",
  };
  for (const id in pares) {
    const el = $(id);
    if (el) el.innerHTML = pares[id] + "<em>" + FONTE + "</em>";
  }
}

/** Metodologia geral e informacoes da base. */
export function montarNotas($, META) {
  const b = META.base;
  const t = window.TITULARES || {};
  const gb = (b.bytes / 1024 / 1024 / 1024).toFixed(2).replace(".", ",");

  // densidade de classificacao: 1/p_first estima quantos codigos a
  // publicacao tinha antes de a extracao guardar um so
  const dens = (b.densidade || []).slice(0, 10).map((d) =>
    "<tr><td>" + esc(d.nome || d.iso) + "</td><td class='num'>"
    + inteiro(d.n) + "</td><td class='num'>" + um(100 * d.pf)
    + "%</td><td class='num'>" + um(1 / d.pf) + "</td></tr>").join("");

  $("corpo-nota-geral").innerHTML = `
    <h4>De onde vêm os números</h4>
    <p>Uma fonte só: uma extração de ${gb} GB da base pública do Google
    Patents no BigQuery. Nenhuma consulta
    é feita à internet, nenhuma outra base de patentes é usada e nada
    completa ou corrige o que está no arquivo. Os dicionários da OMPI
    entram apenas como <strong>metadados</strong>: dão nome aos códigos e
    definem os setores, nunca fornecem contagens.</p>
    <p>O arquivo original nunca é escrito. O que esta página lê são cubos
    derivados — somas por país, ano, código e concessão — gerados uma vez
    por scripts em Python e gravados separadamente.</p>

    <h4>Unidade de análise</h4>
    <p>A <strong>publicação de patente</strong>, identificada por
    <code>publication_number</code>. Conferido no arquivo:
    ${inteiro(b.linhas)} linhas para ${inteiro(b.pubs)} publicações
    distintas — <strong>nenhuma duplicada</strong>. As mesmas publicações
    correspondem a ${inteiro(b.pedidos)} pedidos distintos
    (<code>application_number</code>): uma invenção protegida em dez países
    aparece dez vezes. Famílias de patentes <strong>não</strong> são
    reduzidas a uma observação, porque a base não traz o identificador de
    família.</p>

    <h4 style="color:var(--neg)">A limitação que governa todo o resto</h4>
    <p class="destaque">A extração guardou <strong>um único código IPC por
    publicação</strong>, e esse código <strong>não é necessariamente o
    principal</strong>. O campo <code>ipc_first</code>, que marca a primeira
    classificação da publicação, é verdadeiro em apenas
    ${pct(100 * b.com_first / b.linhas)} das linhas — se a extração tivesse
    guardado a primeira, seria 100%.</p>
    <p>Isso tem duas consequências. A boa: cada publicação cai em uma
    classificação só, então os percentuais fecham exatamente em 100% e nada
    é contado duas vezes. A ruim: contar "patentes da seção G" aqui conta
    <em>publicações cujo código guardado caiu em G</em>, e não
    <em>publicações classificadas em G</em>. Quem tinha um código de G e
    outro de H pode ter ficado só em H.</p>
    <p>E o efeito <strong>não é uniforme entre países</strong>, o que
    importa para comparações. O inverso da coluna abaixo estima quantos
    códigos a publicação tinha: onde o escritório classifica com mais
    códigos, mais se perde.</p>
    <div class="rolagem" style="max-height:none;margin-bottom:10px">
    <table class="dados"><thead><tr><th>Escritório</th>
    <th class="num">Publicações</th><th class="num">É o 1º código</th>
    <th class="num">Códigos estimados</th></tr></thead>
    <tbody>${dens}</tbody></table></div>

    <h4>As duas lentes de país</h4>
    <p>Cada publicação tem dois territórios e eles respondem a perguntas
    diferentes. <strong>Escritório</strong> (<code>country_code</code>) é
    onde o pedido foi depositado: mede onde se quer proteger mercado.
    <strong>Titular</strong> (<code>assignee_country_code</code>) é de onde
    é o detentor: mede quem produz tecnologia. Um pedido da Samsung
    depositado no Brasil é brasileiro pela primeira lente e coreano pela
    segunda. <strong>Somar as duas contaria a mesma publicação duas
    vezes</strong>, e por isso a página obriga a escolher. A lente do
    titular cobre ${inteiro(b.linhas - b.sem_pais_titular)} publicações —
    as que declaram o país; as outras ${inteiro(b.sem_pais_titular)} não
    entram nela.</p>

    <h4>Como as classificações são tratadas</h4>
    <p>O código vem no formato <code>G06F16/00</code> e a hierarquia é lida
    dele: primeiro caractere é a seção, os três primeiros a classe, os
    quatro primeiros a subclasse. O dicionário da IPC 2026.01, construído a
    partir dos PDFs oficiais da OMPI, traz ${inteiro(b.codigos_dic)} códigos e dá
    nome a ${pct(b.cobertura_dic, 2)} das publicações. O restante usa códigos
    <strong>históricos</strong>, já retirados da classificação: continuam
    rotulando publicações antigas e aparecem nos gráficos com o código, sem
    verbete.</p>

    <h4>Depositantes</h4>
    <p>Campo <code>assignee_name</code>, com a harmonização do Google — que
    é dele, não nossa. ${inteiro(b.sem_titular)} publicações não declaram
    titular. Entre as que declaram há ${inteiro(b.nomes_titulares)} nomes distintos,
    quase todos pessoas físicas com uma publicação. O cubo de depositantes
    guarda os ${inteiro(t.titulares)} maiores e cobre
    ${pct(100 * t.cobertas / t.com_titular)}
    das publicações com titular: os rankings são confiáveis no topo e
    silenciam sobre a cauda.</p>

    <h4>O que esta página não faz</h4>
    <ul>
      <li>Não estima situação jurídica, validade nem vencimento. Só existe
      <code>grant_date</code> preenchida ou vazia.</li>
      <li>Não deduplica famílias de patentes, porque a base não traz o
      identificador de família.</li>
      <li>Não completa nenhum campo ausente com outra fonte.</li>
      <li>Não mostra o registro individual: os cubos são agregados. Para
      chegar à publicação seria preciso consultar o arquivo de 13,3 GB.</li>
    </ul>`;

  const cols = (b.colunas || []).map((c) =>
    "<tr><td class='cod'>" + esc(c.n) + "</td><td class='cod'>"
    + esc(c.t) + "</td></tr>").join("");
  const falta = (rot, n) =>
    "<tr><td>" + rot + "</td><td class='num'>" + inteiro(n)
    + "</td><td class='num'>" + pct(100 * n / b.linhas, 2) + "</td></tr>";

  // Sem caminho e sem nome de arquivo: a fonte ja esta na metodologia
  // geral, e o caminho era o da maquina de quem preparou — que o site
  // publicava para qualquer um.
  const dm = String(b.data_max || "");
  const ate = dm.length === 8
    ? dm.slice(6, 8) + "/" + dm.slice(4, 6) + "/" + dm.slice(0, 4) : "";
  $("corpo-nota-base").innerHTML = `
    <h4>Base</h4>
    <p>Google Patents, tabela pública de publicações no BigQuery.<br>
    ${gb} GB · ${inteiro(b.linhas)} registros ·
    ${(b.colunas || []).length} colunas${ate
      ? ` · publicações até <strong>${ate}</strong>` : ""}</p>

    <h4>Contagens</h4>
    <ul>
      <li>Registros: <strong>${inteiro(b.linhas)}</strong></li>
      <li>Publicações únicas: <strong>${inteiro(b.pubs)}</strong>
      (duplicadas: ${inteiro(b.duplicadas)})</li>
      <li>Pedidos únicos: <strong>${inteiro(b.pedidos)}</strong></li>
      <li>Escritórios em <code>country_code</code>:
      <strong>${inteiro(b.paises)}</strong></li>
      <li>Período de <code>publication_date</code>:
      <strong>${b.ano_min}–${b.ano_max}</strong></li>
    </ul>

    <h4>Campos ausentes</h4>
    <div class="rolagem" style="max-height:none;margin-bottom:10px">
    <table class="dados"><thead><tr><th>Campo vazio</th>
    <th class="num">Registros</th><th class="num">Do total</th></tr></thead>
    <tbody>
      ${falta("Sem código IPC", b.sem_ipc)}
      ${falta("Sem nome de titular", b.sem_titular)}
      ${falta("Sem país do titular", b.sem_pais_titular)}
      ${falta("Sem data de concessão", b.sem_concessao)}
      ${falta("Sem data de depósito", b.sem_deposito)}
      ${falta("Sem data de publicação", b.sem_publicacao)}
    </tbody></table></div>

    <h4>Esquema do arquivo</h4>
    <div class="rolagem" style="max-height:none">
    <table class="dados"><thead><tr><th>Coluna</th><th>Tipo</th></tr></thead>
    <tbody>${cols}</tbody></table></div>`;
}
