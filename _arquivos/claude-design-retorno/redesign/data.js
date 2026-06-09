/* Sample dataset — espelha o shape real (data/cadastro_eleitoral.sample.json),
   expandido para ~17 locais em capital (Natal) e interior (Mossoró, Parnamirim)
   para demonstrar filtros em cascata e parâmetro Capital/Interior. */

(function () {
  // helper to build secoes_detalhes + derived aptos totals
  function secs(pairs) {
    return pairs.map(([secao, aptos]) => ({ secao: String(secao), aptos }));
  }

  const RAW = [
    { zona: 1, municipio: "Natal", local: "ADEFERN - ASSOC. DOS DEFICIENTES FISICOS DO RN",
      d: secs([[492,309],[493,310],[494,310],[495,307],[496,308]]),
      qtd_aptos: 1544, qde_analfabetos: 19, qde_idosos: 378, qde_le_escreve: 48, qde_eleit_c_defic: 41 },
    { zona: 1, municipio: "Natal", local: "CDF COLEGIO E CURSO ZONA NORTE",
      d: secs([[616,443],[617,442],[618,440],[619,441],[620,429]]),
      qtd_aptos: 2195, qde_analfabetos: 16, qde_idosos: 355, qde_le_escreve: 28, qde_eleit_c_defic: 30 },
    { zona: 1, municipio: "Natal", local: "CENEP - CENTRO ESTADUAL DE EDUCAÇÃO PROFIS SENADOR JESSÉ PINTO FREIRE",
      d: secs([[61,332],[62,328],[63,328],[64,328],[65,330],[66,328],[452,326]]),
      qtd_aptos: 2300, qde_analfabetos: 13, qde_idosos: 778, qde_le_escreve: 25, qde_eleit_c_defic: 43 },
    { zona: 1, municipio: "Natal", local: "CENTRO EDUCACIONAL ALFERES TIRADENTES",
      d: secs([[465,385],[466,387],[467,385],[468,390]]),
      qtd_aptos: 1547, qde_analfabetos: 11, qde_idosos: 296, qde_le_escreve: 22, qde_eleit_c_defic: 27 },
    { zona: 1, municipio: "Natal", local: "CMEI GALDINA BARBOSA SILVEIRA GUIMARAES",
      d: secs([[226,356],[234,356],[275,349]]),
      qtd_aptos: 1061, qde_analfabetos: 9, qde_idosos: 233, qde_le_escreve: 15, qde_eleit_c_defic: 18 },
    { zona: 2, municipio: "Natal", local: "CMEI NOSSA SENHORA DE LOURDES",
      d: secs([[101,327],[102,327],[287,324]]),
      qtd_aptos: 978, qde_analfabetos: 7, qde_idosos: 201, qde_le_escreve: 12, qde_eleit_c_defic: 14 },
    { zona: 2, municipio: "Natal", local: "CMEI PROFA. CLEONICE ALVES PONTES",
      d: secs([[581,311],[582,312],[583,308]]),
      qtd_aptos: 931, qde_analfabetos: 6, qde_idosos: 188, qde_le_escreve: 10, qde_eleit_c_defic: 12 },
    { zona: 2, municipio: "Natal", local: "COLEGIO SALESIANO SAO JOSE",
      d: secs([[47,441],[48,453],[49,442],[50,445],[51,311]]),
      qtd_aptos: 2092, qde_analfabetos: 14, qde_idosos: 401, qde_le_escreve: 26, qde_eleit_c_defic: 33 },
    { zona: 2, municipio: "Natal", local: "COMPLEXO CULTURAL DA UERN",
      d: secs([[584,409],[585,402],[586,409],[587,407],[588,406],[589,407],[590,409],[591,405],[592,406],[593,410],[594,406],[636,394],[641,196]]),
      qtd_aptos: 5066, qde_analfabetos: 22, qde_idosos: 612, qde_le_escreve: 41, qde_eleit_c_defic: 58 },
    { zona: 3, municipio: "Natal", local: "ESCOLA ESTADUAL 15 DE OUTUBRO",
      d: secs([[555,400],[556,406],[557,399],[558,411],[559,399],[560,400],[561,394],[562,391]]),
      qtd_aptos: 3200, qde_analfabetos: 18, qde_idosos: 488, qde_le_escreve: 31, qde_eleit_c_defic: 39 },
    { zona: 3, municipio: "Natal", local: "ESCOLA MUNICIPAL PROFESSOR ZUZA",
      d: secs([[700,48],[701,52],[702,180]]),
      qtd_aptos: 280, qde_analfabetos: 4, qde_idosos: 96, qde_le_escreve: 6, qde_eleit_c_defic: 9 },
    // ── Interior: Mossoró ──
    { zona: 14, municipio: "Mossoró", local: "ESCOLA ESTADUAL JERONIMO ROSADO",
      d: secs([[120,158],[121,160],[122,155],[123,162],[124,159]]),
      qtd_aptos: 794, qde_analfabetos: 21, qde_idosos: 162, qde_le_escreve: 18, qde_eleit_c_defic: 22 },
    { zona: 14, municipio: "Mossoró", local: "UNIVERSIDADE DO ESTADO DO RN - CAMPUS CENTRAL",
      d: secs([[200,156],[201,150],[202,148],[203,161],[204,159],[205,157]]),
      qtd_aptos: 931, qde_analfabetos: 16, qde_idosos: 140, qde_le_escreve: 20, qde_eleit_c_defic: 19 },
    { zona: 15, municipio: "Mossoró", local: "ESCOLA MUNICIPAL CONEGO AMANCIO RAMALHO",
      d: secs([[310,45],[311,140],[312,158]]),
      qtd_aptos: 343, qde_analfabetos: 12, qde_idosos: 88, qde_le_escreve: 9, qde_eleit_c_defic: 11 },
    { zona: 15, municipio: "Mossoró", local: "CENTRO EDUCACIONAL SANTA TEREZINHA",
      d: secs([[330,162],[331,165],[332,158],[333,161]]),
      qtd_aptos: 646, qde_analfabetos: 14, qde_idosos: 121, qde_le_escreve: 13, qde_eleit_c_defic: 16 },
    // ── Interior: Parnamirim ──
    { zona: 52, municipio: "Parnamirim", local: "ESCOLA ESTADUAL DR. JOSE GONCALVES DE MEDEIROS",
      d: secs([[410,151],[411,158],[412,149],[413,160]]),
      qtd_aptos: 618, qde_analfabetos: 10, qde_idosos: 132, qde_le_escreve: 12, qde_eleit_c_defic: 15 },
    { zona: 52, municipio: "Parnamirim", local: "INSTITUTO FEDERAL DO RN - CAMPUS PARNAMIRIM",
      d: secs([[420,159],[421,162],[422,158],[423,160],[424,157],[425,161]]),
      qtd_aptos: 957, qde_analfabetos: 13, qde_idosos: 119, qde_le_escreve: 17, qde_eleit_c_defic: 18 },
  ];

  window.SAMPLE_DATA = RAW.map((r) => ({
    zona: r.zona,
    municipio: r.municipio,
    local: r.local,
    total_secoes: r.d.length,
    secoes: r.d.map((x) => x.secao),
    secoes_detalhes: r.d,
    qtd_aptos: r.qtd_aptos,
    qde_analfabetos: r.qde_analfabetos,
    qde_idosos: r.qde_idosos,
    qde_le_escreve: r.qde_le_escreve,
    qde_eleit_c_defic: r.qde_eleit_c_defic,
  }));
})();
