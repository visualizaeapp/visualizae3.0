import admin from 'firebase-admin';

// Armazena a instância para evitar reinicializações
let app: admin.app.App | null = null;

export function getAdminApp(): admin.app.App {
  // Se a app já foi inicializada, retorna a instância existente
  if (admin.apps.length > 0) {
      app = admin.apps[0]!;
      return app;
  }

  // A inicialização sem parâmetros tentará usar as Credenciais Padrão do Aplicativo
  // do Google, que é o comportamento esperado em ambientes do Google Cloud.
  try {
    app = admin.initializeApp();
    return app;
  } catch (error: any) {
    // Evita que a aplicação quebre se as credenciais não estiverem disponíveis
    console.warn(
      'Falha ao inicializar o Firebase Admin SDK. As funções de servidor podem não funcionar. Erro:',
      error.message
    );
    // Retorna uma representação 'vazia' se tudo falhar, para evitar que o código que chama quebre.
    return {} as admin.app.App;
  }
}
