/**
 * Action processors for different pipeline types
 */

export type ActionType = 'add_timestamp' | 'uppercase_keys' | 'filter_required_field';

export interface ProcessedPayload {
  original: unknown;
  processed: unknown;
  actionApplied: ActionType;
  processedAt: string;
}

/**
 * Add a timestamp field to the payload
 */
export function addTimestamp(payload: unknown): ProcessedPayload {
  const now = new Date().toISOString();
  const processed = {
    ...(typeof payload === 'object' && payload !== null ? payload : { data: payload }),
    timestamp: now,
  };

  return {
    original: payload,
    processed,
    actionApplied: 'add_timestamp',
    processedAt: now,
  };
}

/**
 * Convert all keys in the payload to uppercase
 */
export function uppercaseKeys(payload: unknown): ProcessedPayload {
  const now = new Date().toISOString();

  const processObject = (obj: any): any => {
    if (obj === null || typeof obj !== 'object') {
      return obj;
    }

    if (Array.isArray(obj)) {
      return obj.map(processObject);
    }

    return Object.keys(obj).reduce((acc: any, key: string) => {
      acc[key.toUpperCase()] = processObject(obj[key]);
      return acc;
    }, {});
  };

  const processed = processObject(payload);

  return {
    original: payload,
    processed,
    actionApplied: 'uppercase_keys',
    processedAt: now,
  };
}

/**
 * Filter to keep only required fields from the payload
 * Looks for a 'requiredFields' array in the payload, or uses default set
 */
export function filterRequiredField(payload: unknown): ProcessedPayload {
  const now = new Date().toISOString();

  if (typeof payload !== 'object' || payload === null) {
    return {
      original: payload,
      processed: payload,
      actionApplied: 'filter_required_field',
      processedAt: now,
    };
  }

  const payloadObj = payload as any;
  const requiredFields = payloadObj.requiredFields || ['id', 'name', 'email', 'status'];

  const processed = requiredFields.reduce((acc: any, field: string) => {
    if (field in payloadObj) {
      acc[field] = payloadObj[field];
    }
    return acc;
  }, {});

  return {
    original: payload,
    processed,
    actionApplied: 'filter_required_field',
    processedAt: now,
  };
}

/**
 * Route to appropriate action processor
 */
export function processPayload(
  payload: unknown,
  actionType: ActionType
): ProcessedPayload {
  switch (actionType) {
    case 'add_timestamp':
      return addTimestamp(payload);
    case 'uppercase_keys':
      return uppercaseKeys(payload);
    case 'filter_required_field':
      return filterRequiredField(payload);
    default:
      throw new Error(`Unknown action type: ${actionType}`);
  }
}
