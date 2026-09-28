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

## Sete abas, não uma rolagem

A página era um empilhamento de sete painéis numa rolagem só. Agora cada
aba é uma tela: **Panorama** (cartões, mapa-múndi e a rosca das áreas),
**Territórios** (ranking e curva de concentração), **Tecnologia** (perfil
em cascata e a rosca de concessão), **Tempo** (série anual e média por
década), **Depositantes** (ranking e concentração), **Tabela** e
**Metodologia**.

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
python ObservatorioPatentes/preparar/02_metadados.py       # use --reler
python ObservatorioPatentes/preparar/04_montar.py          # monta entrega/
python ObservatorioPatentes/preparar/provar.py             # abre e confere
```

`02_metadados.py` guarda o diagnóstico da base em cache, porque varrer os
13,3 GB leva minutos; `--reler` refaz.

## Os setores não foram inventados

Cada recorte do filtro **Setor / área tecnológica** vem de um dicionário,
e a nota metodológica da página nomeia a fonte de cada um:

- **8 áreas da IPC** — as seções A a H, lidas dos PDFs oficiais da OMPI
  (`documentos/wipo classificacoes/a.pdf` … `h.pdf`). O parser é o mesmo
  que já gerava o dicionário de TIC; aqui roda sobre as oito seções e
  produz **132 classes, 655 subclasses e 78.861 códigos**, sem duplicatas.
- **TIC · pela CNAE do Observatório** — as **91 subclasses** do núcleo,
  derivadas da definição de TIC do de-para de CNAE. É o único recorte de
  TIC do seletor. Havia três — *escopo OMPI*, *escopo depurado* e este —
  e os dois primeiros saíram em 18/09/2026: três opções parecidas na
  mesma lista não dão escolha ao leitor, dão chance de errar. Quem
  quiser comparar tem a planilha `entregas/Dicionario_IPC_ate_subclasse
  .xlsx`, que traz as três colunas lado a lado.
- **11 famílias de produto** — agrupamento do Observatório, declarado
  como tal na nota, porque a IPC classifica a técnica e não o produto.
  Eram oito, desenhadas para 57 subclasses; as três novas — instrumentos
  e óptica, eletromédico, periféricos e armazenamento — cobrem o que
  entrou com o recorte de 91.

**Nenhum outro setor pode ser construído com honestidade a partir do que
existe hoje no projeto.** Os dicionários disponíveis cobrem a estrutura da
IPC e a composição de TIC — nada define, por exemplo, "biotecnologia" ou
"química fina". Para isso faltaria uma concordância publicada, como os 35
campos tecnológicos da OMPI. Enquanto ela não entrar no projeto, o filtro
não a oferece.

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
| `preparar/` | os scripts de preparo e a prova |
| `provas/` | as telas capturadas pela prova |
