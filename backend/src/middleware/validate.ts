import { Request, Response, NextFunction } from 'express';
import { validationResult, ValidationChain } from 'express-validator';
import { sendError } from '../utils/response.js';

// Middleware для обработки результатов валидации
export function validate(validations: ValidationChain[]) {
  return async (req: Request, res: Response, next: NextFunction) => {
    await Promise.all(validations.map((validation) => validation.run(req)));

    const errors = validationResult(req);

    if (errors.isEmpty()) {
      return next();
    }

    const formattedErrors = errors.array().map((error) => ({
      field: 'path' in error ? error.path : 'unknown',
      message: error.msg,
    }));

    return sendError(res, 'Ошибка валидации данных', 400, formattedErrors);
  };
}
