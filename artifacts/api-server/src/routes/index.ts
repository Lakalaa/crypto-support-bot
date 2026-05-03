import { Router, type IRouter } from "express";
import healthRouter from "./health";
import { processWebhookUpdate } from "../bot";
import { logger } from "../lib/logger";

const router: IRouter = Router();

router.use(healthRouter);

// Telegram webhook endpoint — receives updates pushed by Telegram
router.post("/webhook", (req, res) => {
  const update = req.body;
  if (!update || typeof update !== "object") {
    logger.warn("Received invalid webhook payload");
    res.sendStatus(400);
    return;
  }
  // Respond immediately to Telegram (must be fast)
  res.sendStatus(200);
  // Process update asynchronously
  processWebhookUpdate(update);
});

export default router;
