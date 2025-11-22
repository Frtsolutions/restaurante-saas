import { Router, Request, Response } from 'express';
import { Decimal } from '@prisma/client/runtime/library';
import { prisma } from '../lib/prisma';
import { authMiddleware, checkRole } from '../middlewares/auth';

const router = Router();

// Rota: Listar Transações
router.get('/', authMiddleware, checkRole(['DONO']), async (req: Request, res: Response) => {
  const transactions = await prisma.financialTransaction.findMany({
    where: { companyId: req.user.companyId },
    orderBy: { createdAt: 'desc' }
  });
  return res.status(200).json(transactions);
});

// Rota: Criar Transação (Manual)
router.post('/', authMiddleware, checkRole(['DONO']), async (req: Request, res: Response) => {
  const { description, amount, type, dueDate } = req.body;
  try {
    const transaction = await prisma.financialTransaction.create({
      data: {
        description,
        amount: new Decimal(amount),
        type,
        dueDate: dueDate ? new Date(dueDate) : null,
        companyId: req.user.companyId
      }
    });
    return res.status(201).json(transaction);
  } catch (error) {
    console.error("Failed to create transaction: ", error);
    return res.status(500).json({ message: "Erro ao criar transação." });
  }
});

export default router;