// src/api/routes/settings.routes.js
import express from "express";
import {
  getSettings,
  updateSettings,
  initializeDefaultSettings
} from "../controllers/settings.controller.js";
import { authMiddleware } from "../../middlewares/auth.middleware.js";
import { permit } from "../../middlewares/permit.middleware.js";

const router = express.Router();

router.get("/", 
  authMiddleware, 
  getSettings
);

router.put("/", 
  authMiddleware, 
  permit("admin"), 
  updateSettings
);

router.post("/initialize", 
  authMiddleware, 
  permit("admin"), 
  initializeDefaultSettings
);

export default router;