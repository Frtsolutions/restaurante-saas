import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { authMiddleware, checkRole } from '../middlewares/auth';

const router = Router();

router.get('/today', authMiddleware, checkRole(['DONO']), async (req: Request, res: Response) => {
    const companyId = req.user.companyId;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const salesData = await prisma.order.aggregate({
        where: { createdAt: { gte: today }, companyId },
        _sum: { total: true },
        _count: { id: true }
    });

    const topProductsRaw = await prisma.orderItem.groupBy({
        by: ['productId'],
        where: { order: { createdAt: { gte: today }, companyId } },
        _sum: { quantity: true },
        orderBy: { _sum: { quantity: 'desc' } },
        take: 5
    });

    const topProductIds = topProductsRaw.map(p => p.productId);
    const productDetails = await prisma.product.findMany({ 
      where: { id: { in: topProductIds }, companyId } 
    });

    const topProducts = topProductsRaw.map(p => {
        const product = productDetails.find(pd => pd.id === p.productId);
        return {
            productId: p.productId,
            name: product?.name || 'Produto não encontrado',
            quantitySold: p._sum?.quantity || 0
        }
    });

    const dashboardData = {
        totalRevenue: salesData._sum?.total || 0,
        orderCount: salesData._count?.id || 0,
        topProducts: topProducts
    };
    
    return res.status(200).json(dashboardData);
});

export default router;