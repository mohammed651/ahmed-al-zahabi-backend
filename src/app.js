import express from "express";
import cors from "cors";
import morgan from "morgan";
import "express-async-errors";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import rateLimit from "express-rate-limit";
import mongoSanitize from "express-mongo-sanitize";
import xss from "xss-clean";
import authRoutes from "./api/routes/auth.routes.js";
import usersRoutes from "./api/routes/users.routes.js";
import productsRoutes from "./api/routes/products.routes.js";
import stockRoutes from "./api/routes/stock.routes.js";
import salesRoutes from "./api/routes/sales.routes.js";
import cashRoutes from "./api/routes/cash.routes.js";
import errorHandler from "./middlewares/error.middleware.js";
import scrapRoutes from "./api/routes/scrap.routes.js";
import purchasesRoutes from "./api/routes/purchases.routes.js";
import suppliersRoutes from "./api/routes/suppliers.routes.js";
import electronicRoutes from "./api/routes/electronic.routes.js"; // ⭐ جديد
import returnsRoutes from './api/routes/returns.routes.js';
import inventoryCountRoutes from './api/routes/inventoryCount.routes.js';
import advancedReportsRoutes from './api/routes/advancedReports.routes.js';
import settingsRoutes from './api/routes/settings.routes.js';
import branchRoutes from './api/routes/branch.routes.js';
const app = express();
app.use(helmet());
app.use(express.json({ limit: "5mb" }));
app.use(cookieParser());
app.use(mongoSanitize());
app.use(xss());

// CORS - adjust origins as needed
const corsOptions = {
  origin: (origin, callback) => {
    callback(null, true);
  },
  credentials: true
};
app.use(cors(corsOptions));

// rate limiter
const limiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false
});
app.use(limiter);

app.use(morgan("dev"));

app.use(cors({
  origin: true,
  credentials: true
}));

app.get("/health", (req, res) => res.json({ success: true, message: "API شغال" }));

app.use("/api/auth", authRoutes);
app.use("/api/users", usersRoutes);
app.use("/api/products", productsRoutes);
app.use("/api/stock", stockRoutes);
app.use("/api/sales", salesRoutes);
app.use("/api/cash", cashRoutes);
app.use("/api/scrap", scrapRoutes);
app.use("/api/purchases", purchasesRoutes);
app.use("/api/suppliers", suppliersRoutes);
app.use("/api/electronic", electronicRoutes); // ⭐ جديد
app.use('/api/returns', returnsRoutes);
app.use('/api/inventory-count', inventoryCountRoutes);
app.use('/api/reports', advancedReportsRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/branches', branchRoutes);

app.use(errorHandler);

export default app;