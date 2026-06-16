import GestaoOrcamentariaClient from './GestaoOrcamentariaClient';

export const metadata = {
  title: 'Gestão Orçamentária | TRE-RN',
  description: 'Visão consolidada do orçamento dos Pleitos Eleitorais 2026 por setor e por PI (Gestão SPLE)',
};

export default function GestaoOrcamentariaPage() {
  return <GestaoOrcamentariaClient />;
}
