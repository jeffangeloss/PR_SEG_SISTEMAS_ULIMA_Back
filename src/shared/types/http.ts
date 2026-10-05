export type ApiErrorResponse = {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
};

export type ApiSuccessResponse<T> = {
  data: T;
};
