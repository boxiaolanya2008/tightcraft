/**
 * index.ts —— 烛龙·章尾 服务器入口：启动网关并监听端口。
 */

import { createApp } from "./gateway/app";

const PORT = Number(process.env.PORT) || 8735;
const HOST = process.env.HOST ?? "127.0.0.1";

const app = createApp();

const server = app.listen(PORT, HOST, () => {
  // eslint-disable-next-line no-console
  console.log(`[zhulong] 烛龙·章尾 服务器已启动 → http://${HOST}:${PORT}`);
  // eslint-disable-next-line no-console
  console.log(`[zhulong] 健康检查: curl http://${HOST}:${PORT}/api/health`);
});

process.on("SIGINT", () => server.close(() => process.exit(0)));
process.on("SIGTERM", () => server.close(() => process.exit(0)));