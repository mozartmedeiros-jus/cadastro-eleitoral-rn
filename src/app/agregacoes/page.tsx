import { Suspense } from 'react';
import AgregacoesOverview from './AgregacoesOverview';
import data from '../../../data/cadastro_eleitoral.json';

export const metadata = {
  title: 'Agregações — Cadastro Eleitoral RN',
  description: 'Painel analítico de agregações por ciclo.',
};

export default function Page() {
  return (
    <Suspense>
      <AgregacoesOverview initialData={data} />
    </Suspense>
  );
}
