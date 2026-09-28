// Motor de consulta: DuckDB compilado para WebAssembly, rodando dentro do
// navegador. Nenhum dado sai da maquina e nenhum servidor e consultado.
//
// A pagina abre por file://, e ai o navegador impoe duas coisas:
//
//   1. fetch e XHR sao bloqueados, a menos que o navegador tenha sido
//      aberto com --allow-file-access-from-files. E o que o abrir.bat faz.
//      Sem a flag nada carrega, e o aviso na tela explica isso.
//   2. mesmo com a flag, o fetch de file:// IGNORA o cabecalho Range. Cada
//      parquet aberto por URL e lido inteiro para a memoria. Por isso os
//      cubos sao pequenos e a base de 13,3 GB nao e aberta assim: para ela
//      existe o seletor de arquivo, que da leitura preguicosa de verdade.

const RAIZ = new URL(".", import.meta.url);      // .../web/src/
const BASE = new URL("..", RAIZ);                // .../web/

let db = null;
let con = null;

/** Sobe o motor. `aviso(texto, fracao)` alimenta a tela de abertura. */
export async function iniciar(aviso) {
  aviso("carregando o motor de consulta...", 0.05);
  const duckdb = await import("../motor/duckdb.js");

  aviso("iniciando o processador...", 0.15);
  const worker = new Worker(new URL("../motor/worker.js", RAIZ));
  db = new duckdb.AsyncDuckDB(new duckdb.VoidLogger(), worker);
  await db.instantiate(new URL("../motor/duckdb.wasm", RAIZ).href);
  con = await db.connect();
  return { duckdb };
}

/**
 * Registra um parquet vizinho e lhe da um nome de tabela.
 * O arquivo e lido inteiro — ver a observacao sobre Range no topo.
 */
export async function anexar(nome, arquivo, duckdb) {
  const url = new URL("dados/" + arquivo, BASE).href;
  await db.registerFileURL(nome + ".parquet", url,
                           duckdb.DuckDBDataProtocol.HTTP, false);
  await con.query(
    `CREATE OR REPLACE VIEW ${nome} AS ` +
    `SELECT * FROM read_parquet('${nome}.parquet')`);
}

// Houve uma tentativa de deixar o usuario apontar a base de 13,3 GB num
// seletor de arquivo: por ali o DuckDB le por pedacos (FileReader) em vez
// de carregar tudo, o que daria a tabela de registros individuais. Foi
// medido e nao serve: uma busca por numero de publicacao passou de DEZ
// MINUTOS sem responder. A tabela da pagina trabalha sobre os cubos, e
// diz isso.

/** Executa SQL e devolve array de objetos comuns. */
export async function sql(texto) {
  const r = await con.query(texto);
  return r.toArray().map((linha) => {
    const o = linha.toJSON ? linha.toJSON() : linha;
    const saida = {};
    for (const k in o) {
      const v = o[k];
      saida[k] = typeof v === "bigint" ? Number(v) : v;
    }
    return saida;
  });
}

/** Primeira linha, ou um objeto vazio. */
export async function sql1(texto) {
  const r = await sql(texto);
  return r[0] || {};
}

/** Texto entre aspas simples, seguro para interpolar em SQL. */
export const lit = (t) => "'" + String(t).replace(/'/g, "''") + "'";

/** Lista para IN (...). Vazia devolve nulo, para o chamador omitir a clausula. */
export function lista(vs) {
  if (!vs || !vs.length) return null;
  return vs.map((v) => (typeof v === "number" ? String(v) : lit(v))).join(",");
}
