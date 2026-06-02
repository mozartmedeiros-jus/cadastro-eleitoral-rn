/* Shell: Sidebar de navegação + Header reutilizável + controle de tema.
   Superfícies planas, borda 1px, verde institucional no estado ativo. */
(function () {
  const { useState, useRef, useEffect } = React;
  const h = React.createElement;
  const I = window.Icons;

  /* ── Theme menu (Claro / Escuro / Sistema) ───────────────────── */
  function ThemeMenu({ theme, setTheme }) {
    const [open, setOpen] = useState(false);
    const ref = useRef(null);
    useEffect(() => {
      function onDoc(e) { if (ref.current && !ref.current.contains(e.target)) setOpen(false); }
      document.addEventListener("mousedown", onDoc);
      return () => document.removeEventListener("mousedown", onDoc);
    }, []);
    const Icon = theme === "light" ? I.Sun : theme === "dark" ? I.Moon : I.Monitor;
    const opts = [
      { id: "light", label: "Claro", icon: I.Sun },
      { id: "dark", label: "Escuro", icon: I.Moon },
      { id: "system", label: "Sistema", icon: I.Monitor },
    ];
    return h("div", { ref, style: { position: "relative" } },
      h("button", {
        className: "icon-btn",
        onClick: () => setOpen((v) => !v),
        "aria-label": "Mudar tema",
        title: "Tema",
      }, h(Icon, { size: 16 })),
      open && h("div", { className: "menu fade", role: "menu" },
        opts.map((o) => h("button", {
          key: o.id,
          className: "menu-item" + (theme === o.id ? " is-active" : ""),
          onClick: () => { setTheme(o.id); setOpen(false); },
        }, h(o.icon, { size: 14 }), h("span", null, o.label)))
      )
    );
  }

  /* ── Sidebar ─────────────────────────────────────────────────── */
  function Sidebar({ route, setRoute, mobileOpen, setMobileOpen }) {
    const nav = [
      { id: "estatistica", name: "Estatística", icon: I.BarChart3 },
      { id: "agregacoes", name: "Agregações", icon: I.Database },
    ];
    return h(React.Fragment, null,
      mobileOpen && h("div", { className: "sb-backdrop", onClick: () => setMobileOpen(false) }),
      h("aside", { className: "sidebar" + (mobileOpen ? " is-open" : "") },
        h("div", { className: "sb-brand" },
          h("div", { className: "sb-logo" }, h(I.LayoutDashboard, { size: 16 })),
          h("div", null,
            h("div", { className: "sb-brand-name" }, "TRE-RN"),
            h("div", { className: "sb-brand-sub" }, "Cadastro Eleitoral")
          )
        ),
        h("nav", { className: "sb-nav" },
          h("div", { className: "sb-nav-label" }, "Navegação"),
          nav.map((item) => {
            const active = route === item.id;
            return h("button", {
              key: item.id,
              className: "sb-link" + (active ? " is-active" : ""),
              onClick: () => { setRoute(item.id); setMobileOpen(false); },
            },
              h(item.icon, { size: 18, className: "sb-link-icon" }),
              h("span", null, item.name),
              active && h("span", { className: "sb-link-bar" })
            );
          })
        ),
        h("div", { className: "sb-foot" },
          h("p", { className: "sb-foot-1" }, "Cadastro Eleitoral"),
          h("p", { className: "sb-foot-2" }, "Estatísticas e Locais · 2026")
        )
      )
    );
  }

  /* ── Header (breadcrumb + título + ações por tela) ───────────── */
  function Header({ icon, title, theme, setTheme, onMenu, children }) {
    const Ico = icon;
    return h("header", { className: "topbar" },
      h("div", { className: "topbar-inner" },
        h("div", { className: "topbar-left" },
          h("button", { className: "icon-btn mobile-menu", onClick: onMenu, "aria-label": "Menu" },
            h(I.Menu, { size: 18 })),
          h("div", null,
            h("div", { className: "crumb" },
              h("span", null, "Tribunal Regional Eleitoral"),
              h("span", { className: "crumb-dot" }),
              h("span", { className: "crumb-cur" }, "Cadastro Eleitoral")
            ),
            h("h1", { className: "page-title" },
              Ico && h(Ico, { size: 20, className: "page-title-icon" }),
              title
            )
          )
        ),
        h("div", { className: "topbar-actions" },
          children,
          h("div", { className: "topbar-divider" }),
          h(ThemeMenu, { theme, setTheme }),
          h("button", { className: "btn btn-ghost" },
            h(I.LogIn, { size: 14 }), h("span", { className: "hide-sm" }, "Entrar"))
        )
      )
    );
  }

  window.Shell = { Sidebar, Header, ThemeMenu };
})();
