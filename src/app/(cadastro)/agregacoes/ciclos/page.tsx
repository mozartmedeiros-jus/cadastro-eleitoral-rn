import { Suspense } from 'react';
import CiclosClient from './CiclosClient';

export const metadata = {
  title: 'Ciclos Guardados — Cadastro Eleitoral RN',
  description: 'Lista de ciclos de análise de agregação salvos.',
};

export default function Page() {
  return (
    <Suspense>
      <CiclosClient />
    </Suspense>
  );
}
