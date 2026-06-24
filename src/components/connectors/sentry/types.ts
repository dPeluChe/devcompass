export type Async<T> = { loading: boolean; error: string | null; data: T | null }
export const idle: Async<never> = { loading: false, error: null, data: null }
