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

Site estático. No Vercel, sem build: *Framework Preset* `Other`,
build command vazio, *Output Directory* a raiz. O `vercel.json` cuida
do redirecionamento da raiz para o painel.

Os arquivos de dados são grandes e versionados no Git como binários —
cada regeração de cubo grava uma cópia nova no histórico. Se o
repositório incomodar de tamanho, o caminho é tirar `painel/dados/` do
Git e servir os cubos de um armazenamento à parte.
