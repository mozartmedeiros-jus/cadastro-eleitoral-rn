import { Suspense } from 'react';
import AgregacoesClient from '../AgregacoesClient';
import data from '@data/cadastro_eleitoral.json';

export const metadata = {
  title: 'Análise de Agregações — Cadastro Eleitoral RN',
  description: 'Workspace de análise: marcar locais para agregação, definir totais e salvar ciclos.',
};

export default function Page() {
  return (
    <Suspense>
      <AgregacoesClient initialData={data} />
    </Suspense>
  );
}
