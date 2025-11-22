import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { Role } from '@prisma/client';
import { Server } from 'socket.io';

// A chave secreta (mesma que usamos no server.ts)
const JWT_SECRET_KEY = process.env.JWT_SECRET_KEY || "SEU_PROJETO_ESTA_FICANDO_INCRIVEL";

// Definindo o formato do Token
export interface TokenPayload {
  userId: string;
  role: Role;
  name: string;
  companyId: string;
  iat: number;
  exp: number;
}

// Ensinando ao Express que o objeto 'req' tem 'user' e 'io'
declare global {
  namespace Express {
    export interface Request {
      user: TokenPayload;
      io: Server; // Permite acessar o Socket.IO dentro das rotas
    }
  }
}

// Middleware 1: Verifica se o usuário está logado
export const authMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return res.status(401).json({ message: "Token não fornecido." });
  }

  // O token vem como "Bearer xxxxxxx"
  const [, token] = authHeader.split(' ');

  try {
    const decoded = jwt.verify(token, JWT_SECRET_KEY);
    req.user = decoded as TokenPayload;
    return next();
  } catch (error) {
    return res.status(401).json({ message: "Token inválido ou expirado." });
  }
};

// Middleware 2: Verifica o nível de acesso (Role)
export const checkRole = (roles: Role[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const userRole = req.user.role;

    if (!roles.includes(userRole)) {
      return res.status(403).json({ message: "Acesso negado: permissões insuficientes." });
    }

    return next();
  };
};