function validate(source, schemaOrFactory) {
  return (req, res, next) => {
    try {
      const schema = typeof schemaOrFactory === 'function' && !schemaOrFactory.parse
        ? schemaOrFactory(req)
        : schemaOrFactory;
      req[source] = schema.parse(req[source]);
      next();
    } catch (err) {
      const issues = err.issues || err.errors;
      if (Array.isArray(issues)) {
        const message = issues
          .map((issue) => `${issue.path?.join('.') || source}: ${issue.message}`)
          .join('; ');
        return res.status(400).json({
          success: false,
          error: { message: `Validation failed: ${message}`, status: 400 },
        });
      }
      next(err);
    }
  };
}

export const validateBody = (schema) => validate('body', schema);
export const validateParams = (schema) => validate('params', schema);
export const validateQuery = (schema) => validate('query', schema);
