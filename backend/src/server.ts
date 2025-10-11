import express from 'express';
import { PrismaClient } from '@prisma/client';
import cors from 'cors';
import http from 'http';
import { Server } from 'socket.io';

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*", methods: ["GET", "POST"] }
});

const prisma = new PrismaClient();
const port = 3333;

// --- Rotas de Produtos ---
app.get('/products', async (request, response) => {
  const products = await prisma.product.findMany();
  return response.status(200).json(products);
});

// ==================================================================
// ✨ NOSSAS NOVAS ROTAS PARA GERENCIAR MESAS
// ==================================================================
// Rota para LISTAR todas as mesas
app.get('/tables', async (request, response) => {
  const tables = await prisma.table.findMany({
    orderBy: {
      name: 'asc' // Ordena as mesas pelo nome
    }
  });
  return response.status(200).json(tables);
});

// Rota para CRIAR uma nova mesa
app.post('/tables', async (request, response) => {
  const { name } = request.body;
  try {
    const table = await prisma.table.create({
      data: { name }
    });
    return response.status(201).json(table);
  } catch (error) {
    // Retorna um erro caso o nome da mesa já exista
    return response.status(409).json({ message: "Table name already exists." });
  }
});

// --- Rota de Pedidos (COM ATUALIZAÇÃO) ---
type OrderItemInput = {
  productId: string;
  quantity: number;
}

app.post('/orders', async (request, response) => {
  // ✨ ATUALIZAÇÃO: Agora recebemos um `tableId` opcional
  const { items, tableId } = request.body as { items: OrderItemInput[], tableId?: string };

  const productIds = items.map(item => item.productId);
  const productsInDb = await prisma.product.findMany({ where: { id: { in: productIds } } });
  let total = 0;
  for (const item of items) {
    const product = productsInDb.find(p => p.id === item.productId);
    if (product) {
      total += Number(product.price) * item.quantity;
    }
  }

  const createdOrder = await prisma.order.create({
    data: {
      total: total,
      tableId: tableId, // ✨ ATUALIZAÇÃO: Associamos o pedido à mesa, se o ID for fornecido
      items: { create: items.map(item => ({ productId: item.productId, quantity: item.quantity })) }
    },
    include: { items: { include: { product: true } } }
  });
  io.emit('new_order', createdOrder);
  return response.status(201).json(createdOrder);
});

// --- Rota do Dashboard ---
app.get('/dashboard/today', async (request, response) => {
    // ...código do dashboard sem alteração...
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

// --- Inicia o servidor ---
server.listen(port, () => {
  console.log(`🚀 Servidor rodando na porta ${port}`);
});