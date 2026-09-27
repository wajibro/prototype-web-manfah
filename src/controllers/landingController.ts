import type { Request, Response, NextFunction } from "express";
import { selectTable } from "../services/supabaseService";

export const landingPage = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const postTerbaru = await selectTable('view_posts_terbaru', {limit: 3});
        const productTerbaru = await selectTable('view_products_terbaru');

        res.render('landing', {
            postTerbaru,
            productTerbaru
        });
        return;
    } catch (error) {
        next(error);
        return;
    }
}