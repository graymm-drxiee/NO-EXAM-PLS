const app = require("./app");

function startServer() {
  const port = Number(process.env.PORT) || 3000;
  return app.init().then(() => app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
  }));
}

if (require.main === module) {
  startServer().catch((err) => {
    console.error("Startup failed:", err.message);
    process.exitCode = 1;
  });
}

module.exports = { startServer };
