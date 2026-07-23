export type ServerConfig = Readonly<{
  appOrigins: readonly string[];
  authSecret: string;
  authUrl: string;
  databaseUrl: string;
  emailVerificationRequired: boolean;
  host: string;
  port: number;
  smtp: Readonly<{
    from: string;
    host: string;
    password: string;
    port: number;
    secure: boolean;
    user: string;
  }> | null;
}>;

function required(environment: NodeJS.ProcessEnv, name: string): string {
  const value = environment[name]?.trim();
  if (!value) throw new Error(`${name} is required.`);
  return value;
}

function port(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 && parsed <= 65_535 ? parsed : fallback;
}

function emailVerificationRequired(environment: NodeJS.ProcessEnv): boolean {
  const configured = environment.AUTH_REQUIRE_EMAIL_VERIFICATION?.trim().toLowerCase();
  if (configured && configured !== 'true' && configured !== 'false') {
    throw new Error('AUTH_REQUIRE_EMAIL_VERIFICATION must be true or false.');
  }
  if (configured === 'false' && environment.NODE_ENV === 'production') {
    throw new Error('Email verification cannot be disabled in production.');
  }
  return configured !== 'false';
}

export function loadServerConfig(environment: NodeJS.ProcessEnv): ServerConfig {
  const authSecret = required(environment, 'BETTER_AUTH_SECRET');
  if (authSecret.length < 32) throw new Error('BETTER_AUTH_SECRET must be at least 32 characters.');
  const appOrigins = required(environment, 'APP_ORIGINS')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
  if (appOrigins.length === 0) throw new Error('APP_ORIGINS must include at least one origin.');

  const smtpHost = environment.SMTP_HOST?.trim() ?? '';
  const smtpUser = environment.SMTP_USER?.trim() ?? '';
  const smtpPassword = environment.SMTP_PASSWORD?.trim() ?? '';
  const smtpFrom = environment.SMTP_FROM?.trim() ?? '';
  const smtpValues = [smtpHost, smtpUser, smtpPassword, smtpFrom];
  if (smtpValues.some(Boolean) && !smtpValues.every(Boolean)) {
    throw new Error(
      'SMTP_HOST, SMTP_USER, SMTP_PASSWORD, and SMTP_FROM must be configured together.',
    );
  }
  const verificationRequired = emailVerificationRequired(environment);
  if (environment.NODE_ENV === 'production' && verificationRequired && !smtpValues.every(Boolean)) {
    throw new Error('SMTP must be configured when email verification is required in production.');
  }

  return Object.freeze({
    appOrigins: Object.freeze(appOrigins),
    authSecret,
    authUrl: required(environment, 'BETTER_AUTH_URL'),
    databaseUrl: required(environment, 'DATABASE_URL'),
    emailVerificationRequired: verificationRequired,
    host: environment.HOST?.trim() || '0.0.0.0',
    port: port(environment.PORT, 3001),
    smtp: smtpValues.every(Boolean)
      ? Object.freeze({
          from: smtpFrom,
          host: smtpHost,
          password: smtpPassword,
          port: port(environment.SMTP_PORT, 587),
          secure: environment.SMTP_SECURE === 'true',
          user: smtpUser,
        })
      : null,
  });
}
