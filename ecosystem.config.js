module.exports = {
  /**
   * Application configuration section
   * http://pm2.keymetrics.io/docs/usage/application-declaration/
   */
  apps: [

    // First application
    {
      name: 'sovoro_channel',
      script: 'npm run serve',
      env_dev: {
        NODE_ENV: 'development',
      },
      env_staging: {
        NODE_ENV: 'staging',
      },
      env_production: {
        NODE_ENV: 'production',
      },
    },
  ],

  /**
   * Deployment section
   * http://pm2.keymetrics.io/docs/usage/deployment/
   */
  deploy: {
    production: {
      user: 'ubuntu',
      host: 'ec2-54-180-10-101.ap-northeast-2.compute.amazonaws.com',
      key: 'private/aws_sovoro.pem',
      ref: 'origin/master',
      repo: 'git@bitbucket.org:sovoro/sovoro_channel.git',
      path: '/home/ubuntu/sovoro/sovoro_channel',
      'post-deploy': 'rm -f .env && ln -s /home/ubuntu/sovoro/env/sovoro_channel/.env .env && npm install && npm run build && pm2 startOrReload ecosystem.config.js --env production',
    },
    staging: {
      user: 'ubuntu',
      host: 'ec2-13-124-110-22.ap-northeast-2.compute.amazonaws.com',
      key: 'private/aws_sovoro.pem',
      ref: 'origin/release/1.0.5',
      repo: 'git@bitbucket.org:sovoro/sovoro_channel.git',
      path: '/home/ubuntu/sovoro/sovoro_channel',
      'post-deploy': 'rm -f .env && ln -s /home/ubuntu/sovoro/env/sovoro_channel/.env .env && npm install && npm run build && pm2 startOrReload ecosystem.config.js --env staging',
    },
    dev: {
      user: 'ubuntu',
      host: 'ec2-13-124-113-50.ap-northeast-2.compute.amazonaws.com',
      key: 'private/aws_sovoro.pem',
      ref: 'origin/develop',
      repo: 'git@bitbucket.org:sovoro/sovoro_channel.git',
      path: '/home/ubuntu/sovoro/sovoro_channel',
      'post-deploy': 'rm -f .env && ln -s /home/ubuntu/sovoro/env/sovoro_channel/.env .env && npm install && npm run build && pm2 startOrReload ecosystem.config.js --env dev',
    },
  },
};
