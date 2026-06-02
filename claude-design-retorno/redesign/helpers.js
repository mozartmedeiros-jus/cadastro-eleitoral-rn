/* Helpers — lógica de negócio preservada verbatim do código original.
   NÃO alterar regras de cálculo. */
(function () {
  function formatNumber(val) {
    return new Intl.NumberFormat("pt-BR").format(val || 0);
  }

  function formatPercent(val, total) {
    if (!total) return "0,00%";
    const pct = (val / total) * 100;
    return (
      new Intl.NumberFormat("pt-BR", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(pct) + "%"
    );
  }

  // Administrador de Prédio por nº de seções
  function getAdministrador(totalSecoes) {
    if (totalSecoes <= 4) return 1;
    if (totalSecoes <= 8) return 2;
    if (totalSecoes <= 16) return 3;
    return 4;
  }

  // Coordenador de Acessibilidade por nº de seções
  function getCoordAcess(totalSecoes) {
    if (totalSecoes <= 2) return 0;
    if (totalSecoes <= 7) return 1;
    if (totalSecoes <= 14) return 2;
    return 3;
  }

  const AUX_SERV_POR_LOCAL = 3;

  function makeRowId(zona, municipio, local) {
    return `${zona}__${municipio}__${local}`.replace(/\s+/g, "_");
  }

  function padSecao(secao) {
    return String(secao).padStart(4, "0");
  }

  Object.assign(window, {
    formatNumber,
    formatPercent,
    getAdministrador,
    getCoordAcess,
    AUX_SERV_POR_LOCAL,
    makeRowId,
    padSecao,
  });
})();
