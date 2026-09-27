import express from 'express';
import path from 'path';
import cookieParser from 'cookie-parser';
import Config from './config/index.js';

import landingRoute from './src/routes/landingRoute';
import blogRoute from './src/routes/blogRoute';
import aboutRoute from './src/routes/aboutRoute';
import productRoute from './src/routes/productRoute';
import cartRoute from './src/routes/cartRoute';
import paymentRoute from './src/routes/paymentRoute';
import shippingRoute from './src/routes/shippingRoute.js';

const app = express();
const PORT = process.env.PORT || 3000;

app.set('trust proxy', 1);
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(cookieParser());

// Middleware: hitung jumlah item cart + kirim config ke view
app.use((req, res, next) => {
  const raw = req.cookies?.cart;
  let count = 0;

  if (raw) {
    try {
      const items = JSON.parse(raw);
      if (Array.isArray(items)) {
        count = items.reduce(
          (s: number, i: any) => s + (Number(i.quantity) || 0),
          0
        );
      }
    } catch {
      // ignore
    }
  }

  res.locals.cartCount = count;
  res.locals.midtransClientKey = Config.MIDTRANS_CLIENT_KEY;
  res.locals.midtransIsProduction = Config.MIDTRANS_IS_PRODUCTION;
  next();
});

app.use('/', landingRoute);
app.use('/blog', blogRoute);
app.use('/about', aboutRoute);
app.use('/products', productRoute);
app.use('/cart', cartRoute);
app.use('/api/payments', paymentRoute);
app.use('/api/shipping', shippingRoute);

app.listen(PORT, () => {
  console.log(`Server berjalan di http://localhost:${PORT}`);
});

export default app;