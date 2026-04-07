module.exports = {
  apps: [
    {
      name: 'gym-api',
      script: './src/server.ts', // On utilise ts-node pour le dev ou on pointe vers dist/server.js pour la prod
      interpreter: 'node',
      interpreter_args: '-r ts-node/register', // Permet de lancer du TS directement
      instances: 1, // 'max' pour utiliser tous les cœurs CPU en production
      autorestart: true,
      watch: false, // On désactive watch en prod (nodemon s'en occupe en dev)
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'development',
      },
      env_production: {
        NODE_ENV: 'production',
      },
      // Centralisation des logs Winston dans PM2
      error_file: './logs/pm2-error.log',
      out_file: './logs/pm2-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
    },
  ],
};
