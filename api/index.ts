import express from 'express';
const app = express();
app.use(express.json());

// Dynamic import handler to catch startup and module loading errors
app.use(async (req, res, next) => {
  try {
    const { default: apiRouter } = await import('../src/lib/api-routes');
    apiRouter(req, res, next);
  } catch (error) {
    console.error("Vercel Serverless Function Startup Crash:", error);
    res.status(500).json({
      error: "FUNCTION_INVOCATION_FAILED_PREVENTED",
      message: (error as Error).message,
      stack: (error as Error).stack
    });
  }
});

export default app;
