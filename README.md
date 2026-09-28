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

## O recorte de TIC

Um só, o do de-para de CNAE do Observatório: **91 subclasses da IPC**,
o núcleo. Elas vêm de varrer a IPC inteira perguntando o que as 33
atividades marcadas como TIC produzem — e não de filtrar a lista de TIC
da OMPI por divisão da CNAE, caminho que já começa perdendo
instrumento de medida, óptica, relógio, mídia e memória, que a divisão
26 fabrica. A aba **Metodologia** da página traz a regra inteira, e
`LEIA-ME.md` traz a construção.

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
