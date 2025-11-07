import express from "express";
import cors from "cors";
import morgan from "morgan";
import "express-async-errors";
import authRoutes from "./api/routes/auth.routes.js";
import usersRoutes from "./api/routes/users.routes.js";
import productsRoutes from "./api/routes/products.routes.js";
import stockRoutes from "./api/routes/stock.routes.js";
import salesRoutes from "./api/routes/sales.routes.js";
import cashRoutes from "./api/routes/cash.routes.js";
import errorHandler from "./middlewares/error.middleware.js";

const app = express();
app.use(express.json({ limit: "5mb" }));
app.use(cors());
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
