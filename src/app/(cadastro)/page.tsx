import CadastroClient from './CadastroClient';
import data from '@data/cadastro_eleitoral.json';

export const metadata = {
  title: "Estatísticas de Cadastro Eleitoral — RN",
  description: "Dashboard de estatísticas e locais de votação com dados do TRE-RN.",
};

export default function Page() {
  return (
    <CadastroClient initialData={data} />
  );
}
