/**
 * Rate limiter em memória específico para tentativas de login via tRPC.
 *
 * O endpoint REST /api/auth/login é protegido pelo express-rate-limit, mas o
 * cliente autentica via tRPC (/api/trpc), que só passa pelo limiter geral
 * (100/15min) e ainda pode ser agrupado em lote pelo httpBatchLink. Este módulo
 * fecha essa lacuna contando tentativas por IP diretamente no procedimento de login.
 */

const WINDOW_MS = 15 * 60 * 1000; // 15 minutos
const MAX_ATTEMPTS = 5;

type Entry = { count: number; resetAt: number };

const attempts = new Map<string, Entry>();

/**
 * Remove entradas expiradas.
 */
function purgeExpired(now: number): void {
  attempts.forEach((entry, ip) => {
    if (now > entry.resetAt) attempts.delete(ip);
  });
}

// Periodic cleanup every minute to bound memory growth regardless of traffic volume.
setInterval(() => purgeExpired(Date.now()), 60 * 1000).unref();

/**
 * Registra uma tentativa de login para o IP informado.
 * @returns `true` se a tentativa é permitida, `false` se o limite foi atingido.
 */
export function consumeLoginAttempt(ip: string): boolean {
  const now = Date.now();
  if (attempts.size > 5000) purgeExpired(now);

  const entry = attempts.get(ip);
  if (!entry || now > entry.resetAt) {
    attempts.set(ip, { count: 1, resetAt: now + WINDOW_MS });
    return true;
  }

  if (entry.count >= MAX_ATTEMPTS) return false;
  entry.count += 1;
  return true;
}

/**
 * Zera o contador de um IP após login bem-sucedido, para não penalizar
 * usuários legítimos que erraram a senha algumas vezes antes de acertar.
 */
export function resetLoginAttempts(ip: string): void {
  attempts.delete(ip);
}
