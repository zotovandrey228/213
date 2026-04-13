<?php

declare(strict_types=1);

namespace App;

use PDO;

final class Database
{
    private static ?PDO $pdo = null;

    public static function connection(): PDO
    {
        if (self::$pdo instanceof PDO) {
            return self::$pdo;
        }

        $host = Env::get('DB_HOST', '127.0.0.1') ?? '127.0.0.1';
        $port = Env::get('DB_PORT', '1433') ?? '1433';
        $databaseRaw = Env::get('DB_DATABASE', 'cartridge_db') ?? 'cartridge_db';
        $database = self::normalizeDatabaseName($databaseRaw);
        $username = Env::get('DB_USERNAME', 'sa') ?? 'sa';
        $password = Env::get('DB_PASSWORD', 'YourStrong@Password123') ?? 'YourStrong@Password123';

        $masterDsn = sprintf(
            'sqlsrv:Server=%s,%s;Database=master;TrustServerCertificate=1;Encrypt=0',
            $host,
            $port,
        );

        $master = new PDO($masterDsn, $username, $password, [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        ]);

        $checkDb = $master->prepare('SELECT DB_ID(:db) AS dbid');
        $checkDb->execute([':db' => $database]);
        $existsRow = $checkDb->fetch();
        if (!is_array($existsRow) || $existsRow['dbid'] === null) {
            $safeDb = str_replace(']', ']]', $database);
            $master->exec('CREATE DATABASE [' . $safeDb . ']');
        }

        $dsn = sprintf(
            'sqlsrv:Server=%s,%s;Database=%s;TrustServerCertificate=1;Encrypt=0',
            $host,
            $port,
            $database,
        );

        self::$pdo = new PDO($dsn, $username, $password, [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        ]);
        self::$pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
        self::$pdo->setAttribute(PDO::ATTR_DEFAULT_FETCH_MODE, PDO::FETCH_ASSOC);

        self::migrate(self::$pdo);
        self::seed(self::$pdo);

        return self::$pdo;
    }

    private static function migrate(PDO $pdo): void
    {
        $pdo->exec("IF OBJECT_ID('users', 'U') IS NULL
            CREATE TABLE users (
                id INT IDENTITY(1,1) PRIMARY KEY,
                username NVARCHAR(100) NOT NULL UNIQUE,
                password_hash NVARCHAR(255) NOT NULL,
                role NVARCHAR(20) NOT NULL DEFAULT 'viewer',
                tg_id NVARCHAR(50) NULL,
                created_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
            )");

        $pdo->exec("IF OBJECT_ID('regions', 'U') IS NULL
            CREATE TABLE regions (
                id INT IDENTITY(1,1) PRIMARY KEY,
                name NVARCHAR(120) NOT NULL UNIQUE,
                code INT NULL,
                created_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
            )");

        $pdo->exec("IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'idx_regions_code_unique' AND object_id = OBJECT_ID('regions'))
            CREATE UNIQUE INDEX idx_regions_code_unique ON regions(code) WHERE code IS NOT NULL");

        $pdo->exec("IF OBJECT_ID('cartridges', 'U') IS NULL
            CREATE TABLE cartridges (
                id INT IDENTITY(1,1) PRIMARY KEY,
                name NVARCHAR(200) NOT NULL,
                model NVARCHAR(200) NOT NULL,
                serial_number NVARCHAR(100) NULL,
                region_id INT NULL,
                number INT NULL,
                formatted_number NVARCHAR(32) NULL,
                status NVARCHAR(30) NOT NULL DEFAULT 'refill',
                comment NVARCHAR(MAX) NULL,
                created_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
                updated_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
                CONSTRAINT FK_cartridges_region FOREIGN KEY(region_id) REFERENCES regions(id) ON DELETE SET NULL
            )");

        $pdo->exec("IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'idx_cartridges_region_number' AND object_id = OBJECT_ID('cartridges'))
            CREATE UNIQUE INDEX idx_cartridges_region_number ON cartridges(region_id, number) WHERE number IS NOT NULL");

        $pdo->exec("IF OBJECT_ID('works', 'U') IS NULL
            CREATE TABLE works (
                id INT IDENTITY(1,1) PRIMARY KEY,
                cartridge_id INT NOT NULL,
                description NVARCHAR(MAX) NOT NULL,
                note NVARCHAR(MAX) NULL,
                performed_at DATETIME2 NOT NULL,
                performed_by INT NULL,
                created_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
                CONSTRAINT FK_works_cartridge FOREIGN KEY(cartridge_id) REFERENCES cartridges(id) ON DELETE CASCADE,
                CONSTRAINT FK_works_user FOREIGN KEY(performed_by) REFERENCES users(id) ON DELETE SET NULL
            )");

        $pdo->exec("IF OBJECT_ID('notes', 'U') IS NULL
            CREATE TABLE notes (
                id INT IDENTITY(1,1) PRIMARY KEY,
                cartridge_id INT NOT NULL,
                content NVARCHAR(MAX) NOT NULL,
                created_by INT NULL,
                created_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
                CONSTRAINT FK_notes_cartridge FOREIGN KEY(cartridge_id) REFERENCES cartridges(id) ON DELETE CASCADE,
                CONSTRAINT FK_notes_user FOREIGN KEY(created_by) REFERENCES users(id) ON DELETE SET NULL
            )");

        $pdo->exec("IF OBJECT_ID('cartridge_status_logs', 'U') IS NULL
            CREATE TABLE cartridge_status_logs (
                id INT IDENTITY(1,1) PRIMARY KEY,
                cartridge_id INT NOT NULL,
                from_status NVARCHAR(30) NOT NULL,
                to_status NVARCHAR(30) NOT NULL,
                reason NVARCHAR(MAX) NULL,
                changed_by INT NULL,
                changed_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
                CONSTRAINT FK_logs_cartridge FOREIGN KEY(cartridge_id) REFERENCES cartridges(id) ON DELETE CASCADE,
                CONSTRAINT FK_logs_user FOREIGN KEY(changed_by) REFERENCES users(id) ON DELETE SET NULL
            )");
    }

    private static function seed(PDO $pdo): void
    {
        $stmt = $pdo->prepare('SELECT TOP 1 id FROM users WHERE username = :username');
        $stmt->execute([':username' => 'admin']);
        $exists = $stmt->fetchColumn();

        if ($exists !== false) {
            return;
        }

        $hash = password_hash('admin123', PASSWORD_BCRYPT, ['cost' => 12]);
        $insert = $pdo->prepare('INSERT INTO users (username, password_hash, role) VALUES (:username, :password_hash, :role)');
        $insert->execute([
            ':username' => 'admin',
            ':password_hash' => $hash,
            ':role' => 'admin',
        ]);
    }

    private static function normalizeDatabaseName(string $database): string
    {
        $db = trim($database);
        if ($db === '') {
            return 'prn_cartridge_db';
        }

        if (stripos($db, 'prn_') === 0) {
            return $db;
        }

        return 'prn_' . $db;
    }
}
