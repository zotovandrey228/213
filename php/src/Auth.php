<?php

declare(strict_types=1);

namespace App;

use PDO;
use RuntimeException;

final class Auth
{
    public static function userFromToken(PDO $pdo): ?array
    {
        $token = Request::bearerToken();
        if ($token === null || $token === '') {
            return null;
        }

        $secret = Env::get('JWT_SECRET', 'dev-secret-change-me') ?? 'dev-secret-change-me';

        try {
            $payload = Jwt::decode($token, $secret);
        } catch (RuntimeException $e) {
            return null;
        }

        if (!isset($payload['sub'])) {
            return null;
        }

        $stmt = $pdo->prepare('SELECT TOP 1 id, username, role, tg_id, created_at FROM users WHERE id = :id');
        $stmt->execute([':id' => (int) $payload['sub']]);
        $user = $stmt->fetch();

        return is_array($user) ? $user : null;
    }

    public static function requireUser(PDO $pdo): array
    {
        $user = self::userFromToken($pdo);
        if ($user === null) {
            Response::error('Unauthorized', 401);
            exit;
        }

        return $user;
    }

    public static function requireRole(array $user, array $allowedRoles): void
    {
        $role = $user['role'] ?? '';
        if (!in_array($role, $allowedRoles, true)) {
            Response::error('Forbidden', 403);
            exit;
        }
    }
}
