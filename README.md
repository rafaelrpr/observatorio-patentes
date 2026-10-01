# Observatório Mundial de Patentes

Painel do Observatório FIESC sobre **166.866.499 publicações de patentes**
do mundo inteiro, com o recorte de TIC do Observatório.

A página consulta os dados **dentro do navegador**: um DuckDB compilado
para WebAssembly lê cubos em Parquet servidos ao lado dela. Não há
servidor de aplicação, não há banco de dados remoto e nenhuma consulta
sai da máquina de quem abre — o que o visitante filtra, ordena ou
cruza é processado na aba dele.

## Como abrir

- **Publicado:** a raiz do site já redireciona para o painel.
- **Sem internet:** duplo clique em `ABRIR O OBSERVATORIO.bat`. Ele abre
  o navegador com a permissão de ler os arquivos da pasta, que o Chrome
  e o Edge negam a uma página aberta por duplo clique.

## O que tem dentro

```
painel/
  observatorio.html   a página
  app.js  src/        a aplicação
  motor/              DuckDB WebAssembly (34 MB)
  dados/              os cubos em Parquet (166 MB)
  metadados/          recortes, dicionário da IPC, notas de método
```

Os cubos pesados chegam **sob demanda**: a primeira tela usa só os
leves. O cubo por código IPC (95 MB) e o de depositantes (57 MB) são
baixados quando a pergunta exige, e não na abertura.

## Os recortes por setor

Os setores são os 39 da coluna **SC Competitiva** do de-para de CNAE do
Observatório, com o mesmo nome. Para cada um, as subclasses da IPC que
correspondem ao que as atividades dele fabricam, ou à técnica com que
trabalham — varrendo a IPC inteira a partir da CNAE, e não filtrando uma
lista pronta. O TIC é o mesmo de antes: **91 subclasses**, o núcleo. É
núcleo a subclasse em que mais da metade das publicações, medida por
grupo principal, pertence ao setor; o resto é fronteira e fica fora da
conta. Oito setores não têm núcleo e ficam fora do filtro. A aba
**Metodologia › Composição dos setores** mostra cada um, subclasse por
subclasse, e `LEIA-ME.md` traz a construção.

## Vencimento

A aba **Vencimento** mostra quando termina o **prazo máximo** de cada
patente concedida: 20 anos do depósito na invenção, o prazo do país no
modelo de utilidade (15 anos no Brasil, 10 na China). É o teto da lei,
não a situação jurídica, que a base não tem: muitas caducam antes, por
falta de anuidade. O cubo (`dados/vencimento.parquet`, 1,3 MB) conta
cada pedido uma vez.

## Publicação

Site estático, sem build. No Vercel: *Framework Preset* `Other`,
*Build Command* vazio, *Output Directory* vazio, *Root Directory* na
raiz do repositório.

O `vercel.json` faz a pasta `painel/` ser a raiz do site: `/` serve a
página e todo caminho não encontrado na raiz é procurado dentro de
`painel/`. Assim o endereço publicado é só o domínio, e nem o `.bat`
nem o espelhamento precisam mudar de lugar.

### Duas armadilhas, as duas já custaram um deploy

**Rewrite não é redirect.** A primeira versão mandava só o `/` para
`painel/observatorio.html`, por rewrite. Rewrite não muda o endereço
na barra: a página continuava em `/`, e cada caminho relativo dela —
`app.js`, `plotly.min.js`, `src/motor.js` — era procurado na raiz do
site, onde não existe. Seis 404 e a página parada na tela de erro. Daí
a segunda regra, que leva tudo para dentro de `painel/`.

**O `vercel.json` não aceita comentário.** O Vercel valida o arquivo
contra um esquema fechado e recusa propriedade que não conheça —
inclusive a chave `"//"` que se costuma usar para comentar JSON. Com
ela dentro, o deploy falha antes de começar, e o sintoma visto de fora
é simplesmente nada acontecer. Explicação vai em prosa, aqui; o
`vercel.json` fica só com o que o esquema prevê.

### Tamanho

Os arquivos de dados são grandes e versionados no Git como binários —
cada regeração de cubo grava uma cópia nova no histórico. O Vercel os
serve sem reclamar, e o `fato.parquet`, com 94,76 MiB, passa no limite
de 100 MiB por arquivo do GitHub — mas com pouca folga: quando o cubo
crescer, o push vai ser recusado. Nessa hora o caminho é tirar
`painel/dados/` do Git e servir os cubos de um armazenamento à parte.
