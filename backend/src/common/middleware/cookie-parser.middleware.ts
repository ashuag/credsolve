import { type NextFunction, type Request, type Response } from 'express';

type CookieMap = Record<string, string>;

function decodeCookieValue(value: string) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function parseCookies(header: string | string[] | undefined): CookieMap {
  const cookieHeader = Array.isArray(header) ? header.join(';') : header;

  if (!cookieHeader) {
    return {};
  }

  return cookieHeader
    .split(';')
    .map((entry) => entry.trim())
    .filter(Boolean)
    .reduce<CookieMap>((cookies, entry) => {
      const [name, ...valueParts] = entry.split('=');

      if (!name) {
        return cookies;
      }

      cookies[name] = decodeCookieValue(valueParts.join('='));
      return cookies;
    }, {});
}

export function cookieParserMiddleware(request: Request, _response: Response, next: NextFunction) {
  request.cookies = parseCookies(request.headers.cookie);
  next();
}
