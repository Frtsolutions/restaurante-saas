import { Router, Request, Response } from 'express';
import { Decimal } from '@prisma/client/runtime/library';
import { prisma } from '../lib/prisma';
import { authMiddleware } from '../middlewares/auth';

const router = Router();

type OrderItemInput = { productId: string; quantity: number; }

// Rota: Criar Pedido (Com Baixa de Estoque)
router.post('/', authMiddleware, async (req: Request, res: Response) => {
  const { userId, companyId } = req.user;
  const { items, tableId } = req.body as { items: OrderItemInput[], tableId?: string };

  const productIds = items.map(item => item.productId);
  
  // Busca produtos e receitas
  const productsInDb = await prisma.product.findMany({
    where: { id: { in: productIds }, companyId },
    include: { recipeItems: true }
  });
  
  if (productsInDb.length !== items.length) {
    return res.status(400).json({ message: "Produtos inválidos." });
  }

  // Prepara atualizações de estoque
  const stockUpdates: any[] = [];
  for (const item of items) {
    const product = productsInDb.find(p => p.id === item.productId);
    if (!product) continue;

    if (product.recipeItems.length > 0) {
      // Baixa pela receita
      for (const recipeItem of product.recipeItems) {
        stockUpdates.push(prisma.ingredient.update({
          where: { id: recipeItem.ingredientId },
          data: { stockQuantity: { decrement: new Decimal(recipeItem.quantity).mul(item.quantity) } }
        }));
      }
    } else {
      // Baixa direta (produto sem receita, ex: latinha)
      const ingredientAsProduct = await prisma.ingredient.findFirst({ 
        where: { name: product.name, companyId }
      });
      if(ingredientAsProduct) {
        stockUpdates.push(prisma.ingredient.update({
          where: { id: ingredientAsProduct.id },
          data: { stockQuantity: { decrement: item.quantity } }
        }));
      }
    }
  }
  
  const total = productsInDb.reduce((acc, product) => {
    const orderItem = items.find(item => item.productId === product.id);
    const itemQuantity = orderItem ? orderItem.quantity : 0;
    return acc + (Number(product.price) * itemQuantity);
  }, 0);
  
  try {
    // Transação: Cria pedido e baixa estoque atomicamente
    const [createdOrder] = await prisma.$transaction([
      prisma.order.create({
        data: {
          total: new Decimal(total),
          tableId,
          userId,
          companyId,
          status: 'PENDING',
          items: { create: items.map(item => ({ productId: item.productId, quantity: item.quantity })) }
        },
        include: { items: { include: { product: true } } }
      }),
      ...stockUpdates
    ]);

    req.io.emit('new_order', createdOrder);
    return res.status(201).json(createdOrder);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Erro ao processar pedido." });
  }
});

// Rota: KDS Marcar como Pronto
router.patch('/:id/ready', authMiddleware, async (req: Request, res: Response) => {
  const { id } = req.params;
  const { companyId } = req.user;

  try {
    const order = await prisma.order.update({ 
      where: { id, companyId }, 
      data: { status: 'READY' } 
    });
    
    req.io.emit('order_updated', order);
    return res.json(order);
  } catch (error) {
    return res.status(500).json({ error: "Erro ao atualizar pedido" });
  }
});

export default router;