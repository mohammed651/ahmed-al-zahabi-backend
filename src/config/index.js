import dotenv from "dotenv";
import path from "path";
dotenv.config({ path: path.resolve(process.cwd(), ".env") });

export default {
  port: process.env.PORT || 5000,
  mongoUri: process.env.MONGO_URI || "mongodb://127.0.0.1:27017/ahmed_al_zahabi",
  jwtSecret: process.env.JWT_SECRET || "secret",
  jwtRefreshSecret: process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET,
  env: process.env.NODE_ENV || "development",
  adminUser: process.env.ADMIN_USERNAME || "admin",
  adminPass: process.env.ADMIN_PASSWORD || "admin123",
  backupDir: process.env.BACKUP_DIR || "./backups",
  retentionDays: Number(process.env.RETENTION_DAYS || 14)
};
