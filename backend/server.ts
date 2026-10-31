import 'dotenv/config';
import path from 'path';
import express from 'express';
import swaggerUi from 'swagger-ui-express';
import { createServer as createViteServer } from 'vite';
import routes from './routes/index.ts';
import { openApiSpec } from './swagger.ts';
import { runRecurringBilling } from './models/database.ts';

if (process.env.NODE_ENV === 'production' && !process.env.JWT_SECRET) {
  throw new Error('JWT_SECRET must be configured before starting in production.');
}

const app = express();
const port = process.env.PORT ? Number.parseInt(process.env.PORT, 10) : 3000;
const frontendDirectory = path.resolve(process.cwd(), 'frontend');
const frontendBuildDirectory = path.join(frontendDirectory, 'dist');

app.use(express.json());
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(openApiSpec));
app.get('/api-docs.json', (_req, res) => res.json(openApiSpec));
app.use(routes);

async function startServer(): Promise<void> {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      configFile: path.join(frontendDirectory, 'vite.config.ts'),
      root: frontendDirectory,
      server: { middlewareMode: true },
      appType: 'spa'
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(frontendBuildDirectory));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(frontendBuildDirectory, 'index.html'));
    });
  }

  app.listen(port, '0.0.0.0', () => {
    console.log(`Brightloop server listening on http://0.0.0.0:${port}`);
    runRecurringBilling();
  });

  setInterval(() => {
    try {
      runRecurringBilling();
    } catch (error) {
      console.error('Error running automated recurring billing cycle:', error);
    }
  }, 60000);
}

startServer().catch(error => {
  console.error('Failed to start Brightloop server:', error);
  process.exitCode = 1;
});
