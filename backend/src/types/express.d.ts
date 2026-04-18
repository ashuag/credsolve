declare global {
  namespace Express {
    interface Request {
      /** Set by the optional customer session guard after validating the opaque cookie against Redis. */
      customerSession?: import('../modules/auth/application/contracts/customer-session-payload.contract').CustomerSessionPayload;
    }
  }
}

export {};
