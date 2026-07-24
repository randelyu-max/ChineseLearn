import { apiRequest } from '../../lib/api/client';
import { createFormalSessionApi } from './api';

export const formalSessionApi = createFormalSessionApi((path, init) =>
  apiRequest<unknown>(path, init),
);
