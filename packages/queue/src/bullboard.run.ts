import { createBoardApp } from "./bullboard.js";

const PORT = 4000;
const app = createBoardApp();
app.listen(PORT, () => {
  console.log(`BullBoard: http://localhost:${PORT}/admin/queues`);
});
