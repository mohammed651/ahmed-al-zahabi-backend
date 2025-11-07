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

const app = express();
app.use(helmet());
app.use(express.json({ limit: "5mb" }));
app.use(cookieParser());
app.use(mongoSanitize());
app.use(xss());

// CORS - adjust origins as needed
const corsOptions = {
  origin: (origin, callback) => {
    // allow requests with no origin (like mobile apps or curl)
    callback(null, true);
  },
  credentials: true
};
app.use(cors(corsOptions));

// rate limiter
const limiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 100, // limit each IP to 100 requests per windowMs
  standardHeaders: true,
  legacyHeaders: false
});
app.use(limiter);

app.use(morgan("dev"));

app.get("/health", (req, res) => res.json({ success: true, message: "API شغال" }));

app.use("/api/auth", authRoutes);
app.use("/api/users", usersRoutes);
app.use("/api/products", productsRoutes);
app.use("/api/stock", stockRoutes);
app.use("/api/sales", salesRoutes);
app.use("/api/cash", cashRoutes);

app.use(errorHandler);

export default app;
