export const COOKIE_NAME = "app_session_id";
// Validade da sessão (JWT + cookie). O logout revoga o token server-side via
// blacklist de jti, então o TTL cobre apenas tokens vazados sem logout explícito.
// Ajuste aqui se precisar de sessões mais longas/curtas.
export const SESSION_TTL_MS = 1000 * 60 * 60 * 8; // 8 horas
export const UNAUTHED_ERR_MSG = 'Faça login para continuar (10001)';
export const MAX_BODY_SIZE = "5mb";
