import { apiRequest } from '../../lib/api/client';

import type { ReviewCenterRequester } from './model';

export const reviewCenterRequester: ReviewCenterRequester = (path, init) =>
  apiRequest<unknown>(path, init);
