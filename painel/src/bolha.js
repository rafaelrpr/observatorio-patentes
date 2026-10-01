// O balao dos izinhos de informacao.
//
// Ele era um <span> absoluto dentro do proprio izinho, e saia cortado:
// a barra lateral tem rolagem propria (overflow-y), e todo filho dela que
// passa da borda e recortado — o balao de 320 px nao cabia nos 276 px da
// coluna. Nos titulos dos graficos o corte vinha da borda da janela.
//
// Agora existe um balao so, fixo na janela e fora de qualquer caixa. O
// texto continua morando no <span> de cada izinho, que segue sendo
// atualizado pela pagina; o balao copia o que estiver la na hora de
// abrir, e se posiciona dentro da tela: em cima quando cabe, embaixo
// quando nao, e nunca alem das bordas.

const MARGEM = 10;

export function ligarBolhas() {
  const b = document.getElementById("bolha");
  if (!b) return;
  let atual = null;

  function abrir(el) {
    const fonte = el.querySelector(":scope > span");
    if (!fonte || !fonte.textContent.trim()) return;
    atual = el;
    b.innerHTML = fonte.innerHTML;
    b.hidden = false;
    b.style.left = "0px";
    b.style.top = "0px";
    const r = el.getBoundingClientRect();
    const w = b.offsetWidth, h = b.offsetHeight;
    let x = r.left + r.width / 2 - w / 2;
    x = Math.max(MARGEM, Math.min(x, innerWidth - w - MARGEM));
    let y = r.top - h - 8;
    if (y < MARGEM) y = r.bottom + 8;
    if (y + h > innerHeight - MARGEM) y = Math.max(MARGEM, innerHeight - h - MARGEM);
    b.style.left = Math.round(x) + "px";
    b.style.top = Math.round(y) + "px";
  }

  function fechar() {
    atual = null;
    b.hidden = true;
  }

  document.addEventListener("mouseover", (e) => {
    const el = e.target.closest && e.target.closest(".info");
    if (el && el !== atual) abrir(el);
  });
  document.addEventListener("mouseout", (e) => {
    if (!atual) return;
    const para = e.relatedTarget;
    // passar do izinho para o balao (para rolar um texto longo) nao fecha
    if (para && (atual.contains(para) || b.contains(para))) return;
    if (e.target === b || b.contains(e.target) || atual.contains(e.target)) {
      fechar();
    }
  });
  document.addEventListener("focusin", (e) => {
    const el = e.target.closest && e.target.closest(".info");
    if (el) abrir(el);
  });
  document.addEventListener("focusout", (e) => {
    if (atual && e.target === atual) fechar();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") fechar();
  });
  // rolar a pagina ou a lateral tira o izinho do lugar; o balao sai junto
  addEventListener("scroll", (e) => {
    if (atual && !b.contains(e.target)) fechar();
  }, true);
  addEventListener("resize", fechar);
}
