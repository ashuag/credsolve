declare global {
  namespace Express {
    interface Request {
      /** Set by the optional customer session guard after validating the opaque cookie against Redis. */
      customerSession?: import('../modules/auth/application/contracts/customer-session-payload.contract').CustomerSessionPayload;
      /** Set by {@link LosAuthGuard} / {@link CustomerOrLosAuthGuard} after validating the LOS bearer token. */
      losUser?: import('../modules/los/auth/los-session.service').LosSessionPayload;
    }
  }
}

export {};
