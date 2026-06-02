import AgregacoesClient from './AgregacoesClient';
import data from '../../../data/cadastro_eleitoral.json';

export const metadata = {
  title: "Estatísticas de Cadastro Eleitoral — Agregações",
  description: "Tabela de agregações de locais de votação do TRE-RN.",
};

export default function Page() {
  return (
    <AgregacoesClient initialData={data} />
  );
}
