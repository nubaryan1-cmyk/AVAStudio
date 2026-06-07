import { getDashboardData, type DashboardData } from "../data/mock.js";
import { publicProcedure, router } from "../trpc.js";

export const dashboardRouter = router({
  summary: publicProcedure.query((): DashboardData => getDashboardData()),
});
