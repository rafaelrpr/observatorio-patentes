# Observatório Mundial de Patentes

Explorador interativo da base local do Google Patents: **166.866.499
publicações**, de 1817 a 2025, em 106 escritórios. Abre no navegador, sem
instalar nada, e consulta os dados na própria máquina.

Não é um painel de TIC. TIC é **um** dos recortes; o universo é toda a
base, e o usuário desce dela até um código IPC de um país num ano.

## Como abrir

Duplo clique em **`entrega/abrir.bat`**.

Não precisa de Python, nem de servidor, nem de internet.

### Por que um `.bat` e não só o `.html`

Aberta por `file://`, a página **não pode ler os arquivos vizinhos**: o
Chrome e o Edge bloqueiam `fetch` nesse protocolo. Foi medido: `fetch`
falha com `TypeError`, XHR falha com `onerror`, e só o worker via `blob`
funciona.

O `.bat` abre o navegador com `--allow-file-access-from-files`, que libera
exatamente essa leitura. Ele usa um **perfil separado**, criado na pasta
temporária, então não mexe em nada do navegador do dia a dia e não
interfere nas janelas já abertas. Abrir o `.html` direto mostra uma tela
explicando isso, em vez de uma página em branco.

**O perfil separado cobra um pedágio, e ele precisa ser desligado.** Com
um perfil novo o Edge abre primeiro a própria tela de boas-vindas.
Conferido pela lista de abas do protocolo de depuração: sem as opções
abrem **duas** abas, e a da frente é `edge://welcome-new-device` — o
painel fica atrás. Por isso o `.bat` passa `--no-first-run`,
`--no-default-browser-check`, `--disable-search-engine-choice-screen` e o
desligamento da experiência de primeira execução do Edge. Com elas, abre
**uma** aba, direto na página.

## Oito abas, não uma rolagem

A página era um empilhamento de sete painéis numa rolagem só. Agora cada
aba é uma tela: **Panorama** (cartões, mapa-múndi e a rosca das áreas),
**Territórios** (ranking e curva de concentração), **Tecnologia** (perfil
em cascata e a rosca de concessão), **Tempo** (série anual e média por
década), **Vencimento** (quando termina o prazo das patentes concedidas),
**Depositantes** (ranking e concentração), **Tabela** e **Metodologia**.

Isso não é só estética. **O Plotly mede zero em container escondido**,
então desenhar o que não está visível produz gráfico sem altura: só a aba
visível é desenhada, e a troca de aba repinta o que entrou. O ganho
medido é maior no painel de depositantes, que depende do cubo de 57 MB —
ele agora só é buscado quando alguém abre aquela aba.

Abrir direto numa aba: `observatorio.html#tecnologia`.

Nenhum painel tem subtítulo: o texto que muda com o recorte vive dentro
do izinho de informação, junto com a explicação fixa e o nome da fonte.
Era o que somava mais rolagem que gráfico.

## Como funciona

```
patentes_publications_202511.parquet   13,3 GB, 166,9 milhões de linhas
              |
              |  Python, uma vez (preparar/)
              v
        cubos agregados                 173 MB
              |
              |  DuckDB compilado para WebAssembly
              v
     consulta dentro do navegador       SQL sobre os cubos
```

A base original **nunca é escrita**. Tudo o que a página lê são arquivos
derivados, em `entrega/dados/`.

### Por que cubos, e não a base inteira

Mesmo com a permissão liberada, o `fetch` de `file://` **ignora o
cabeçalho `Range`**: todo parquet aberto por URL é baixado inteiro para a
memória. Os 13,3 GB não cabem. Os cubos cabem — e respondem às mesmas
perguntas, menos as que exigem o registro individual.

| cubo | grão | linhas | tamanho |
|---|---|---|---|
| `fato.parquet` | escritório × titular × ano × **código IPC** × concessão | 42.426.000 | 95 MB |
| `fato_sub.parquet` | o mesmo, parando na subclasse | 6.627.857 | 9 MB |
| `titulares.parquet` | depositante × escritório × subclasse × ano | 20.186.740 | 57 MB |
| `ipc_dic.parquet` | dicionário da IPC 2026.01 | 78.861 | 3 MB |

**Só os cubos leves entram na abertura** (cerca de 10 MB). Os dois
grandes chegam quando a pergunta exige: o de 95 MB ao descer para o
código IPC completo, o de 57 MB ao pintar os depositantes — este último
sem travar o resto da tela, preenchendo o painel sozinho quando fica
pronto. Medido: **primeira tela em 3,0 s, tudo pronto em 4,2 s**. Sem
essa separação eram 24 s.

## O espelho no Desktop

O entregável de verdade é a pasta `Observatorio_Patentes` no Desktop, e
ela não era atualizada por nada: ficou três dias numa versão antiga
enquanto o repositório andava, e correções entregues aqui nunca
chegavam lá. Agora o `04_montar.py` espelha no fim — só o que mudou, e
só se a pasta já existir. Ele também avisa quando sobra no espelho
arquivo que não existe mais na entrega.

## Reconstruir

```
python ObservatorioPatentes/gerar_dicionario_completo.py   # PDFs -> dicionário
python ObservatorioPatentes/preparar/01_cubos.py           # ~2 min
python ObservatorioPatentes/preparar/03_titulares.py       # ~3 min
python ObservatorioPatentes/preparar/05_vencimento.py      # ~15 min; antes do 02
python ObservatorioPatentes/preparar/02_metadados.py       # use --reler
python ObservatorioPatentes/preparar/04_montar.py          # monta entrega/
python ObservatorioPatentes/preparar/provar.py             # abre e confere
python ObservatorioPatentes/preparar/provar_setores.py     # setores, idioma, balão
python ObservatorioPatentes/gerar_composicao_pdf.py        # um PDF por setor
```

`02_metadados.py` guarda o diagnóstico da base em cache, porque varrer os
13,3 GB leva minutos; `--reler` refaz.

## Os setores não foram inventados

Cada recorte vem de um dicionário, e a página nomeia a fonte de cada um:

- **A classificação** — as seções A a H, lidas dos PDFs oficiais da OMPI
  (`documentos/wipo classificacoes/a.pdf` … `h.pdf`). O parser é o mesmo
  que já gerava o dicionário de TIC; aqui roda sobre as oito seções e
  produz **132 classes, 655 subclasses e 78.861 códigos**, sem duplicatas.
  As seções ficam só no filtro de Classificação: até 01/10/2026 elas
  também eram opções do seletor de setor ("Áreas da IPC"), o que repetia
  o filtro de baixo, e saíram a pedido do usuário.
- **Os setores da SC Competitiva** — os 39 da coluna `SC Competitiva` do
  de-para de CNAE do Observatório, **com o mesmo nome** (o TIC se chamava
  "TIC · pela CNAE do Observatório"; desde 01/10/2026 é só "TIC").
  - **TIC** continua sendo as **91 subclasses** do núcleo, de
    `tic_por_cnae.py`. Havia três recortes de TIC — *escopo OMPI*,
    *escopo depurado* e este — e os dois primeiros saíram em 18/09/2026.
    A planilha `entregas/Dicionario_IPC_ate_subclasse.xlsx` traz as três
    colunas lado a lado.
  - **Os outros 38** moram em `setores_por_cnae.py`, uma linha por
    subclasse, com família, aderência e motivo. A pergunta é a mesma do
    TIC e na mesma direção: dadas as atividades da CNAE marcadas com o nome
    do setor, que subclasses de **toda** a IPC correspondem ao que elas
    fabricam — ou à técnica com que trabalham, nos setores primários e de
    serviço (a A01B é agricultura; a G08G, transporte). Não entra a
    tecnologia de uso geral que o setor só compra.
- **As famílias** saíram do seletor de setor. As onze de TIC já enchiam a
  lista; com 31 setores ela ficaria gigante. Agora cada setor que se
  divide oferece as suas num **segundo seletor**, que só aparece quando o
  setor tem famílias. Nos setores novos as famílias seguem os grupos de
  CNAE do de-para (10.1 carnes, 10.5 laticínios…); onde a IPC não separa
  dois grupos, eles viram uma família só.

**Núcleo ou fronteira se decide por número, não por título.** O cubo
guarda o código IPC completo, então dá para medir, dentro de cada
subclasse, quanto do volume cai em cada grupo principal. É núcleo a
subclasse em que **mais da metade** das publicações pertence ao setor;
abaixo disso ela é fronteira, fica registrada e fora da conta. Medido:
a A01K é 60% pecuária e 40% aquicultura e pesca — núcleo da
Agropecuária, fronteira da Pesca; a A61F é 75% prótese e 25% fralda —
núcleo da Indústria Diversa, fronteira do Papel e Celulose.

**Sobreposição é permitida, por decisão do usuário.** A A01D (colheita) é
técnica da Agropecuária e produto das Máquinas (28.3); a G01N é TIC e
Serviços Profissionais (71.2). Os setores **não somam** o total da base.
Juntos, alcançam **89,2%** das publicações com subclasse válida; o que
fica fora é de fato transversal — embalagem (B65D), separação (B01D),
biotecnologia (C12N, C12Q), revestimento (C23C).

**Oito setores não têm núcleo** e ficam fora do seletor — um filtro que
devolve zero não é escolha: Comércio por Atacado, Alojamento e
Alimentação, Serviços Imobiliários, Serviços Domésticos, Serviços
Diversos, Organismos Internacionais (serviços sem técnica patenteável
própria), e **Pesca e Aquicultura** e **Produção Florestal**, que a IPC
dissolve dentro da A01K e da A01G. Separar essas duas exigiria recorte
por grupo principal, que o cubo leve não tem. Os oito aparecem na
composição, com o motivo.

**A composição de cada setor está na página e em PDF.** Na aba
Metodologia, a primeira abinha, *Composição dos setores*, mostra um setor
por vez: as atividades da CNAE, o núcleo por família com o motivo de cada
subclasse e, recolhida, a fronteira. (A antiga abinha *Recorte
selecionado* saiu a pedido do usuário: repetia a lista de códigos que a
composição já mostra melhor.) Os PDFs — só o núcleo, TIC incluído — saem
de `gerar_composicao_pdf.py` para `documentos/Composição dos setores de
patentes/Composição <Setor>.pdf`, lendo o mesmo `meta.js` que a página
publica. Cuidado com o homônimo: o `Composição TIC.pdf` solto em
`documentos/` é o estudo da CNI/SENAI de 2010 sobre a indústria de TIC,
não o nosso, e o script se recusa a escrever por cima de PDF que não
tenha saído dele.

## A página abre em português

Classes e subclasses têm título em português (`traducao_ipc.py`, na
terminologia da CIP do INPI quando ela existe); o botão **PT | EN**, no
cabeçalho, mostra o inglês oficial da OMPI, e o navegador lembra a
escolha. A tradução para na subclasse: os 78 mil códigos completos ficam
no inglês oficial, e a tabela avisa.

**Dez subclasses chegavam com o título quebrado** do parser dos PDFs — a
B22F aparecia como `1/10) [2022.01] 8/00`, a G01S como `5/00)`. O título
oficial vai em `traducao_ipc.QUEBRADOS`, e o `02_metadados.py` se recusa
a rodar se surgir outro título com cara de código.

**As extintas em uso entraram no seletor.** H01L, F24J e C12S não estão
na IPC 2026.01 mas rotulam publicações — a H01L, 3,58 milhões. Antes não
havia como escolhê-las na cascata; agora aparecem marcadas como
extintas.

## O balão do izinho cabe na tela

Ele era um `<span>` absoluto dentro do próprio izinho e saía cortado: a
barra lateral tem rolagem própria, e todo filho que passa da borda dela
é recortado — o balão de 320 px não cabia nos 276 px da coluna. Agora há
um balão só (`src/bolha.js`), fixo na janela e fora de qualquer caixa,
que copia o texto do izinho ao abrir e se posiciona dentro da tela. A
prova (`provar_setores.py`) passa o mouse em cinco izinhos e confere que
o balão inteiro cabe.

## A página não traz o caminho da máquina nem o nome do arquivo

Mostrava `C:\Users\<usuário>\Desktop\...\patentes_publications_202511
.parquet` — e o `meta.js` é servido publicamente pelo site. O caminho
saiu **do dado**, não só da tela (e do cache do diagnóstico). Depois saiu
também o nome do arquivo, que ainda aparecia no rodapé de todos os
izinhos, na metodologia geral, na linha do cabeçalho e no CSV: a fonte é
"Google Patents, via BigQuery", e é isso que a página diz. O teste lê o
`textContent` da página, não o `innerText`, porque o texto dos izinhos
fica escondido até o mouse passar — foi por ali que o nome escapou da
primeira vez. A seção da base diz até quando vão as publicações:
**23/10/2025**.

## Vencimento: prazo máximo, não situação jurídica

A base não tem data de vencimento nem situação legal. Tem a data de
depósito e a de concessão, e com elas `05_vencimento.py` calcula o
**prazo máximo** que a lei dá a cada patente concedida — o teto. Muitas
caducam antes, por falta de anuidade, e algumas ganham prorrogação (PTA
nos EUA, SPC na Europa); nada disso está na base, e a aba diz isso junto
de cada número.

- **Invenção:** 20 anos do depósito (TRIPS). EUA com depósito antes de
  08/06/1995: o maior entre 17 anos da concessão e 20 do depósito.
- **Modelo de utilidade:** prazo do país (`PRAZO_MU`: Brasil e México 15,
  França 6, o resto 10).
- **Concedida** é `grant_date` preenchida **ou** código de publicação de
  concessão (B/C; Y no modelo de utilidade). **O Brasil não preenche
  `grant_date` em nenhuma publicação** — sem o código, teria zero
  concessões. Suécia, Suíça, México, Noruega e Israel também não.
- **Um pedido, uma vez** — pedido publicado e concessão são publicações
  separadas. Validações nacionais de patente europeia (tipo T) ficam
  fora: já contam no EP.
- O cubo só guarda prazo terminando no ano corrente ou depois, com o ano
  de depósito ao lado: a coluna de vencimento cuja maior parte vem de
  depósito recente sai em tom neutro, porque muitos desses pedidos ainda
  estão em exame. "Recente" é diferente para cada tipo: cinco anos na
  invenção, que leva anos para ser concedida; dois no modelo de
  utilidade, que a China concede em meses.
- Período e situação de concessão da lateral não valem na aba; país,
  lente, setor e classificação valem.

## A limitação que governa todo o resto

A extração guardou **um único código IPC por publicação**, e ele **não é o
principal**. O campo `ipc_first` é verdadeiro em apenas **38,6%** das
linhas — se a extração tivesse guardado o primeiro, seria 100%.

Pior: a proporção **varia muito entre escritórios**, e o inverso dela
estima quantos códigos a publicação tinha:

| escritório | publicações | é o 1º código | códigos estimados |
|---|---:|---:|---:|
| China | 52.572.127 | 53,8% | 1,9 |
| Japão | 27.951.191 | 44,4% | 2,3 |
| Estados Unidos | 21.652.238 | 29,4% | 3,4 |
| Alemanha | 8.209.531 | 15,8% | 6,3 |
| Reino Unido | 3.996.680 | 6,7% | **14,8** |

Consequência: contar "patentes da seção G" conta *publicações cujo código
guardado caiu em G*, não *publicações classificadas em G* — e a
subcontagem é maior justamente onde se classifica com mais códigos. Isso
está em destaque na metodologia da página, não escondido no rodapé.

O lado bom: cada publicação cai em uma classificação só, então os
percentuais fecham em 100% e nada é contado duas vezes.

## Outras coisas que quebram e não são óbvias

**As duas lentes não somam.** Um pedido da Samsung depositado no Brasil é
brasileiro pelo escritório e coreano pelo titular. Somar contaria a mesma
publicação duas vezes, por isso a página obriga a escolher. A lente do
titular cobre 62,7 milhões de publicações; as outras 104,2 milhões não
declaram o país do titular.

**A H01L saiu da IPC e levava 3,58 milhões com ela.** A subclasse foi
retirada em 2023.01 e reorganizada na série H10, então o dicionário da
OMPI edição 2026.01 não a traz mais. Só que a base continua com
**3.579.928 publicações** rotuladas por ela — a segunda maior subclasse
do acervo de TIC. Montar os recortes de TIC a partir do dicionário
atual, sem reintroduzi-la, perdia esse volume **em silêncio**: o escopo
depurado media 27.409.888 no lugar de 30.989.816, 11,6% a menos, e nada
na tela avisava. Agora `EXTINTAS_TIC`, em `preparar/02_metadados.py`, a
devolve, e o script se recusa a rodar se um código dessa lista não
estiver em uso na base — para a lista não envelhecer sem ninguém
descobrir. Desde 18/09/2026 há uma segunda trava: o script também se
recusa a rodar se um código extinto em uso na base **não estiver dentro
do recorte** — era assim que o volume sumia antes.

**O recorte de TIC pela CNAE é uma regra, não uma lista — e a regra
vem do arquivo.** O setor *TIC · pela CNAE do Observatório* não é uma
lista de IPC digitada: é a concordância IPC–CNAE da Eurostat/EPO
cruzada com a coluna **`SC Competitiva`** do de-para de CNAE do
Observatório, onde o valor `TIC` marca 33 subclasses em três divisões —
**26** (indústria de equipamentos), **61** (telecomunicações) e **62**
(serviços de TI).

**E a regra é aplicada na direção certa.** Até 18/09/2026 este recorte
filtrava a lista de TIC da OMPI pela divisão da CNAE, e dava 53
subclasses. Começar pela lista da OMPI já perde tudo o que a OMPI não
chama de TIC — instrumento de medida, óptica, relógio, mídia virgem e
memória —, e a divisão 26 fabrica todas essas coisas. A pergunta certa
é a inversa: dadas as 33 atividades da CNAE, que subclasses de **toda a
IPC** correspondem ao que elas produzem. São **91** (o núcleo), em
`ObservatorioPatentes/tic_por_cnae.py`, e ficam de fora 15 de fronteira,
em que só parte do conteúdo pertence.

A primeira versão deste recorte fixava `"26"` no código e ficava com 52:
tirava a **G06Q**, que cai na CNAE 62. Eram **1.667.318 publicações**,
19,3% do acervo catarinense, jogadas fora por uma regra escrita à mão
que o próprio de-para contradizia — a divisão 62 está marcada como TIC
lá dentro. Agora a lista de divisões é lida de
`dados/cnae/tic_cnae.csv`, gerado por
`Observatorio TIC/gerar_escopo_cnae.py`: se a marcação mudar no de-para,
o recorte muda junto.

**Cuidado ao comparar com o Observatório Setorial de TIC.** Lá o recorte
econômico é **só a divisão 26**, por decisão própria e registrada. Os
dois não medem o mesmo setor, e a nota do recorte diz isso na tela.

**O mapa precisa da camada de quem não tem dado.** O choropleth só
desenha o polígono que recebe valor, então o território sem registro no
recorte desaparecia — sem cor e sem fronteira, como se não existisse. São
175 polígonos na malha contra 106 escritórios na base, ou seja a maior
parte do mapa. Agora há uma camada de fundo em tom de "sem dado", com
contorno e com dica própria dizendo que não há registro; o clique nela
não filtra, porque não há o que filtrar.

O contorno dessa camada usa a cor do **texto apagado**, não a da linha
de grade. Com a cor da grade (`--line`, `#223049`) contra o
preenchimento de sem-dado (`--sem-dado`, `#222C40`) a África virava uma
mancha só e a fronteira sumia de novo — que era exatamente a
reclamação.

**A base usa 1.102 subclasses, não 655.** O excedente são códigos
históricos, já retirados da IPC, que continuam rotulando publicações
antigas. `G06F17/30`, por exemplo, saiu em 2019 e ainda rotula 372.854
publicações. O dicionário cobre 93,6% das publicações; o resto aparece com
o código e a marca "fora da IPC 2026.01".

**289 publicações têm código que não começa por A–H.** São malformados.
Apareciam como barras "0", "N", "R" no gráfico de seções; agora ficam de
fora, e a linha abaixo do gráfico diz quantas são.

**A base de 13,3 GB não pode ser consultada pelo navegador.** Foi
tentado: o seletor de arquivo dá leitura preguiçosa de verdade
(`BROWSER_FILEREADER`, por pedaços, sem carregar tudo), o que em tese
permitiria a tabela de registros individuais. Medido: uma busca por
número de publicação passou de **dez minutos sem responder**. O caminho
foi abandonado e o código removido; a tabela da página trabalha sobre os
cubos e diz isso na primeira linha.

**Crescimento precisa de dois cuidados.** O cartão compara médias **por
ano**, não somas — comparar janelas de tamanhos diferentes inverte o
sinal. E descarta os dois últimos anos, incompletos pelo atraso de
publicação. Sem o teto de dez anos, o recorte padrão partiria 1817–2023
ao meio e anunciaria "+5.856%": verdadeiro e inútil.

**Ano não leva separador de milhar.** É identificador, não quantidade:
`1983`, nunca `1.983`. A tabela trata a coluna de ano como texto.

**O Plotly formata número na localidade inglesa.** `separatethousands`
escreve `4,000,000`. Em lugar nenhum se deixa o Plotly formatar: os ticks
saem de `marcas()` e todo texto de dica vai pronto por `customdata`,
formatado com `Intl.NumberFormat("pt-BR")`.

**O mapa precisa de escala logarítmica.** A China tem 52,6 milhões e o
Uruguai tem dezenas. Em escala linear o mapa inteiro fica de uma cor só.
Conferido por amostragem de pixel: a China mede exatamente `#6FF0FF`, o
extremo claro da rampa.

**O mapa ignora o filtro de país de propósito.** Ele *é* o seletor:
respeitando o próprio filtro, esvaziava a tela justo quando o usuário
acabava de escolher um país. Os demais filtros valem, e o selecionado
ganha contorno. A linha abaixo do mapa avisa quando isso está em jogo.

**Escritório regional não é país.** EP (8,9 milhões) e WO (6,0 milhões)
são o 4º e o 7º do ranking, e não têm polígono no mapa. Aparecem com nome
por extenso, para não serem lidos como países.

**Oito seções não podem virar oito cores.** Nenhuma paleta de 8 matizes
passa no teste de separação sob daltonismo em fundo escuro sem degenerar
em quatro azuis quase iguais — foi tentado. Por isso barra é de uma cor
só: o comprimento codifica a magnitude e o rótulo do eixo dá a
identidade. Cor categórica só entra na comparação entre países, limitada
a 5 séries, com paleta validada em todos os pares.

**A rosca só entra onde a soma fecha, e a cor dela não é identidade.** A
página tem dois gráficos de setores: as áreas da IPC e a situação de
concessão. Os dois são legítimos por um motivo verificável, não por
gosto — a extração guardou **um** código IPC por publicação, então cada
publicação cai numa fatia só e os percentuais fecham em 100%; e
`grant_date` está preenchida ou não está, sem terceiro caso. A cor das
fatias é a rampa sequencial na ordem do tamanho, pela mesma restrição de
daltonismo acima: a identidade vem do rótulo colado na fatia, e as
categorias menores entram num balde de resto em tom neutro. Onde a soma
**não** fecharia, o painel continua sendo barra.

**A rosca da classificação desce com o filtro.** Com a seção G
selecionada ela mostraria uma fatia só, e gráfico de uma fatia não diz
nada. Escolhida uma seção, ela passa a mostrar as classes dela; escolhida
uma classe, as subclasses. O título muda junto.

**Média por década precisa de divisão inteira de verdade.** No DuckDB a
barra é divisão real: `(a / 10) * 10` devolve `2018`, não `2010`, e o
gráfico de décadas saiu rotulado ano a ano na primeira versão. O resto do
módulo 10 — `a - (a % 10)` — não depende do tipo.

**O DuckDB-WASM não sobe com worker de módulo.** Sob `file://`, o worker
clássico via `blob` funciona e o de módulo falha. O pacote usado é o
`eh` (exception handling), com os módulos ES empacotados pelo jsDelivr e
salvos localmente em `motor/`.

## Limitações declaradas

- **A unidade é a publicação, não a invenção.** 166,9 milhões de
  publicações correspondem a 129,7 milhões de pedidos distintos. Uma
  invenção protegida em dez países conta dez vezes. Famílias **não** são
  reduzidas a uma observação, porque a base não traz o identificador de
  família.
- **Não há situação jurídica.** Só existe `grant_date` preenchida ou
  vazia. Nada de vencimento, vigência ou caducidade — a base não informa.
- **O ranking de depositantes cobre o topo, não a cauda.** São 12,5
  milhões de nomes distintos; o cubo guarda os 84.107 maiores (os 20.000
  maiores do mundo mais os 2.000 maiores de cada escritório, para não
  apagar o líder de um país pequeno) e cobre 51,6% das publicações com
  titular.
- **A harmonização de nomes é do Google**, não nossa. Subsidiárias
  nacionais podem aparecer separadas da matriz.
- **A tabela mostra agregados, não registros.** Cada linha é uma soma do
  cubo. Chegar à publicação individual exigiria consultar os 13,3 GB.
- **Os últimos anos estão incompletos**: o pedido leva cerca de 18 meses
  para ser publicado.

## Arquivos

| arquivo | o que é |
|---|---|
| `entrega/` | **a pasta que se entrega** — 203 MB, autocontida |
| `~/Desktop/Observatorio_Patentes/` | o espelho que o usuário abre; `04_montar.py` sincroniza sozinho |
| `entrega/abrir.bat` | abre o navegador com a permissão necessária |
| `entrega/painel/observatorio.html` | a página |
| `entrega/painel/app.js`, `entrega/painel/src/` | orquestração, filtros, gráficos, metodologia |
| `entrega/motor/` | DuckDB em WebAssembly |
| `entrega/dados/` | os cubos |
| `entrega/metadados/` | dicionário, setores, países, diagnóstico |
| `gerar_dicionario_completo.py` | PDFs da OMPI → `dicionarios/ipc_completo.xlsx` |
| `nomes_territorios.py` | nomes em português dos 274 códigos de território |
| `tic_por_cnae.py` | as 106 subclasses de TIC (91 núcleo), com motivo |
| `setores_por_cnae.py` | os outros 38 setores da SC Competitiva, subclasse por subclasse |
| `traducao_ipc.py` | títulos em português até a subclasse e os dez títulos corrigidos |
| `gerar_composicao_pdf.py` | um PDF de composição por setor, em `documentos/Composição dos setores de patentes/` |
| `preparar/05_vencimento.py` | o cubo de vencimento (1,3 MB) e o resumo dele |
| `preparar/` | os scripts de preparo e a prova |
| `provas/` | as telas capturadas pela prova |
