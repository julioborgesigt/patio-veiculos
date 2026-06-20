export const COOKIE_NAME = "app_session_id";
// Validade da sessão (JWT + cookie). Mantida curta para reduzir a janela de
// exposição de um token vazado — não há revogação server-side, então o TTL é a
// principal mitigação. Ajuste aqui se precisar de sessões mais longas/curtas.
export const SESSION_TTL_MS = 1000 * 60 * 60 * 12; // 12 horas
export const UNAUTHED_ERR_MSG = 'Faça login para continuar (10001)';
export const NOT_ADMIN_ERR_MSG = 'Você não tem permissão para esta ação (10002)';
export const MAX_BODY_SIZE = "5mb";
