import { expo } from '@better-auth/expo';
import { betterAuth } from 'better-auth';
import { Pool } from 'pg';

import type { ServerConfig } from '../config.js';
import { sendAuthEmail } from '../mail.js';

export type HanziQuestAuth = {
  api: {
    getSession(input: { headers: Headers }): Promise<{ user: { id: string } } | null>;
  };
  handler(request: Request): Promise<Response>;
};

export function createAuth(config: ServerConfig): HanziQuestAuth {
  return betterAuth({
    advanced: { database: { generateId: 'uuid' } },
    baseURL: config.authUrl,
    database: new Pool({ connectionString: config.databaseUrl, max: 5 }),
    emailAndPassword: {
      enabled: true,
      minPasswordLength: 8,
      requireEmailVerification: config.emailVerificationRequired,
      revokeSessionsOnPasswordReset: true,
      sendResetPassword: async ({ url, user }) =>
        sendAuthEmail(config, {
          subject: '重设 HanziQuest 密码',
          text: `请使用以下安全链接重设密码：${url}`,
          to: user.email,
        }),
    },
    emailVerification: config.emailVerificationRequired
      ? {
          sendOnSignUp: true,
          sendVerificationEmail: async ({ url, user }) =>
            sendAuthEmail(config, {
              subject: '确认 HanziQuest 邮箱',
              text: `请使用以下安全链接确认邮箱：${url}`,
              to: user.email,
            }),
        }
      : undefined,
    plugins: [expo()],
    secret: config.authSecret,
    trustedOrigins: [...config.appOrigins],
  }) as unknown as HanziQuestAuth;
}
