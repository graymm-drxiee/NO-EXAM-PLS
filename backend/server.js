const { createApp } = require("./app");
const connectDB = require("./config/db");

async function startServer() {
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
    throw new Error("JWT_SECRET must be set to a random value of at least 32 characters.");
  }

  await connectDB();
  const port = Number(process.env.PORT) || 3000;
  return createApp().listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
  });
}

if (require.main === module) {
  startServer().catch((err) => {
    console.error("Startup failed:", err.message);
    process.exitCode = 1;
  });
}

module.exports = { startServer };
