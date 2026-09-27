import type { Request, Response, NextFunction } from "express";
import { selectTable } from "../services/supabaseService";

export const aboutPage = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try{
        const creators = await selectTable('creator', { order1: 'id_creator', order1State: true });
        res.render('about', { creators });
        return;
    }catch(error){
        next(error);
        return
    }
}