import express from 'express';
import { apiRouter } from '../controllers/apiController.ts';

const routes = express.Router();

routes.use(apiRouter);

export default routes;
