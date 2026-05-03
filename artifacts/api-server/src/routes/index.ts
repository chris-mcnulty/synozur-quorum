import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import storageRouter from "./storage";
import tenantsRouter from "./tenants";
import boardsRouter from "./boards";
import membersRouter from "./members";
import groundingRouter from "./grounding";
import sessionsRouter from "./sessions";
import dashboardRouter from "./dashboard";
import connectionsRouter from "./connections";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(storageRouter);
router.use(tenantsRouter);
router.use(dashboardRouter);
router.use(boardsRouter);
router.use(membersRouter);
router.use(groundingRouter);
router.use(sessionsRouter);
router.use(connectionsRouter);

export default router;
