'use server';

import { getAdminApp } from '@/firebase/admin-config';
import { getFirestore, serverTimestamp } from 'firebase-admin/firestore';

export interface BuildInfo {
  revisionNumber: number;
  commitHash: string;
  timestamp: string;
}

export async function getLatestBuildInfo(): Promise<BuildInfo | null> {
  // Se não estivermos em um ambiente de produção (onde as credenciais estariam), não tente buscar.
  if (process.env.NODE_ENV !== 'production' || !process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    return null;
  }
  
  try {
    const adminApp = getAdminApp();
    const firestore = getFirestore(adminApp);
    
    const buildsRef = firestore.collection('builds');
    const q = buildsRef.orderBy('revisionNumber', 'desc').limit(1);
    
    const querySnapshot = await q.get();
    
    if (querySnapshot.empty) {
      return null;
    }
    
    const latestBuild = querySnapshot.docs[0].data();
    
    return {
      revisionNumber: latestBuild.revisionNumber,
      commitHash: latestBuild.commitHash,
      timestamp: (latestBuild.timestamp.toDate()).toLocaleString('pt-BR'),
    };
  } catch (error) {
    // Em vez de logar um erro, que pode ser barulhento no desenvolvimento,
    // podemos apenas avisar que a busca falhou, o que é esperado localmente.
    console.warn("Falha ao buscar informações de build:", error);
    return null;
  }
}

export async function saveBuildInfo(commitHash: string): Promise<void> {
   // Se não estivermos em um ambiente de produção, não tente salvar.
  if (process.env.NODE_ENV !== 'production' || !process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    console.log("Ignorando salvamento de informações de build em ambiente de desenvolvimento.");
    return;
  }

  try {
    const adminApp = getAdminApp();
    const firestore = getFirestore(adminApp);
    
    const buildsRef = firestore.collection('builds');
    const q = buildsRef.orderBy('revisionNumber', 'desc').limit(1);
    
    const querySnapshot = await q.get();
    
    let nextRevisionNumber = 1;
    if (!querySnapshot.empty) {
      const latestBuild = querySnapshot.docs[0].data();
      nextRevisionNumber = latestBuild.revisionNumber + 1;
    }
    
    await buildsRef.add({
      revisionNumber: nextRevisionNumber,
      commitHash: commitHash,
      timestamp: serverTimestamp(),
    });

  } catch (error) {
    console.error("Error saving build info:", error);
  }
}
