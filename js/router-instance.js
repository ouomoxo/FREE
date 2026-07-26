/**
 * MAESTRO — The application's single Router instance.
 * Kept in its own module so every feature can import it without a cycle
 * through `app.js`.
 * @module router-instance
 */

import { Router } from './core/router.js';

export const router = new Router();
