/** Customer identity resolved after validating the opaque session cookie against Redis. */
export interface CustomerSessionPayload {
  sub: string;
  mobile: string;
}
