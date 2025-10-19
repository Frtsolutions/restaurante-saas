import express from 'express';
import { PrismaClient } from '@prisma/client';
import cors from 'cors';
import http from 'http';
import { Server } from 'socket.io';
import { Decimal } from '@prisma/client/runtime/library';

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*", methods: ["GET", "POST"] }
});

const prisma = new PrismaClient();
const port = 3333;

// ==================================================================
// ROTAS DE INGREDIENTES / INSUMOS
// ==================================================================
app.get('/ingredients', async (request, response) => {
  const ingredients = await prisma.ingredient.findMany({ orderBy: { name: 'asc' } });
  return response.json(ingredients);
});

app.post('/ingredients', async (request, response) => {
  const { name, stockQuantity, unit } = request.body;
  try {
    const ingredient = await prisma.ingredient.create({
      data: { name, stockQuantity: new Decimal(stockQuantity), unit }
    });
    return response.status(201).json(ingredient);
  } catch (error) {
    return response.status(409).json({ message: "Ingredient name already exists." });
  }
});

// ==================================================================
// ROTAS DE PRODUTOS
// ==================================================================
app.get('/products', async (request, response) => {
  const products = await prisma.product.findMany({ orderBy: { name: 'asc' } });
  return response.status(200).json(products);
});

app.post('/products', async (request, response) => {
  const { name, price, recipeItems } = request.body;
  try {
    const product = await prisma.product.create({
      data: {
        name,
        price: new Decimal(price),
        recipeItems: recipeItems && recipeItems.length > 0 ? {
          create: recipeItems.map((item: any) => ({
            ingredientId: item.ingredientId,
            quantity: new Decimal(item.quantity)
          }))
        } : undefined
      }
    });
    return response.status(201).json(product);
  } catch (error) {
     return response.status(409).json({ message: "Product name already exists." });
  }
});

// ==================================================================
// ROTAS DE MESAS
// ==================================================================
app.get('/tables', async (request, response) => {
  const tables = await prisma.table.findMany({ orderBy: { name: 'asc' } });
  return response.status(200).json(tables);
});

app.post('/tables', async (request, response) => {
  const { name } = request.body;
  try {
    const table = await prisma.table.create({ data: { name } });
    return response.status(201).json(table);
  } catch (error) {
    return response.status(409).json({ message: "Table name already exists." });
  }
});

// ==================================================================
// ROTA DE PEDIDOS (com Baixa Automática de Estoque)
// ==================================================================
type OrderItemInput = { productId: string; quantity: number; }

app.post('/orders', async (request, response) => {
  const { items, tableId } = request.body as { items: OrderItemInput[], tableId?: string };

  const productIds = items.map(item => item.productId);
  const productsInDb = await prisma.product.findMany({
    where: { id: { in: productIds } },
    include: { recipeItems: true }
  });

  const stockUpdates: any[] = [];
  for (const item of items) {
    const product = productsInDb.find(p => p.id === item.productId);
    if (!product) continue;
    if (product.recipeItems.length > 0) {
      for (const recipeItem of product.recipeItems) {
        stockUpdates.push(prisma.ingredient.update({
          where: { id: recipeItem.ingredientId },
          data: { stockQuantity: { decrement: new Decimal(recipeItem.quantity).mul(item.quantity) } }
        }));
      }
    } else {
      const ingredientAsProduct = await prisma.ingredient.findFirst({ where: { name: product.name }});
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
    const [createdOrder] = await prisma.$transaction([
      prisma.order.create({
        data: {
          total,
          tableId,
          items: { create: items.map(item => ({ productId: item.productId, quantity: item.quantity })) }
        },
        include: { items: { include: { product: true } } }
      }),
      ...stockUpdates
    ]);
    io.emit('new_order', createdOrder);
    return response.status(201).json(createdOrder);
  } catch (error) {
    console.error("Transaction failed: ", error);
    return response.status(500).json({ message: "Failed to process order and update stock." });
  }
});

// ==================================================================
// ✨ NOVAS ROTAS PARA O FINANCEIRO
// ==================================================================
// Rota para LISTAR todas as transações financeiras
app.get('/financial/transactions', async (request, response) => {
  const transactions = await prisma.financialTransaction.findMany({
    orderBy: {
      createdAt: 'desc'
    }
  });
  return response.status(200).json(transactions);
});

// Rota para CRIAR uma nova transação (despesa ou receita manual)
app.post('/financial/transactions', async (request, response) => {
  const { description, amount, type, dueDate } = request.body;
  try {
    const transaction = await prisma.financialTransaction.create({
      data: {
        description,
        amount: new Decimal(amount),
        type, // Deve ser 'DESPESA' ou 'RECEITA'
        dueDate: dueDate ? new Date(dueDate) : null
      }
    });
    return response.status(201).json(transaction);
  } catch (error) {
    console.error("Failed to create transaction: ", error);
    return response.status(500).json({ message: "Failed to create transaction." });
  }
});

// ==================================================================
// ROTA DE DASHBOARD
// ==================================================================
app.get('/dashboard/today', async (request, response) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const salesData = await prisma.order.aggregate({
        where: { createdAt: { gte: today } },
        _sum: { total: true },
        _count: { id: true }
    });

    const topProductsRaw = await prisma.orderItem.groupBy({
        by: ['productId'],
        where: { order: { createdAt: { gte: today } } },
        _sum: { quantity: true },
        orderBy: { _sum: { quantity: 'desc' } },
        take: 5
    });

    const topProductIds = topProductsRaw.map(p => p.productId);
    const productDetails = await prisma.product.findMany({ where: { id: { in: topProductIds } } });

    const topProducts = topProductsRaw.map(p => {
        const product = productDetails.find(pd => pd.id === p.productId);
        return {
            productId: p.productId,
            name: product?.name || 'Produto não encontrado',
            quantitySold: p._sum.quantity
        }
    });

    const dashboardData = {
        totalRevenue: salesData._sum.total || 0,
        orderCount: salesData._count.id || 0,
        topProducts: topProducts
    };
    return response.status(200).json(dashboardData);
});

// ==================================================================
// INICIA O SERVIDOR
// ==================================================================
server.listen(port, () => {
  console.log(`🚀 Servidor rodando na porta ${port}`);
});