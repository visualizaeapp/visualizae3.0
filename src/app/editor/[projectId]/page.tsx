import React from 'react';
import { EditorProvider } from '@/components/editor/editor-provider';
import EditorPageClient from './editor-page-client';

interface EditorPageProps {
  params: Promise<{ projectId: string }>;
}

// O componente agora é explicitamente assíncrono para aguardar as props.
export default async function EditorPage({ params }: EditorPageProps) {
  // Acessa o projectId dos params resolvidos.
  const { projectId } = await params;

  return (
    <EditorProvider>
      {/* Passa apenas o projectId para o componente cliente para evitar problemas de serialização. */}
      <EditorPageClient projectId={projectId} />
    </EditorProvider>
  );
}
