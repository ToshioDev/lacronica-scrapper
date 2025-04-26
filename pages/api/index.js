// Este archivo debe exportar un handler de API o una página React, pero no ambos.
// Para mostrar Swagger UI en /api, debe estar en /pages/api/index.jsx y exportar un componente React por defecto.

import React from 'react';
import dynamic from 'next/dynamic';

const SwaggerUI = dynamic(
  () => import('swagger-ui-react'),
  { ssr: false }
);

export default function SwaggerApiRoot() {
  return (
    <div style={{ height: '100vh' }}>
      <SwaggerUI url="/api/swagger" docExpansion="none" supportedSubmitMethods={[]} />
    </div>
  );
}
