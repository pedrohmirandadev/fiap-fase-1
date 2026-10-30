import { createProductionApp } from './presentation/production-app';

const port = Number(process.env.PORT ?? 3000);
const hostname = process.env.HOST ?? '127.0.0.1';
const app = createProductionApp();
app.listen({ port, hostname });
console.log(`Oficina API disponível em http://localhost:${port}/openapi`);
