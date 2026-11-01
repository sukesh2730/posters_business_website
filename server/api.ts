// Re-export from canonical server.ts module
export {
  apiRouter,
  verifyRequestAuth,
  isAuthorizedAdmin,
  TRUSTED_CATALOG,
  TRUSTED_COUPONS
} from '../server.ts';
export type { AuthenticatedUser } from '../server.ts';
