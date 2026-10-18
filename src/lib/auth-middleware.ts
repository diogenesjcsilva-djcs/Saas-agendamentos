import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { query } from './db';

export interface AuthenticatedRequest extends Request {
  user?: {
    userId: string;
    email: string;
    role: 'provider' | 'client';
    name: string;
    tenantId?: string;
    providerId?: string;
  };
}

export function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 32) throw new Error('JWT_SECRET must be configured and contain at least 32 characters.');
  return secret;
}

export async function authMiddleware(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: "Acesso negado. Token não fornecido." });
  }

  const token = authHeader.slice('Bearer '.length).trim();
  if (!token) {
    return res.status(401).json({ error: "Acesso negado. Token não fornecido." });
  }

  let decoded: any;
  try {
    decoded = jwt.verify(token, getJwtSecret());
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("JWT_SECRET must be configured")) {
      return res.status(500).json({ error: "Configuração de autenticação indisponível." });
    }
    return res.status(403).json({ error: "Token inválido ou expirado." });
  }

  // The signed token identifies a candidate user only. Current authorization
  // attributes must come from the database so deleted/changed accounts and
  // stale tenant/provider claims cannot retain access until token expiry.
  if (
    !decoded ||
    typeof decoded.userId !== 'string' ||
    !decoded.userId ||
    typeof decoded.role !== 'string' ||
    !['client', 'provider'].includes(decoded.role)
  ) {
    return res.status(403).json({ error: "Token inválido ou com permissões incompatíveis." });
  }

  try {
    const rows = await query<{
      userId: string;
      email: string;
      name: string;
      role: string;
      tenantId: string | null;
      providerId: string | null;
      providerTenantId: string | null;
    }>(
      `SELECT u.id AS "userId", u.email, u.name, u.role,
              u.tenant_id AS "tenantId", u.provider_id AS "providerId",
              p.tenant_id AS "providerTenantId"
       FROM users u
       LEFT JOIN providers p ON p.id = u.provider_id
       WHERE u.id = $1
       LIMIT 1`,
      [decoded.userId]
    );

    const account = rows[0];
    if (!account || !['client', 'provider'].includes(account.role) || account.role !== decoded.role) {
      return res.status(403).json({ error: "Conta inválida, removida ou com permissões alteradas." });
    }

    if (account.role === 'provider') {
      // Require a live provider record and consistent tenant ownership in the
      // users and providers tables. Do not trust tenantId/providerId from JWT.
      if (
        !account.providerId ||
        !account.providerTenantId ||
        account.tenantId !== account.providerTenantId
      ) {
        return res.status(403).json({ error: "Vínculo do profissional inválido." });
      }
    }

    req.user = {
      userId: account.userId,
      email: account.email,
      name: account.name,
      role: account.role as 'provider' | 'client',
      tenantId: account.tenantId || undefined,
      providerId: account.role === 'provider' ? account.providerId || undefined : undefined
    };
    return next();
  } catch (error) {
    // A database outage is not an invalid-token condition. Fail closed without
    // exposing SQL, connection strings, or internal exception details.
    console.error('Authentication identity lookup failed.');
    return res.status(503).json({ error: "Não foi possível validar a sessão no momento." });
  }
}
