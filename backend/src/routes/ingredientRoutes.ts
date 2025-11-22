import { Router, Request, Response } from 'express';
import { Decimal } from '@prisma/client/runtime/library';
import { prisma } from '../lib/prisma';
import { authMiddleware, checkRole } from '../middlewares/auth';

const router = Router();

// Rota: Listar Ingredientes
router.get('/', authMiddleware, checkRole(['DONO']), async (req: Request, res: Response) => {
  const ingredients = await prisma.ingredient.findMany({
    where: { companyId: req.user.companyId },
    orderBy: { name: 'asc' }
  });
  return res.json(ingredients);
});

// Rota: Criar Ingrediente
router.post('/', authMiddleware, checkRole(['DONO']), async (req: Request, res: Response) => {
  const { name, stockQuantity, unit } = req.body;
  try {
    const ingredient = await prisma.ingredient.create({
      data: {
        name,
        stockQuantity: new Decimal(stockQuantity),
        unit,
        companyId: req.user.companyId
      }
    });
    return res.status(201).json(ingredient);
  } catch (error) {
    return res.status(409).json({ message: "Ingrediente já existe." });
  }
});

export default router;