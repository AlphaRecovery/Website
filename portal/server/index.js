import { config } from './config.js';
import app from './app.js';

app.listen(config.port, '0.0.0.0', () => {
  console.log(`Alpha portal API running on http://127.0.0.1:${config.port}`);
});
