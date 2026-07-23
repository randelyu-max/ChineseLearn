import { API_VERSION, RequestIdSchema } from '@hanziquest/contracts';

export const contractsCompatibility = {
  apiVersion: API_VERSION,
  acceptsRequestIds: RequestIdSchema.safeParse('req_mobile_0001').success,
} as const;
