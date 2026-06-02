/* Tela: Agregações — filtros em cascata (zona/município/local) +
   toggle "Marcados" + parâmetros capital/interior, tabela com badges
   de seção coloridos por faixa, colunas editáveis AGREGAR + TOTAL. */
(function () {
  const { useState, useMemo } = React;
  const h = React.createElement;
  const I = window.Icons;
  const { formatNumber, padSecao, makeRowId } = window;
  const { Field, Pager } = window.SharedUI;

  // Capitais do RN para o parâmetro Capital/Interior
  const CAPITAIS = new Set(["Natal"]);

  function Agregacoes() {
    const DATA = window.SAMPLE_DATA;
    const [zona, setZona] = useState("");
    const [municipio, setMunicipio] = useState("");
    const [local, setLocal] = useState("");
    const [onlyMarked, setOnlyMarked] = useState(false);
    const [limiteCapital, setLimiteCapital] = useState(400);
    const [limiteInterior, setLimiteInterior] = useState(300);
    const [page, setPage] = useState(0);
    const [pageSize, setPageSize] = useState(25);
    const [marks, setMarks] = useState({}); // secKey -> bool (AGREGAR)
    const [totals, setTotals] = useState({}); // secKey -> number (TOTAL)

    const zonas = useMemo(() => [...new Set(DATA.map((d) => d.zona))].sort((a, b) => a - b), [DATA]);
    const municipios = useMemo(() => {
      const f = zona ? DATA.filter((d) => String(d.zona) === zona) : DATA;
      return [...new Set(f.map((d) => d.municipio))].sort();
    }, [DATA, zona]);
    const locais = useMemo(() => {
      let f = DATA;
      if (zona) f = f.filter((d) => String(d.zona) === zona);
      if (municipio) f = f.filter((d) => d.municipio === municipio);
      return [...new Set(f.map((d) => d.local))].sort();
    }, [DATA, zona, municipio]);

    const filtered = useMemo(() => {
      let r = DATA.filter((d) => {
        if (zona && String(d.zona) !== zona) return false;
        if (municipio && d.municipio !== municipio) return false;
        if (local && d.local !== local) return false;
        return true;
      });
      if (onlyMarked) {
        r = r.filter((d) => d.secoes_detalhes.some((s) => marks[makeRowId(d.zona, d.municipio, d.local) + "_" + s.secao]));
      }
      return r;
    }, [DATA, zona, municipio, local, onlyMarked, marks]);

    // limite por linha conforme capital/interior
    function limiteDe(d) { return CAPITAIS.has(d.municipio) ? limiteCapital : limiteInterior; }

    // badge classification
    function badgeClass(aptos, limite) {
      if (aptos <= 50) return "badge--low";
      if (aptos <= limite) return "badge--ok";
      return "badge--over";
    }

    const rowsAll = filtered;
    const totalPages = Math.max(1, Math.ceil(rowsAll.length / pageSize));
    const pageRows = rowsAll.slice(page * pageSize, page * pageSize + pageSize);

    // running summary
    const summary = useMemo(() => {
      let secoes = 0, agregadas = 0, totalSum = 0;
      filtered.forEach((d) => {
        const rid = makeRowId(d.zona, d.municipio, d.local);
        d.secoes_detalhes.forEach((s) => {
          secoes++;
          const k = rid + "_" + s.secao;
          if (marks[k]) agregadas++;
          totalSum += Number(totals[k] ?? s.aptos);
        });
      });
      return { secoes, agregadas, totalSum, locais: filtered.length };
    }, [filtered, marks, totals]);

    const hasFilter = zona || municipio || local || onlyMarked;

    return h(React.Fragment, null,
      // Summary strip (KPIs leves)
      h("div", { className: "section-head" },
        h("h2", null, "Resumo da agregação"),
        h("span", { className: "hint" }, "atualiza conforme filtros e marcações"),
        h("span", { className: "section-rule" })),
      h("div", { className: "calc-panel", style: { marginBottom: 22 } },
        h("div", { className: "calc-grid", style: { gridTemplateColumns: "repeat(4,1fr)" } },
          [["Locais", summary.locais], ["Seções", summary.secoes],
           ["Seções agregadas", summary.agregadas], ["Total de eleitores", summary.totalSum]]
          .map((k, i) => h("div", { key: i, className: "calc-item" },
            h("div", { className: "calc-label" }, k[0]),
            h("div", { className: "calc-value" + (i === 2 ? "" : "") }, formatNumber(k[1])))))),

      // Toolbar — filtros em cascata + params
      h("div", { className: "toolbar stack" },
        h("div", { className: "toolbar-row" },
          h(Field, { value: zona, lead: I.MapPin,
            onChange: (v) => { setZona(v); setMunicipio(""); setLocal(""); setPage(0); },
            options: zonas.map(String), placeholder: "Todas as zonas" }),
          h(Field, { value: municipio,
            onChange: (v) => { setMunicipio(v); setLocal(""); setPage(0); },
            options: municipios, placeholder: "Todos os municípios" }),
          h(Field, { value: local,
            onChange: (v) => { setLocal(v); setPage(0); },
            options: locais, placeholder: "Todos os locais" }),
          h("button", {
            className: "seg", onClick: () => { setOnlyMarked((v) => !v); setPage(0); },
            style: { cursor: "pointer", padding: 0 } },
            h("span", { className: "seg-btn" + (!onlyMarked ? " is-active" : "") }, "Todos"),
            h("span", { className: "seg-btn" + (onlyMarked ? " is-active" : "") },
              h(I.Check, { size: 13 }), "Marcados")),
          hasFilter && h("button", { className: "clear-btn",
            onClick: () => { setZona(""); setMunicipio(""); setLocal(""); setOnlyMarked(false); setPage(0); } },
            h(I.X, { size: 14 }), "Limpar")),
        h("div", { className: "toolbar-row between toolbar-sep" },
          h("div", { className: "toolbar-row" },
            h("span", { className: "toolbar-label" }, h(I.SlidersHorizontal, { size: 14, style: { verticalAlign: "-2px", marginRight: 6 } }), "Limite de eleitores por seção"),
            h("div", { className: "param-box" },
              h("label", null, "Capital"),
              h("input", { type: "number", min: 0, value: limiteCapital,
                onChange: (e) => setLimiteCapital(Number(e.target.value) || 0) })),
            h("div", { className: "param-box" },
              h("label", null, "Interior"),
              h("input", { type: "number", min: 0, value: limiteInterior,
                onChange: (e) => setLimiteInterior(Number(e.target.value) || 0) }))),
          h("div", { className: "legend" },
            h("span", { className: "legend-item" },
              h("span", { className: "legend-swatch", style: { borderColor: "var(--danger-bd)", background: "var(--danger-soft)" } }),
              "≤ 50 eleitores"),
            h("span", { className: "legend-item" },
              h("span", { className: "legend-swatch", style: { borderColor: "var(--accent-soft-bd)", background: "var(--accent-soft-bg)" } }),
              "dentro do limite"),
            h("span", { className: "legend-item" },
              h("span", { className: "legend-swatch", style: { borderColor: "var(--border-strong)", background: "var(--surface)" } }),
              "acima do limite"))
        )
      ),

      // Table
      h("div", { className: "table-card" },
        h("div", { className: "table-scroll scroll-x" },
          h("table", { className: "data" },
            h("thead", null, h("tr", null,
              h("th", { className: "center" }, "Zona"),
              h("th", null, "Município"),
              h("th", null, "Local de Votação"),
              h("th", null, "Seções (seção · eleitorado)"),
              h("th", { className: "center" }, "Agregar"),
              h("th", { className: "center" }, "Total")
            )),
            h("tbody", null,
              pageRows.length === 0
                ? h("tr", null, h("td", { colSpan: 6, className: "empty" }, "Nenhum local encontrado com os filtros atuais."))
                : pageRows.map((d) => {
                    const rid = makeRowId(d.zona, d.municipio, d.local);
                    const limite = limiteDe(d);
                    const locTotal = d.secoes_detalhes.reduce((sum, s) =>
                      sum + Number(totals[rid + "_" + s.secao] ?? s.aptos), 0);
                    const anyMark = d.secoes_detalhes.some((s) => marks[rid + "_" + s.secao]);
                    return h("tr", { key: rid, className: "body-row", style: { cursor: "default" } },
                      h("td", { className: "td-zona" }, d.zona),
                      h("td", { className: "td-muni" },
                        d.municipio,
                        CAPITAIS.has(d.municipio)
                          ? h("div", { style: { fontSize: 10, color: "var(--ink-4)", fontWeight: 500 } }, "capital")
                          : h("div", { style: { fontSize: 10, color: "var(--ink-4)", fontWeight: 500 } }, "interior")),
                      h("td", { className: "local-cell" }, h("span", { className: "local-name" }, d.local)),
                      h("td", null,
                        h("div", { className: "sec-badges" },
                          d.secoes_detalhes.map((s) => h("span", {
                            key: s.secao, className: "badge " + badgeClass(s.aptos, limite),
                            title: `Seção ${padSecao(s.secao)} · ${formatNumber(s.aptos)} eleitores`,
                          },
                            h("span", { className: "b-sec" }, padSecao(s.secao)),
                            h("span", { className: "b-div" }, "·"),
                            h("span", { className: "b-apt" }, formatNumber(s.aptos)))))),
                      h("td", { className: "td-center" },
                        h("input", {
                          type: "checkbox", className: "agg-check", checked: !!anyMark,
                          onChange: (e) => {
                            const v = e.target.checked;
                            setMarks((m) => {
                              const nm = { ...m };
                              d.secoes_detalhes.forEach((s) => { nm[rid + "_" + s.secao] = v; });
                              return nm;
                            });
                          },
                        })),
                      h("td", { className: "td-center" },
                        h("input", {
                          type: "number", className: "edit-input", min: 0,
                          value: totals[rid + "_total"] ?? locTotal,
                          onChange: (e) => setTotals((t) => ({ ...t, [rid + "_total"]: Number(e.target.value) || 0 })),
                        }))
                    );
                  })
            )
          )),
        h(Pager, { page, setPage, pageSize, setPageSize, total: rowsAll.length })
      )
    );
  }

  window.Agregacoes = Agregacoes;
})();
