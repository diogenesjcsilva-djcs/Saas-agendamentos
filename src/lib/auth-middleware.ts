import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

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

export function authMiddleware(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: "Acesso negado. Token não fornecido." });
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, getJwtSecret()) as any;
    // Treat a valid signature as necessary but not sufficient: enforce the
    // claim shape and supported roles before making the identity available.
    if (
      !decoded ||
      typeof decoded.userId !== 'string' ||
      typeof decoded.email !== 'string' ||
      typeof decoded.name !== 'string' ||
      !['client', 'provider'].includes(decoded.role) ||
      (decoded.role === 'provider' && (typeof decoded.providerId !== 'string' || !decoded.providerId))
    ) {
      return res.status(403).json({ error: "Token inválido ou com permissões incompatíveis." });
    }
    req.user = {
      userId: decoded.userId,
      email: decoded.email,
      name: decoded.name,
      role: decoded.role,
      tenantId: typeof decoded.tenantId === 'string' ? decoded.tenantId : undefined,
      providerId: typeof decoded.providerId === 'string' ? decoded.providerId : undefined
    };
    next();
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("JWT_SECRET must be configured")) {
      return res.status(500).json({ error: "Configuração de autenticação indisponível." });
    }
    return res.status(403).json({ error: "Token inválido ou expirado." });
  }
}
