# Ahmed Al-Zahabi Backend

شرح سريع لتشغيل المشروع محليًا.

## المتطلبات
- Node 18+
- npm
- (اختياري) Docker & Docker Compose

## تشغيل محلي بدون دوكر
1. انسخ `.env.example` إلى `.env` وعبئ القيم.
2. npm install
3. npm run seed   # لإنشاء مستخدم الأدمن الافتراضي
4. npm run dev

## تشغيل عبر Docker Compose
1. انسخ `.env.example` إلى `.env` وغيّر القيم إذا رغبت.
2. docker-compose up --build
3. API ستعمل على http://localhost:5000
4. mongo-express على http://localhost:8081

## endpoints أساسية
- POST /api/auth/register
- POST /api/auth/login
- GET /api/products
- POST /api/products
- POST /api/sales
- POST /api/stock/move
