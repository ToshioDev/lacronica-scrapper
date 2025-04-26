import React from 'react';
import dynamic from 'next/dynamic';

const SwaggerUI = dynamic(
  () => import('swagger-ui-react'),
  { ssr: false }
);

export default function SwaggerPage() {
  return (
    <div style={{ height: '100vh' }}>
      <SwaggerUI url="/api/swagger" docExpansion="none" supportedSubmitMethods={[]} />
    </div>
  );
}
