import { Request, Response, NextFunction } from 'express';

interface ValidationError {
  field: string;
  message: string;
}

const isValidTimestamp = (value: unknown): boolean => {
  if (value === null) return true;
  if (typeof value !== 'number') return false;
  if (!Number.isFinite(value)) return false;
  if (value < 0) return false;
  return true;
};

const isValidEntityChanges = (changes: unknown): ValidationError[] => {
  const errors: ValidationError[] = [];

  if (changes === undefined || changes === null) {
    return errors;
  }

  if (typeof changes !== 'object' || Array.isArray(changes)) {
    errors.push({
      field: 'changes',
      message: 'Changes must be an object',
    });
    return errors;
  }

  const changesObj = changes as Record<string, unknown>;

  for (const [entityName, entityChanges] of Object.entries(changesObj)) {
    if (typeof entityChanges !== 'object' || entityChanges === null) {
      errors.push({
        field: `changes.${entityName}`,
        message: `${entityName} changes must be an object`,
      });
      continue;
    }

    const ec = entityChanges as Record<string, unknown>;

    if (ec.created !== undefined && !Array.isArray(ec.created)) {
      errors.push({
        field: `changes.${entityName}.created`,
        message: 'created must be an array',
      });
    }

    if (ec.updated !== undefined && !Array.isArray(ec.updated)) {
      errors.push({
        field: `changes.${entityName}.updated`,
        message: 'updated must be an array',
      });
    }

    if (ec.deleted !== undefined && !Array.isArray(ec.deleted)) {
      errors.push({
        field: `changes.${entityName}.deleted`,
        message: 'deleted must be an array',
      });
    }

    if (Array.isArray(ec.created)) {
      for (let i = 0; i < ec.created.length; i++) {
        const record = ec.created[i] as Record<string, unknown>;
        if (!record.clientId || typeof record.clientId !== 'string') {
          errors.push({
            field: `changes.${entityName}.created[${i}].clientId`,
            message: 'clientId is required and must be a string',
          });
        }
        if (record.updatedAt !== undefined && !isValidTimestamp(record.updatedAt)) {
          errors.push({
            field: `changes.${entityName}.created[${i}].updatedAt`,
            message: 'updatedAt must be a valid timestamp',
          });
        }
      }
    }

    if (Array.isArray(ec.updated)) {
      for (let i = 0; i < ec.updated.length; i++) {
        const record = ec.updated[i] as Record<string, unknown>;
        if (!record.clientId || typeof record.clientId !== 'string') {
          errors.push({
            field: `changes.${entityName}.updated[${i}].clientId`,
            message: 'clientId is required and must be a string',
          });
        }
        if (!isValidTimestamp(record.updatedAt)) {
          errors.push({
            field: `changes.${entityName}.updated[${i}].updatedAt`,
            message: 'updatedAt is required and must be a valid timestamp',
          });
        }
      }
    }

    if (Array.isArray(ec.deleted)) {
      for (let i = 0; i < ec.deleted.length; i++) {
        const id = ec.deleted[i];
        if (typeof id !== 'string' || id.trim() === '') {
          errors.push({
            field: `changes.${entityName}.deleted[${i}]`,
            message: 'deleted IDs must be non-empty strings',
          });
        }
      }
    }
  }

  return errors;
};

export const validateSyncRequest = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const errors: ValidationError[] = [];
  const { lastPulledAt, changes } = req.body;

  if (lastPulledAt !== undefined && !isValidTimestamp(lastPulledAt)) {
    errors.push({
      field: 'lastPulledAt',
      message: 'lastPulledAt must be null or a valid positive timestamp',
    });
  }

  const changesErrors = isValidEntityChanges(changes);
  errors.push(...changesErrors);

  if (errors.length > 0) {
    res.status(400).json({
      success: false,
      error: 'Validation failed',
      details: errors,
    });
    return;
  }

  next();
};

