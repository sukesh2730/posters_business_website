import { auth } from './firebase';

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
  };
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null): never {
  const currentUser = auth.currentUser;
  const rawMessage = error instanceof Error ? error.message : String(error);

  // In development, keep targeted diagnostic context without exposing credentials
  const isDev = Boolean(typeof import.meta !== 'undefined' && import.meta.env?.DEV);
  if (isDev) {
    const debugContext: FirestoreErrorInfo = {
      error: rawMessage,
      operationType,
      path,
      authInfo: {
        userId: currentUser?.uid ? `${currentUser.uid.slice(0, 6)}...` : null,
        email: currentUser?.email ? `${currentUser.email.slice(0, 3)}***` : null,
        emailVerified: currentUser?.emailVerified ?? null,
        isAnonymous: currentUser?.isAnonymous ?? null,
      },
    };
    console.warn('[Firestore Operation Diagnostic]', debugContext);
  }

  // Safe user-facing error message
  if (rawMessage.includes('permission-denied') || rawMessage.includes('insufficient permissions')) {
    throw new Error('Access denied: You do not have permission to perform this database operation.');
  }

  if (rawMessage.includes('not-found')) {
    throw new Error('The requested database record could not be found.');
  }

  throw new Error('Database operation failed. Please check your network connection and try again.');
}
