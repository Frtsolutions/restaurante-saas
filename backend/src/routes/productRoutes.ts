import { Router, Request, Response } from 'express';
import { Decimal } from '@prisma/client/runtime/library';
import { createClient } from '@supabase/supabase-js';
import multer from 'multer';
import path from 'path';
import { prisma } from '../lib/prisma';
import { authMiddleware, checkRole } from '../middlewares/auth';

const router = Router();

// --- CONFIGURAÇÃO DO SUPABASE STORAGE E MULTER ---
const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY!;
// Cria o cliente apenas se as chaves existirem (evita erro em dev se não configurado)
const supabase = (supabaseUrl && supabaseKey) ? createClient(supabaseUrl, supabaseKey) : null;

const upload = multer({
  storage: multer.memoryStorage(),
});

// Rota: Listar Produtos
router.get('/', authMiddleware, async (req: Request, res: Response) => {
  const products = await prisma.product.findMany({
    where: { companyId: req.user.companyId },
    orderBy: { name: 'asc' }
  });
  return res.status(200).json(products);
});

// Rota: Criar Produto
router.post('/', authMiddleware, checkRole(['DONO']), async (req: Request, res: Response) => {
  const { name, price, recipeItems } = req.body;
  try {
    const product = await prisma.product.create({
      data: {
        name,
        price: new Decimal(price),
        companyId: req.user.companyId,
        recipeItems: recipeItems && recipeItems.length > 0 ? {
          create: recipeItems.map((item: any) => ({
            ingredientId: item.ingredientId,
            quantity: new Decimal(item.quantity)
          }))
        } : undefined
      }
    });
    return res.status(201).json(product);
  } catch (error) {
    return res.status(409).json({ message: "Produto já existe." });
  }
});

// Rota: Upload de Imagem
router.post('/:id/upload', authMiddleware, checkRole(['DONO']), upload.single('image'), async (req: Request, res: Response) => {
  const { id: productId } = req.params;
  
  if (!req.file) {
    return res.status(400).json({ message: "Nenhum arquivo enviado." });
  }

  if (!supabase) {
    return res.status(500).json({ message: "Supabase não configurado no servidor." });
  }

  const fileExtension = path.extname(req.file.originalname);
  // Nome do arquivo: ID_EMPRESA/ID_PRODUTO_TIMESTAMP.ext
  const fileName = `${req.user.companyId}/${productId}_${Date.now()}${fileExtension}`;

  try {
    const { error: uploadError } = await supabase.storage
      .from('product-images')
      .upload(fileName, req.file.buffer, {
        contentType: req.file.mimetype,
        upsert: true
      });

    if (uploadError) throw uploadError;

    const { data: { publicUrl } } = supabase.storage
      .from('product-images')
      .getPublicUrl(fileName);

    const updatedProduct = await prisma.product.update({
      where: { 
        id: productId, 
        companyId: req.user.companyId 
      },
      data: { imageUrl: publicUrl }
    });

    return res.status(200).json(updatedProduct);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Falha no upload." });
  }
});

export default router;