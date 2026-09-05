import api from './api';

export const recApi = {
  createRun: (payload) => api.post('/reconciliation/runs', payload),
  listRuns: (params = {}) => api.get('/reconciliation/runs', { params }),
  getRun: (runId) => api.get(`/reconciliation/runs/${runId}`),
  previewFile: (runId, fileType, file) => {
    const form = new FormData();
    form.append('file', file);
    form.append('fileType', fileType);
    return api.post(`/reconciliation/runs/${runId}/preview?fileType=${fileType}`, form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
  uploadFile: (runId, fileType, file, mapping) => {
    const form = new FormData();
    form.append('file', file);
    form.append('fileType', fileType);
    if (mapping) form.append('mapping', JSON.stringify(mapping));
    return api.post(`/reconciliation/runs/${runId}/upload?fileType=${fileType}`, form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
  executeRun: (runId) => api.post(`/reconciliation/runs/${runId}/run`),
  getResults: (runId, params = {}) => api.get(`/reconciliation/runs/${runId}/results`, { params }),
  getAnalytics: (runId) => api.get(`/reconciliation/runs/${runId}/analytics`),
  getExceptions: (runId, params = {}) => api.get(`/reconciliation/runs/${runId}/exceptions`, { params }),
  archiveRun: (runId, archive = true) =>
    api.post(`/reconciliation/runs/${runId}/archive`, { archive }),
  analyzeException: (runId, exceptionId) =>
    api.post(`/reconciliation/runs/${runId}/exceptions/${encodeURIComponent(exceptionId)}/analyze`),
  getException: (runId, exceptionId) =>
    api.get(`/reconciliation/runs/${runId}/exceptions/${encodeURIComponent(exceptionId)}`),
  resolutionAction: (runId, exceptionId, payload) =>
    api.post(`/reconciliation/runs/${runId}/exceptions/${encodeURIComponent(exceptionId)}/action`, payload),
  getExceptionHistory: (runId, exceptionId) =>
    api.get(`/reconciliation/runs/${runId}/exceptions/${encodeURIComponent(exceptionId)}/history`),
};
