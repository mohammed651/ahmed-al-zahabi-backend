import app from "./app.js";
import { connectDB } from "./config/db.js";
import config from "./config/index.js";

await connectDB(config.mongoUri);

const PORT = config.port || 5000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
