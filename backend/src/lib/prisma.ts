import { PrismaClient } from '@prisma/client';

// Evita múltiplas conexões em ambiente de desenvolvimento (Hot Reload)
declare global {
  var prisma: PrismaClient | undefined;
}

export const prisma = global.prisma || new PrismaClient();

if (process.env.NODE_ENV !== 'production') {
  global.prisma = prisma;
}