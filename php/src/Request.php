<?php

declare(strict_types=1);

namespace App;

final class Request
{
    public static function json(): array
    {
        $raw = file_get_contents('php://input');
        if ($raw === false || trim($raw) === '') {
            return [];
        }

        $decoded = json_decode($raw, true);
        return is_array($decoded) ? $decoded : [];
    }

    public static function query(string $name): ?string
    {
        $value = $_GET[$name] ?? null;
        if ($value === null) {
            return null;
        }

        return is_string($value) ? $value : null;
    }

    public static function bearerToken(): ?string
    {
        $headers = getallheaders();
        $header = $headers['Authorization'] ?? $headers['authorization'] ?? null;
        if (!is_string($header)) {
            return null;
        }

        if (preg_match('/^Bearer\s+(.+)$/i', $header, $matches) !== 1) {
            return null;
        }

        return trim($matches[1]);
    }
}
