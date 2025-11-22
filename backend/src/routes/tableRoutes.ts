import { Router, Request, Response } from 'express';
import { Decimal } from '@prisma/client/runtime/library';
import { prisma } from '../lib/prisma';
import { authMiddleware, checkRole } from '../middlewares/auth';

const router = Router();

// Rota: Listar Mesas (Com cálculo de total)
router.get('/', authMiddleware, async (req: Request, res: Response) => {
  const companyId = req.user.companyId;
  
  const tables = await prisma.table.findMany({ 
    where: { companyId: companyId },
    orderBy: { name: 'asc' },
    include: {
      orders: {
        where: { status: { not: 'PAID' } },
        include: {
          items: { include: { product: true } }
        }
      }
    }
  });

  const tablesWithTotal = tables.map((t: any) => ({
    ...t,
    currentTotal: t.orders.reduce((acc: number, o: any) => acc + Number(o.total), 0),
    activeOrders: t.orders
  }));

  return res.status(200).json(tablesWithTotal);
});

// Rota: Criar Mesa
router.post('/', authMiddleware, checkRole(['DONO']), async (req: Request, res: Response) => {
  try {
    const table = await prisma.table.create({ 
      data: { name: req.body.name, companyId: req.user.companyId } 
    });
    return res.status(201).json(table);
  } catch (error) { 
    return res.status(409).json({ message: "Mesa já existe." }); 
  }
});

// Rota: Fechar Conta (Pagamento)
router.post('/:id/pay', authMiddleware, async (req: Request, res: Response) => {
  const { id: tableId } = req.params;
  const { paymentMethod } = req.body;
  const { companyId } = req.user;

  try {
    const unpaidOrders = await prisma.order.findMany({ 
      where: { tableId, companyId, status: { not: 'PAID' } } 
    });

    if (unpaidOrders.length === 0) {
      return res.status(400).json({ message: "Sem pedidos em aberto." });
    }

    const totalAmount = unpaidOrders.reduce((acc, order) => acc + Number(order.total), 0);

    // 1. Atualiza pedidos para PAID
    await prisma.order.updateMany({
      where: { tableId, companyId, status: { not: 'PAID' } },
      data: { status: 'PAID', paymentMethod: paymentMethod }
    });

    // 2. Cria transação no financeiro
    await prisma.financialTransaction.create({
      data: {
        description: `Pagamento Mesa - ${paymentMethod}`,
        amount: new Decimal(totalAmount),
        type: 'RECEITA',
        paidAt: new Date(),
        companyId
      }
    });

    // 3. Avisa o frontend via Socket (req.io foi injetado no server.ts)
    req.io.emit('order_updated', { tableId });

    return res.json({ message: "Conta fechada!", total: totalAmount });
  } catch (error) {
    return res.status(500).json({ error: "Erro ao fechar conta" });
  }
});

export default router;