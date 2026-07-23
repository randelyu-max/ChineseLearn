import { Hono } from 'hono';
import type { Pool } from 'pg';

import type { HanziQuestAuth } from '../auth/auth.js';
import { oneOrNull, withUserTransaction } from '../db/pool.js';

type ProfileRow = {
  chinese_name: string | null;
  daily_goal_minutes: number;
  display_name: string | null;
  humor_preference: 'off' | 'light' | 'playful';
  id: string;
  interface_locale: string;
  pinyin_support_mode: 'always' | 'adaptive' | 'tap_to_reveal' | 'hidden';
  script_preference: string;
};

type ProfileInput = {
  chineseName: string | null;
  dailyGoalMinutes: number;
  displayName: string;
  humorPreference: 'off' | 'light' | 'playful';
  interfaceLocale: 'en-US' | 'zh-CN' | 'zh-TW';
  pinyinSupportMode: 'always' | 'adaptive' | 'hidden' | 'tap_to_reveal';
  scriptPreference: 'simplified' | 'traditional';
};

type RouteEnvironment = {
  Variables: {
    userId: string;
  };
};

const columns =
  'id, display_name, chinese_name, interface_locale, script_preference, pinyin_support_mode, humor_preference, daily_goal_minutes';

function profileResponse(row: ProfileRow) {
  return {
    chineseName: row.chinese_name,
    dailyGoalMinutes: row.daily_goal_minutes,
    displayName: row.display_name,
    humorPreference: row.humor_preference,
    id: row.id,
    interfaceLocale: row.interface_locale,
    pinyinSupportMode: row.pinyin_support_mode,
    scriptPreference: row.script_preference,
  };
}

export function readProfileInput(value: unknown): ProfileInput | null {
  if (typeof value !== 'object' || value === null) return null;
  const input = value as Record<string, unknown>;
  const allowedKeys = new Set([
    'chineseName',
    'dailyGoalMinutes',
    'displayName',
    'humorPreference',
    'interfaceLocale',
    'pinyinSupportMode',
    'scriptPreference',
  ]);
  if (Object.keys(input).some((key) => !allowedKeys.has(key))) return null;
  const displayName = typeof input.displayName === 'string' ? input.displayName.trim() : '';
  const chineseName =
    typeof input.chineseName === 'string' && input.chineseName.trim()
      ? input.chineseName.trim()
      : null;
  if (
    displayName.length < 1 ||
    displayName.length > 80 ||
    (chineseName !== null && chineseName.length > 24) ||
    !['zh-CN', 'zh-TW', 'en-US'].includes(String(input.interfaceLocale)) ||
    !['simplified', 'traditional'].includes(String(input.scriptPreference)) ||
    !['always', 'adaptive', 'tap_to_reveal', 'hidden'].includes(String(input.pinyinSupportMode)) ||
    !['off', 'light', 'playful'].includes(String(input.humorPreference)) ||
    !Number.isInteger(input.dailyGoalMinutes) ||
    Number(input.dailyGoalMinutes) < 3 ||
    Number(input.dailyGoalMinutes) > 60
  ) {
    return null;
  }
  return {
    chineseName,
    dailyGoalMinutes: Number(input.dailyGoalMinutes),
    displayName,
    humorPreference: input.humorPreference as ProfileInput['humorPreference'],
    interfaceLocale: input.interfaceLocale as ProfileInput['interfaceLocale'],
    pinyinSupportMode: input.pinyinSupportMode as ProfileInput['pinyinSupportMode'],
    scriptPreference: input.scriptPreference as ProfileInput['scriptPreference'],
  };
}

export function profileRoutes(auth: HanziQuestAuth, pool: Pool) {
  const routes = new Hono<RouteEnvironment>();
  routes.use('*', async (context, next) => {
    const session = await auth.api.getSession({ headers: context.req.raw.headers });
    if (!session) return context.json({ code: 'unauthenticated' }, 401);
    context.set('userId', session.user.id);
    await next();
  });

  routes.get('/', async (context) => {
    const userId = context.get('userId');
    const row = await withUserTransaction(pool, userId, (client) =>
      oneOrNull<ProfileRow>(client, `select ${columns} from profiles where id = $1`, [userId]),
    );
    return row ? context.json(profileResponse(row)) : context.body(null, 404);
  });

  routes.put('/', async (context) => {
    const userId = context.get('userId');
    const body = readProfileInput(await context.req.json().catch(() => null));
    if (!body) return context.json({ code: 'profile_invalid' }, 400);
    const row = await withUserTransaction(pool, userId, (client) =>
      oneOrNull<ProfileRow>(
        client,
        `insert into profiles (
          id, display_name, chinese_name, interface_locale, script_preference,
          pinyin_support_mode, humor_preference, daily_goal_minutes
        ) values ($1,$2,$3,$4,$5,$6,$7,$8)
        on conflict (id) do update set
          display_name = excluded.display_name,
          chinese_name = excluded.chinese_name,
          interface_locale = excluded.interface_locale,
          script_preference = excluded.script_preference,
          pinyin_support_mode = excluded.pinyin_support_mode,
          humor_preference = excluded.humor_preference,
          daily_goal_minutes = excluded.daily_goal_minutes
        returning ${columns}`,
        [
          userId,
          body.displayName,
          body.chineseName ?? null,
          body.interfaceLocale,
          body.scriptPreference,
          body.pinyinSupportMode,
          body.humorPreference,
          body.dailyGoalMinutes,
        ],
      ),
    );
    return row
      ? context.json(profileResponse(row))
      : context.json({ code: 'profile_invalid' }, 400);
  });
  return routes;
}
