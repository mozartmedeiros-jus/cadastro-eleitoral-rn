/* Lucide-style icon set (stroke 2, round) — reproduz os ícones lucide-react
   usados nas telas originais, para o protótipo HTML. */
(function () {
  const { createElement: h } = React;

  function Svg(props, children) {
    const { size = 18, strokeWidth = 2, style, className } = props || {};
    return h(
      "svg",
      {
        width: size,
        height: size,
        viewBox: "0 0 24 24",
        fill: "none",
        stroke: "currentColor",
        strokeWidth,
        strokeLinecap: "round",
        strokeLinejoin: "round",
        className,
        style,
        "aria-hidden": "true",
      },
      children
    );
  }
  const P = (d) => h("path", { d, key: d });
  const L = (x1, y1, x2, y2) => h("line", { x1, y1, x2, y2, key: `${x1}${y1}${x2}${y2}` });
  const C = (cx, cy, r) => h("circle", { cx, cy, r, key: `c${cx}${cy}${r}` });
  const R = (x, y, w, hh, rx) => h("rect", { x, y, width: w, height: hh, rx, key: `r${x}${y}${w}${hh}` });

  const Icons = {
    Sun: (p) => Svg(p, [C(12, 12, 4), P("M12 2v2"), P("M12 20v2"), P("m4.93 4.93 1.41 1.41"),
      P("m17.66 17.66 1.41 1.41"), P("M2 12h2"), P("M20 12h2"), P("m6.34 17.66-1.41 1.41"),
      P("m19.07 4.93-1.41 1.41")]),
    Moon: (p) => Svg(p, [P("M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z")]),
    Monitor: (p) => Svg(p, [R(2, 3, 20, 14, 2), L(8, 21, 16, 21), L(12, 17, 12, 21)]),
    Search: (p) => Svg(p, [C(11, 11, 8), L(21, 21, 16.65, 16.65)]),
    ChevronDown: (p) => Svg(p, [P("m6 9 6 6 6-6")]),
    ChevronUp: (p) => Svg(p, [P("m18 15-6-6-6 6")]),
    ChevronLeft: (p) => Svg(p, [P("m15 18-6-6 6-6")]),
    ChevronRight: (p) => Svg(p, [P("m9 18 6-6-6-6")]),
    ArrowUpDown: (p) => Svg(p, [P("m21 16-4 4-4-4"), P("M17 20V4"), P("m3 8 4-4 4 4"), P("M7 4v16")]),
    Download: (p) => Svg(p, [P("M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"), P("m7 10 5 5 5-5"), P("M12 15V3")]),
    MapPin: (p) => Svg(p, [P("M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"), C(12, 10, 3)]),
    Eye: (p) => Svg(p, [P("M2.06 12.35a1 1 0 0 1 0-.7 10.75 10.75 0 0 1 19.88 0 1 1 0 0 1 0 .7 10.75 10.75 0 0 1-19.88 0Z"), C(12, 12, 3)]),
    EyeOff: (p) => Svg(p, [
      P("M10.73 5.08a10.74 10.74 0 0 1 11.2 6.57 1 1 0 0 1 0 .7 10.75 10.75 0 0 1-1.44 2.49"),
      P("M14.08 14.16a3 3 0 0 1-4.24-4.24"),
      P("M17.48 17.5A10.75 10.75 0 0 1 2.06 12.35a1 1 0 0 1 0-.7 10.75 10.75 0 0 1 4.45-5.14"),
      L(2, 2, 22, 22)]),
    LogIn: (p) => Svg(p, [P("M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"), P("m10 17 5-5-5-5"), P("M15 12H3")]),
    LogOut: (p) => Svg(p, [P("M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"), P("m16 17 5-5-5-5"), P("M21 12H9")]),
    Pencil: (p) => Svg(p, [P("M21.17 6.81a2.12 2.12 0 0 0-3-3L3 19l-1 4 4-1Z"), P("m15 5 3 3")]),
    Check: (p) => Svg(p, [P("M20 6 9 17l-5-5")]),
    Minus: (p) => Svg(p, [P("M5 12h14")]),
    Database: (p) => Svg(p, [h("ellipse", { cx: 12, cy: 5, rx: 9, ry: 3, key: "e" }),
      P("M3 5v14a9 3 0 0 0 18 0V5"), P("M3 12a9 3 0 0 0 18 0")]),
    BarChart3: (p) => Svg(p, [P("M3 3v16a2 2 0 0 0 2 2h16"), P("M18 17V9"), P("M13 17V5"), P("M8 17v-3")]),
    LayoutDashboard: (p) => Svg(p, [R(3, 3, 7, 9, 1), R(14, 3, 7, 5, 1), R(14, 12, 7, 9, 1), R(3, 16, 7, 5, 1)]),
    Menu: (p) => Svg(p, [L(4, 6, 20, 6), L(4, 12, 20, 12), L(4, 18, 20, 18)]),
    X: (p) => Svg(p, [P("M18 6 6 18"), P("M6 6l12 12")]),
    SlidersHorizontal: (p) => Svg(p, [L(21, 4, 14, 4), L(10, 4, 3, 4), L(21, 12, 12, 12), L(8, 12, 3, 12),
      L(21, 20, 16, 20), L(12, 20, 3, 20), L(14, 2, 14, 6), L(8, 10, 8, 14), L(16, 18, 16, 22)]),
    Users: (p) => Svg(p, [P("M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"), C(9, 7, 4),
      P("M22 21v-2a4 4 0 0 0-3-3.87"), P("M16 3.13a4 4 0 0 1 0 7.75")]),
    XCircle: (p) => Svg(p, [C(12, 12, 10), P("m15 9-6 6"), P("m9 9 6 6")]),
  };

  window.Icons = Icons;
})();
