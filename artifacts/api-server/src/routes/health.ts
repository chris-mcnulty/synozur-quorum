import { Router, type IRouter } from "express";
import { apiOps } from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/healthz", (_req, res) => {
  const data = apiOps.HealthCheckResponse.parse({ status: "ok" });
  res.json(data);
});

export default router;
