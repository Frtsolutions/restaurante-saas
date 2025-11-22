import express, { Request, Response, NextFunction } from 'express';
import { PrismaClient, Role } from '@prisma/client';
import cors from 'cors';
import http from 'http';
import { Server } from 'socket.io';
import { Decimal } from '@prisma/client/runtime/library';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { createClient } from '@supabase/supabase-js';
import multer from 'multer';
import path from 'path';

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*", methods: ["GET", "POST", "PATCH"] }
});

const prisma = new PrismaClient();
const port = process.env.PORT || 3333;

const JWT_SECRET_KEY = process.env.JWT_SECRET_KEY || "SEU_PROJETO_ESTA_FICANDO_INCRIVEL";

// --- CONFIGURAÇÃO DO SUPABASE STORAGE E MULTER ---
const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);
const upload = multer({
  storage: multer.memoryStorage(),
});

// ==================================================================
// INTERFACES E EXTENSÕES
// ==================================================================
interface TokenPayload {
  userId: string;
  role: Role;
  name: string;
  companyId: string;
  iat: number;
  exp: number;
}

declare global {
  namespace Express {
    export interface Request {
      user: TokenPayload;
    }
  }
}

// ==================================================================
// MIDDLEWARES
// ==================================================================
const authMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ message: "Token não fornecido." });
  const [, token] = authHeader.split(' ');
  try {
    const decoded = jwt.verify(token, JWT_SECRET_KEY);
    req.user = decoded as TokenPayload;
    return next();
  } catch (error) {
    return res.status(401).json({ message: "Token inválido." });
  }
};

const checkRole = (roles: Role[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const userRole = req.user.role;
    if (!roles.includes(userRole)) return res.status(403).json({ message: "Acesso negado." });
    return next();
  };
};

// ==================================================================
// ROTAS DE AUTENTICAÇÃO
// ==================================================================
app.post('/auth/register', async (request, response) => {
  const { email, name, password, companyName } = request.body; 
  if (!companyName) return response.status(400).json({ message: "Nome da empresa obrigatório." });
  const salt = await bcrypt.genSalt(10);
  const passwordHash = await bcrypt.hash(password, salt);
  try {
    const newCompany = await prisma.company.create({
      data: { name: companyName, users: { create: { email, name, passwordHash, role: 'DONO' } } },
      include: { users: true }
    });
    const user = newCompany.users[0];
    // @ts-ignore
    const { passwordHash: _, ...userWithoutPassword } = user;
    return response.status(201).json(userWithoutPassword);
  } catch (error) { return response.status(409).json({ message: "Erro ao criar conta." }); }
});

app.post('/auth/login', async (request, response) => {
  const { email, password } = request.body;
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) return response.status(404).json({ message: "Usuário não encontrado." });
  const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
  if (!isPasswordValid) return response.status(401).json({ message: "Senha inválida." });
  const token = jwt.sign( { userId: user.id, role: user.role, name: user.name, companyId: user.companyId }, JWT_SECRET_KEY, { expiresIn: '1d' } );
  return response.status(200).json({ token, user: { id: user.id, name: user.name, email: user.email, role: user.role, companyId: user.companyId } });
});

// ==================================================================
// ROTAS GERAIS
// ==================================================================
app.get('/ingredients', authMiddleware, checkRole(['DONO']), async (request, response) => {
  const ingredients = await prisma.ingredient.findMany({ where: { companyId: request.user.companyId }, orderBy: { name: 'asc' } });
  return response.json(ingredients);
});

app.post('/ingredients', authMiddleware, checkRole(['DONO']), async (request, response) => {
  const { name, stockQuantity, unit } = request.body;
  try {
    const ingredient = await prisma.ingredient.create({ data: { name, stockQuantity: new Decimal(stockQuantity), unit, companyId: request.user.companyId } });
    return response.status(201).json(ingredient);
  } catch (error) { return response.status(409).json({ message: "Ingrediente já existe." }); }
});

app.get('/products', authMiddleware, async (request, response) => {
  const products = await prisma.product.findMany({ where: { companyId: request.user.companyId }, orderBy: { name: 'asc' } });
  return response.status(200).json(products);
});

app.post('/products', authMiddleware, checkRole(['DONO']), async (request, response) => {
  const { name, price, recipeItems, category } = request.body;
  try {
    const product = await prisma.product.create({
      data: {
        name, price: new Decimal(price), companyId: request.user.companyId,
        category: category || 'COMIDA',
        recipeItems: recipeItems && recipeItems.length > 0 ? {
          create: recipeItems.map((item: any) => ({ ingredientId: item.ingredientId, quantity: new Decimal(item.quantity) }))
        } : undefined
      }
    });
    return response.status(201).json(product);
  } catch (error) { return response.status(409).json({ message: "Produto já existe." }); }
});

app.post('/products/:id/upload', authMiddleware, checkRole(['DONO']), upload.single('image'), async (request: Request, response: Response) => {
    const { id: productId } = request.params;
    if (!request.file) return response.status(400).json({ message: "Nenhum arquivo enviado." });
    const fileExtension = path.extname(request.file.originalname);
    const fileName = `${request.user.companyId}/${productId}_${Date.now()}${fileExtension}`;
    try {
      const { error: uploadError } = await supabase.storage.from('product-images').upload(fileName, request.file.buffer, { contentType: request.file.mimetype, upsert: true });
      if (uploadError) throw uploadError;
      const { data: { publicUrl } } = supabase.storage.from('product-images').getPublicUrl(fileName);
      const updatedProduct = await prisma.product.update({ where: { id: productId, companyId: request.user.companyId }, data: { imageUrl: publicUrl } });
      return response.status(200).json(updatedProduct);
    } catch (error) { return response.status(500).json({ message: "Falha no upload." }); }
});

// ==================================================================
// ROTAS DE MESAS E PEDIDOS
// ==================================================================
app.get('/tables', authMiddleware, async (request, response) => {
  const tables = await prisma.table.findMany({ 
    where: { companyId: request.user.companyId },
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
  
  const tablesWithTotal = tables.map(t => ({
    ...t,
    currentTotal: t.orders.reduce((acc: number, o: any) => acc + Number(o.total), 0),
    activeOrders: t.orders
  }));
  return response.status(200).json(tablesWithTotal);
});

app.post('/tables', authMiddleware, checkRole(['DONO']), async (request, response) => {
  try {
    const table = await prisma.table.create({ data: { name: request.body.name, companyId: request.user.companyId } });
    return response.status(201).json(table);
  } catch (error) { return response.status(409).json({ message: "Mesa já existe." }); }
});

app.post('/tables/:id/pay', authMiddleware, async (request, response) => {
  const { id: tableId } = request.params;
  const { paymentMethod } = request.body;
  const { companyId } = request.user;
  try {
    const unpaidOrders = await prisma.order.findMany({ where: { tableId, companyId, status: { not: 'PAID' } } });
    if (unpaidOrders.length === 0) return response.status(400).json({ message: "Sem pedidos em aberto." });
    const totalAmount = unpaidOrders.reduce((acc, order) => acc + Number(order.total), 0);
    
    await prisma.order.updateMany({
      where: { tableId, companyId, status: { not: 'PAID' } },
      data: { status: 'PAID', paymentMethod: paymentMethod }
    });
    
    await prisma.financialTransaction.create({
      data: { description: `Pagamento Mesa - ${paymentMethod}`, amount: new Decimal(totalAmount), type: 'RECEITA', paidAt: new Date(), companyId }
    });
    io.emit('order_updated', { tableId });
    return response.json({ message: "Conta fechada!", total: totalAmount });
  } catch (error) { return response.status(500).json({ error: "Erro ao fechar conta" }); }
});

type OrderItemInput = { productId: string; quantity: number; }
app.post('/orders', authMiddleware, async (request: Request, response: Response) => {
  const { userId, companyId } = request.user;
  const { items, tableId } = request.body as { items: OrderItemInput[], tableId?: string };
  const productIds = items.map(item => item.productId);
  const productsInDb = await prisma.product.findMany({ where: { id: { in: productIds }, companyId }, include: { recipeItems: true } });
  if (productsInDb.length !== items.length) return response.status(400).json({ message: "Produtos inválidos." });

  const stockUpdates: any[] = [];
  for (const item of items) {
    const product = productsInDb.find(p => p.id === item.productId);
    if (!product) continue;
    if (product.recipeItems.length > 0) {
      for (const recipeItem of product.recipeItems) {
        stockUpdates.push(prisma.ingredient.update({ where: { id: recipeItem.ingredientId }, data: { stockQuantity: { decrement: new Decimal(recipeItem.quantity).mul(item.quantity) } } }));
      }
    } else {
      const ingredientAsProduct = await prisma.ingredient.findFirst({ where: { name: product.name, companyId }});
      if(ingredientAsProduct) stockUpdates.push(prisma.ingredient.update({ where: { id: ingredientAsProduct.id }, data: { stockQuantity: { decrement: item.quantity } } }));
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
          total, tableId, userId, companyId,
          status: 'PENDING',
          items: { create: items.map(item => ({ productId: item.productId, quantity: item.quantity })) }
        },
        include: { items: { include: { product: true } }, table: true }
      }),
      ...stockUpdates
    ]);
    io.emit('new_order', createdOrder);
    return response.status(201).json(createdOrder);
  } catch (error) { return response.status(500).json({ message: "Erro ao processar pedido." }); }
});

// ✨ ROTA KDS MARCAR COMO PRONTO (ATUALIZADA E CORRIGIDA) ✨
app.patch('/orders/:id/ready', authMiddleware, async (request, response) => {
  const { id } = request.params;
  const { companyId } = request.user;
  
  try {
    // 1. Busca o pedido atual para checar o status
    const currentOrder = await prisma.order.findFirst({
      where: { id, companyId }
    });

    if (!currentOrder) {
      return response.status(404).json({ message: "Pedido não encontrado." });
    }

    // ✨ PROTEÇÃO: Se já estiver PAGO (PAID), não faz nada ✨
    if (currentOrder.status === 'PAID') {
      return response.status(400).json({ message: "Este pedido já foi pago e não pode ser alterado." });
    }

    // 2. Se não estiver pago, atualiza para READY
    const order = await prisma.order.update({ 
      where: { id }, 
      data: { status: 'READY' } 
    });
    
    io.emit('order_updated', order);
    return response.json(order);
  } catch (error) { return response.status(500).json({ error: "Erro ao atualizar pedido" }); }
});

// ==================================================================
// ROTAS DO FINANCEIRO E DASHBOARD
// ==================================================================
app.get('/financial/transactions', authMiddleware, checkRole(['DONO']), async (request, response) => {
  const transactions = await prisma.financialTransaction.findMany({ where: { companyId: request.user.companyId }, orderBy: { createdAt: 'desc' } });
  return response.status(200).json(transactions);
});

app.post('/financial/transactions', authMiddleware, checkRole(['DONO']), async (request, response) => {
  const { description, amount, type, dueDate } = request.body;
  try {
    const transaction = await prisma.financialTransaction.create({
      data: { description, amount: new Decimal(amount), type, dueDate: dueDate ? new Date(dueDate) : null, companyId: request.user.companyId }
    });
    return response.status(201).json(transaction);
  } catch (error) { return response.status(500).json({ message: "Erro ao criar transação." }); }
});

app.get('/dashboard/today', authMiddleware, checkRole(['DONO']), async (request, response) => {
    const companyId = request.user.companyId;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const salesData = await prisma.order.aggregate({ where: { createdAt: { gte: today }, companyId }, _sum: { total: true }, _count: { id: true } });
    const topProductsRaw = await prisma.orderItem.groupBy({ by: ['productId'], where: { order: { createdAt: { gte: today }, companyId } }, _sum: { quantity: true }, orderBy: { _sum: { quantity: 'desc' } }, take: 5 });
    const topProductIds = topProductsRaw.map(p => p.productId);
    const productDetails = await prisma.product.findMany({ where: { id: { in: topProductIds }, companyId } });
    const topProducts = topProductsRaw.map(p => {
        const product = productDetails.find(pd => pd.id === p.productId);
        return { productId: p.productId, name: product?.name || 'Produto não encontrado', quantitySold: p._sum?.quantity || 0 }
    });
    const dashboardData = { totalRevenue: salesData._sum?.total || 0, orderCount: salesData._count?.id || 0, topProducts };
    return response.status(200).json(dashboardData);
});

server.listen(port, () => {
  console.log(`🚀 Servidor rodando na porta ${port}`);
});