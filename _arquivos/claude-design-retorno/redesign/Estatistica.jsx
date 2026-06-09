/* Tela: Estatística — KPIs base + calculados, filtros em cascata,
   tabela expansível com edição inline (Mesa MRJ / Ponto de Apoio),
   paginação, export CSV. Lógica preservada do original. */
(function () {
  const { useState, useMemo } = React;
  const h = React.createElement;
  const I = window.Icons;
  const { formatNumber, formatPercent, getAdministrador, getCoordAcess,
    AUX_SERV_POR_LOCAL, makeRowId, padSecao } = window;

  // shared pieces
  function Field({ value, onChange, options, placeholder, disabled, lead }) {
    return h("div", { className: "field grow" },
      lead && h("span", { className: "field-lead" }, h(lead, { size: 15 })),
      h("select", {
        className: "select" + (lead ? " with-lead" : ""), value, disabled,
        onChange: (e) => onChange(e.target.value),
      },
        h("option", { value: "" }, placeholder),
        options.map((o) => h("option", { key: o, value: o }, o))
      ),
      h("span", { className: "field-chev" }, h(I.ChevronDown, { size: 15 }))
    );
  }

  function SortTh({ id, label, sort, setSort, center, stack }) {
    const active = sort.key === id;
    const onClick = () => setSort((s) => ({ key: id, dir: s.key === id && s.dir === "asc" ? "desc" : "asc" }));
    const labelEl = stack
      ? h("span", { className: "th-stack" }, stack.map((t, i) => h("span", { key: i }, t)))
      : label;
    return h("th", { className: center ? "center" : "" },
      h("button", { className: "th-btn" + (center ? " center" : ""), onClick },
        labelEl,
        active
          ? h("span", { className: "th-sort" }, h(sort.dir === "asc" ? I.ChevronUp : I.ChevronDown, { size: 13 }))
          : h(I.ArrowUpDown, { size: 12, style: { opacity: 0.45 } })
      )
    );
  }

  function Pager({ page, setPage, pageSize, setPageSize, total }) {
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    const from = total === 0 ? 0 : page * pageSize + 1;
    const to = Math.min(total, (page + 1) * pageSize);
    return h("div", { className: "pager" },
      h("div", { className: "pager-info" },
        "Exibindo ", h("b", null, formatNumber(from)), "–", h("b", null, formatNumber(to)),
        " de ", h("b", null, formatNumber(total)), " locais"),
      h("div", { className: "pager-right" },
        h("div", { className: "page-size" }, "Por página:",
          h("div", { className: "field" },
            h("select", { value: pageSize, onChange: (e) => { setPageSize(Number(e.target.value)); setPage(0); } },
              [10, 25, 50, 100].map((n) => h("option", { key: n, value: n }, n))),
            h("span", { className: "field-chev", style: { right: 8 } }, h(I.ChevronDown, { size: 13 })))),
        h("div", { className: "pager-btns" },
          h("button", { className: "pager-btn", disabled: page === 0, onClick: () => setPage(0) }, "Primeira"),
          h("button", { className: "pager-btn", disabled: page === 0, onClick: () => setPage((p) => p - 1) },
            h(I.ChevronLeft, { size: 14 })),
          h("span", { className: "pager-page" }, "Página ", h("b", null, page + 1), " de ", h("b", null, totalPages)),
          h("button", { className: "pager-btn", disabled: page >= totalPages - 1, onClick: () => setPage((p) => p + 1) },
            h(I.ChevronRight, { size: 14 })),
          h("button", { className: "pager-btn", disabled: page >= totalPages - 1, onClick: () => setPage(totalPages - 1) }, "Última"))
      )
    );
  }

  function Estatistica() {
    const DATA = window.SAMPLE_DATA;
    const [search, setSearch] = useState("");
    const [zona, setZona] = useState("");
    const [municipio, setMunicipio] = useState("");
    const [sort, setSort] = useState({ key: "qtd_aptos", dir: "desc" });
    const [page, setPage] = useState(0);
    const [pageSize, setPageSize] = useState(25);
    const [expanded, setExpanded] = useState(null);
    const [edits, setEdits] = useState({}); // rowId -> { mesa, ponto }

    const zonas = useMemo(() => [...new Set(DATA.map((d) => d.zona))].sort((a, b) => a - b), [DATA]);
    const municipios = useMemo(() => {
      const f = zona ? DATA.filter((d) => String(d.zona) === zona) : DATA;
      return [...new Set(f.map((d) => d.municipio))].sort();
    }, [DATA, zona]);

    const filtered = useMemo(() => {
      let r = DATA.filter((d) => {
        if (zona && String(d.zona) !== zona) return false;
        if (municipio && d.municipio !== municipio) return false;
        if (search) {
          const q = search.toLowerCase();
          if (!d.local.toLowerCase().includes(q) && !d.municipio.toLowerCase().includes(q)) return false;
        }
        return true;
      });
      r = [...r].sort((a, b) => {
        let av = a[sort.key], bv = b[sort.key];
        if (sort.key === "administrador") { av = getAdministrador(a.total_secoes); bv = getAdministrador(b.total_secoes); }
        if (sort.key === "coord_acess") { av = getCoordAcess(a.total_secoes); bv = getCoordAcess(b.total_secoes); }
        if (typeof av === "string") return sort.dir === "asc" ? av.localeCompare(bv) : bv.localeCompare(av);
        return sort.dir === "asc" ? av - bv : bv - av;
      });
      return r;
    }, [DATA, zona, municipio, search, sort]);

    const totals = useMemo(() => {
      const t = { locais: filtered.length, secoes: 0, aptos: 0, analf: 0, idosos: 0, le: 0, defic: 0 };
      filtered.forEach((d) => {
        t.secoes += d.total_secoes; t.aptos += d.qtd_aptos; t.analf += d.qde_analfabetos;
        t.idosos += d.qde_idosos; t.le += d.qde_le_escreve; t.defic += d.qde_eleit_c_defic;
      });
      return t;
    }, [filtered]);

    // Calculados
    const calc = useMemo(() => {
      let admin = 0, coord = 0;
      filtered.forEach((d) => { admin += getAdministrador(d.total_secoes); coord += getCoordAcess(d.total_secoes); });
      const aux = filtered.length * AUX_SERV_POR_LOCAL;
      const mesarios = totals.secoes * 4; // 4 por seção (preservado)
      return {
        admin, coord, aux, mesarios,
        presidentes: totals.secoes,
        suplentes: totals.secoes,
        secretarios: totals.secoes * 2,
        totalServidores: admin + coord + aux,
      };
    }, [filtered, totals]);

    const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
    const pageRows = filtered.slice(page * pageSize, page * pageSize + pageSize);

    function setEdit(id, field, val) {
      setEdits((e) => ({ ...e, [id]: { ...(e[id] || {}), [field]: val } }));
    }

    function exportCSV() {
      const cols = ["Zona", "Municipio", "Local", "Secoes", "Aptos", "Analfabetos", "Idosos",
        "Le_Escreve", "Defic", "Administrador", "Coord_Acess", "Aux_Serv", "Mesa_MRJ", "Ponto_Apoio"];
      const lines = [cols.join(";")];
      filtered.forEach((d) => {
        const id = makeRowId(d.zona, d.municipio, d.local);
        const e = edits[id] || {};
        lines.push([d.zona, d.municipio, `"${d.local}"`, d.total_secoes, d.qtd_aptos, d.qde_analfabetos,
          d.qde_idosos, d.qde_le_escreve, d.qde_eleit_c_defic, getAdministrador(d.total_secoes),
          getCoordAcess(d.total_secoes), AUX_SERV_POR_LOCAL, e.mesa ?? 0, e.ponto ?? 0].join(";"));
      });
      const blob = new Blob(["\uFEFF" + lines.join("\n")], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = "estatistica_cadastro_eleitoral.csv"; a.click();
      URL.revokeObjectURL(url);
    }

    const hasFilter = search || zona || municipio;

    // base KPIs (5 destaque)
    const baseKpis = [
      { label: "Locais de Votação", value: totals.locais, key: true },
      { label: "Total de Seções", value: totals.secoes, key: true },
      { label: "Eleitores Aptos", value: totals.aptos, key: true, accent: true },
      { label: "Idosos (≥60)", value: totals.idosos, sub: formatPercent(totals.idosos, totals.aptos) + " dos aptos" },
      { label: "Não alfabetizados", value: totals.analf, sub: formatPercent(totals.analf, totals.aptos) + " dos aptos" },
    ];
    // calculados (8 secundário)
    const calcKpis = [
      { label: "Lê e Escreve", value: totals.le },
      { label: "Eleitores c/ Deficiência", value: totals.defic },
      { label: "Mesários (4×seção)", value: calc.mesarios },
      { label: "Presidentes de Mesa", value: calc.presidentes },
      { label: "Secretários", value: calc.secretarios },
      { label: "Administradores de Prédio", value: calc.admin },
      { label: "Coord. Acessibilidade", value: calc.coord },
      { label: "Auxiliares de Serviço", value: calc.aux },
    ];

    return h(React.Fragment, null,
      // KPIs base
      h("div", { className: "section-head" },
        h("h2", null, "Indicadores-base"),
        h("span", { className: "hint" }, "extraídos diretamente do cadastro"),
        h("span", { className: "section-rule" })),
      h("div", { className: "kpi-grid" },
        baseKpis.map((k, i) => h("div", { key: i, className: "kpi-card is-key" },
          h("div", { className: "kpi-label" }, k.label),
          h("div", { className: "kpi-value" + (k.accent ? " accent" : "") }, formatNumber(k.value)),
          h("div", { className: "kpi-sub" }, k.sub || "\u00A0")
        ))),

      // KPIs calculados
      h("div", { className: "section-head" },
        h("h2", null, "Valores calculados"),
        h("span", { className: "hint" }, "derivados de regras de dimensionamento"),
        h("span", { className: "section-rule" })),
      h("div", { className: "calc-panel" },
        h("div", { className: "calc-grid" },
          calcKpis.map((k, i) => h("div", { key: i, className: "calc-item" },
            h("div", { className: "calc-label" }, k.label),
            h("div", { className: "calc-value" }, formatNumber(k.value))
          )))),

      // Toolbar
      h("div", { className: "toolbar" },
        h("div", { className: "search" },
          h("span", { className: "search-icon" }, h(I.Search, { size: 16 })),
          h("input", { placeholder: "Buscar local ou município…", value: search,
            onChange: (e) => { setSearch(e.target.value); setPage(0); } })),
        h(Field, { value: zona, lead: I.MapPin,
          onChange: (v) => { setZona(v); setMunicipio(""); setPage(0); },
          options: zonas.map(String), placeholder: "Todas as zonas" }),
        h(Field, { value: municipio,
          onChange: (v) => { setMunicipio(v); setPage(0); },
          options: municipios, placeholder: "Todos os municípios" }),
        hasFilter && h("button", { className: "clear-btn",
          onClick: () => { setSearch(""); setZona(""); setMunicipio(""); setPage(0); } },
          h(I.X, { size: 14 }), "Limpar"),
        h("div", { style: { flex: 1 } }),
        h("button", { className: "btn btn-primary", onClick: exportCSV },
          h(I.Download, { size: 14 }), "Exportar CSV")
      ),

      // Table
      h("div", { className: "table-card" },
        h("div", { className: "table-scroll scroll-x" },
          h("table", { className: "data" },
            h("thead", null, h("tr", null,
              h(SortTh, { id: "zona", label: "Zona", sort, setSort, center: true }),
              h(SortTh, { id: "municipio", label: "Município", sort, setSort }),
              h("th", null, "Local de Votação"),
              h(SortTh, { id: "total_secoes", label: "Seções", sort, setSort, center: true }),
              h(SortTh, { id: "qtd_aptos", label: "Aptos", sort, setSort, center: true }),
              h(SortTh, { id: "qde_analfabetos", stack: ["Não", "Alfab."], sort, setSort, center: true }),
              h(SortTh, { id: "qde_idosos", label: "Idosos", sort, setSort, center: true }),
              h(SortTh, { id: "qde_le_escreve", stack: ["Lê/", "Escreve"], sort, setSort, center: true }),
              h(SortTh, { id: "qde_eleit_c_defic", stack: ["C/", "Defic."], sort, setSort, center: true }),
              h(SortTh, { id: "administrador", stack: ["Adm.", "Prédio"], sort, setSort, center: true }),
              h(SortTh, { id: "coord_acess", stack: ["Coord.", "Acess."], sort, setSort, center: true }),
              h("th", { className: "center" }, h("span", { className: "th-stack" }, h("span", null, "Mesa"), h("span", null, "MRJ"))),
              h("th", { className: "center" }, h("span", { className: "th-stack" }, h("span", null, "Ponto"), h("span", null, "Apoio")))
            )),
            h("tbody", null,
              pageRows.length === 0
                ? h("tr", null, h("td", { colSpan: 13, className: "empty" }, "Nenhum local encontrado com os filtros atuais."))
                : pageRows.flatMap((d) => {
                    const id = makeRowId(d.zona, d.municipio, d.local);
                    const isOpen = expanded === id;
                    const e = edits[id] || {};
                    const rows = [
                      h("tr", { key: id, className: "body-row", onClick: () => setExpanded(isOpen ? null : id) },
                        h("td", { className: "td-zona" }, d.zona),
                        h("td", { className: "td-muni" }, d.municipio),
                        h("td", { className: "local-cell" },
                          h("div", { className: "local-cell-inner" },
                            h(isOpen ? I.EyeOff : I.Eye, { size: 15, className: "local-eye" + (isOpen ? " open" : "") }),
                            h("span", { className: "local-name" }, d.local))),
                        h("td", { className: "td-derived" }, d.total_secoes),
                        h("td", { className: "td-num td-accent" }, formatNumber(d.qtd_aptos)),
                        h("td", { className: "td-derived" }, formatNumber(d.qde_analfabetos)),
                        h("td", { className: "td-derived" }, formatNumber(d.qde_idosos)),
                        h("td", { className: "td-derived" }, formatNumber(d.qde_le_escreve)),
                        h("td", { className: "td-derived" }, formatNumber(d.qde_eleit_c_defic)),
                        h("td", { className: "td-derived" }, getAdministrador(d.total_secoes)),
                        h("td", { className: "td-derived" }, getCoordAcess(d.total_secoes)),
                        h("td", { className: "td-center", onClick: (ev) => ev.stopPropagation() },
                          h("input", { type: "number", className: "edit-input", min: 0, value: e.mesa ?? "",
                            placeholder: "0", onChange: (ev) => setEdit(id, "mesa", ev.target.value) })),
                        h("td", { className: "td-center", onClick: (ev) => ev.stopPropagation() },
                          h("input", { type: "number", className: "edit-input", min: 0, value: e.ponto ?? "",
                            placeholder: "0", onChange: (ev) => setEdit(id, "ponto", ev.target.value) }))
                      )
                    ];
                    if (isOpen) {
                      rows.push(h("tr", { key: id + "_d", className: "detail-row" },
                        h("td", { colSpan: 13 },
                          h("div", { className: "detail-inner" },
                            h("div", null,
                              h("div", { className: "detail-h" }, h(I.BarChart3, { size: 14 }), "Composição do eleitorado"),
                              h("div", { className: "stat-grid" },
                                [["Eleitores aptos", d.qtd_aptos, null],
                                 ["Idosos (≥60)", d.qde_idosos, formatPercent(d.qde_idosos, d.qtd_aptos)],
                                 ["Não alfabetizados", d.qde_analfabetos, formatPercent(d.qde_analfabetos, d.qtd_aptos)],
                                 ["Lê e escreve", d.qde_le_escreve, formatPercent(d.qde_le_escreve, d.qtd_aptos)],
                                 ["Com deficiência", d.qde_eleit_c_defic, formatPercent(d.qde_eleit_c_defic, d.qtd_aptos)],
                                 ["Administrador de prédio", getAdministrador(d.total_secoes), null],
                                 ["Coord. acessibilidade", getCoordAcess(d.total_secoes), null],
                                 ["Auxiliares de serviço", AUX_SERV_POR_LOCAL, null]
                                ].map((s, i) => h("div", { key: i, className: "stat-box" },
                                  h("div", { className: "stat-box-label" }, s[0]),
                                  h("div", { className: "stat-box-value" }, formatNumber(s[1])),
                                  s[2] && h("div", { className: "stat-box-pct" }, s[2])
                                )))),
                            h("div", null,
                              h("div", { className: "detail-h muted" }, h(I.MapPin, { size: 14 }),
                                d.total_secoes + " seções neste local"),
                              h("div", { className: "chips" },
                                d.secoes.map((s) => h("span", { key: s, className: "chip" }, padSecao(s))))))
                        )));
                    }
                    return rows;
                  })
            )
          )),
        h(Pager, { page, setPage, pageSize, setPageSize, total: filtered.length })
      )
    );
  }

  window.Estatistica = Estatistica;
  window.SharedUI = { Field, SortTh, Pager };
})();
