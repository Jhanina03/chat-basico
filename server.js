import { createChatServer } from './src/app.js';

const port = Number.parseInt(process.env.PORT ?? '3000', 10);
const { httpServer } = createChatServer();

httpServer.listen(port, () => {
  console.log(`Chat disponible en http://localhost:${port}`);
});
