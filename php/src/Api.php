<?php

declare(strict_types=1);

namespace App;

use PDO;

final class Api
{
    private const ALLOWED_STATUSES = ['refill', 'ready_to_install', 'installed', 'broken'];
    private const ALLOWED_ROLES = ['admin', 'editor', 'viewer'];

    public function __construct(private readonly PDO $pdo)
    {
    }

    public function register(Router $router): void
    {
        $router->add('POST', '/auth/login', fn () => $this->login());

        $router->add('GET', '/users', fn () => $this->usersIndex());
        $router->add('GET', '/users/me', fn () => $this->usersMe());
        $router->add('POST', '/users', fn () => $this->usersCreate());
        $router->add('PUT', '/users/{id}', fn (array $p) => $this->usersUpdate((int) $p['id']));
        $router->add('DELETE', '/users/{id}', fn (array $p) => $this->usersDelete((int) $p['id']));

        $router->add('GET', '/regions', fn () => $this->regionsIndex());
        $router->add('POST', '/regions', fn () => $this->regionsCreate());
        $router->add('DELETE', '/regions/{id}', fn (array $p) => $this->regionsDelete((int) $p['id']));

        $router->add('GET', '/cartridges/next-number', fn () => $this->cartridgesNextNumber());
        $router->add('GET', '/cartridges/name-suggestions', fn () => $this->cartridgesNameSuggestions());
        $router->add('GET', '/cartridges', fn () => $this->cartridgesIndex());
        $router->add('GET', '/cartridges/{id}', fn (array $p) => $this->cartridgesShow((int) $p['id']));
        $router->add('POST', '/cartridges', fn () => $this->cartridgesCreate());
        $router->add('PUT', '/cartridges/{id}', fn (array $p) => $this->cartridgesUpdate((int) $p['id']));
        $router->add('DELETE', '/cartridges/{id}', fn (array $p) => $this->cartridgesDelete((int) $p['id']));

        $router->add('GET', '/works/cartridge/{cartridgeId}', fn (array $p) => $this->worksByCartridge((int) $p['cartridgeId']));
        $router->add('POST', '/works', fn () => $this->worksCreate());
        $router->add('DELETE', '/works/{id}', fn (array $p) => $this->worksDelete((int) $p['id']));

        $router->add('GET', '/notes/cartridge/{cartridgeId}', fn (array $p) => $this->notesByCartridge((int) $p['cartridgeId']));
        $router->add('POST', '/notes', fn () => $this->notesCreate());
        $router->add('DELETE', '/notes/{id}', fn (array $p) => $this->notesDelete((int) $p['id']));
    }

    private function login(): void
    {
        $data = Request::json();
        $username = trim((string) ($data['username'] ?? ''));
        $password = (string) ($data['password'] ?? '');

        if ($username === '' || $password === '') {
            Response::error('Invalid credentials', 401);
            return;
        }

        $stmt = $this->pdo->prepare('SELECT TOP 1 * FROM users WHERE username = :username');
        $stmt->execute([':username' => $username]);
        $user = $stmt->fetch();

        if (!is_array($user) || !password_verify($password, (string) $user['password_hash'])) {
            Response::error('Invalid credentials', 401);
            return;
        }

        $secret = Env::get('JWT_SECRET', 'dev-secret-change-me') ?? 'dev-secret-change-me';
        $ttl = (int) (Env::get('JWT_TTL_SECONDS', '604800') ?? '604800');

        $token = Jwt::encode([
            'sub' => (int) $user['id'],
            'username' => (string) $user['username'],
            'role' => (string) $user['role'],
        ], $secret, $ttl);

        Response::json([
            'access_token' => $token,
            'user' => [
                'id' => (int) $user['id'],
                'username' => (string) $user['username'],
                'role' => (string) $user['role'],
                'tg_id' => $user['tg_id'],
            ],
        ]);
    }

    private function usersIndex(): void
    {
        $user = Auth::requireUser($this->pdo);
        Auth::requireRole($user, ['admin']);

        $rows = $this->pdo->query('SELECT id, username, role, tg_id, created_at FROM users ORDER BY created_at ASC')->fetchAll();
        Response::json($rows ?: []);
    }

    private function usersMe(): void
    {
        $user = Auth::requireUser($this->pdo);
        Response::json($user);
    }

    private function usersCreate(): void
    {
        $authUser = Auth::requireUser($this->pdo);
        Auth::requireRole($authUser, ['admin']);

        $data = Request::json();
        $username = trim((string) ($data['username'] ?? ''));
        $password = (string) ($data['password'] ?? '');
        $role = (string) ($data['role'] ?? 'viewer');
        $tgId = isset($data['tg_id']) ? trim((string) $data['tg_id']) : null;

        if (strlen($username) < 3 || strlen($password) < 4 || !in_array($role, self::ALLOWED_ROLES, true)) {
            Response::error('Validation failed', 400);
            return;
        }

        $check = $this->pdo->prepare('SELECT TOP 1 id FROM users WHERE username = :username');
        $check->execute([':username' => $username]);
        if ($check->fetchColumn() !== false) {
            Response::error('Username already exists', 409);
            return;
        }

        $hash = password_hash($password, PASSWORD_BCRYPT, ['cost' => 12]);
        $stmt = $this->pdo->prepare('INSERT INTO users (username, password_hash, role, tg_id) VALUES (:username, :password_hash, :role, :tg_id)');
        $stmt->execute([
            ':username' => $username,
            ':password_hash' => $hash,
            ':role' => $role,
            ':tg_id' => $tgId !== '' ? $tgId : null,
        ]);

        $id = $this->lastInsertId();
        $res = $this->pdo->prepare('SELECT id, username, role, tg_id, created_at FROM users WHERE id = :id');
        $res->execute([':id' => $id]);

        Response::json($res->fetch() ?: [], 201);
    }

    private function usersUpdate(int $id): void
    {
        $authUser = Auth::requireUser($this->pdo);
        Auth::requireRole($authUser, ['admin']);

        $exists = $this->pdo->prepare('SELECT id FROM users WHERE id = :id');
        $exists->execute([':id' => $id]);
        if ($exists->fetchColumn() === false) {
            Response::error('User not found', 404);
            return;
        }

        $data = Request::json();
        $password = isset($data['password']) ? (string) $data['password'] : null;
        $role = isset($data['role']) ? (string) $data['role'] : null;
        $tgId = array_key_exists('tg_id', $data) ? trim((string) $data['tg_id']) : null;

        if ($password !== null && strlen($password) < 4) {
            Response::error('Validation failed', 400);
            return;
        }

        if ($role !== null && !in_array($role, self::ALLOWED_ROLES, true)) {
            Response::error('Validation failed', 400);
            return;
        }

        $updates = [];
        $params = [':id' => $id];

        if ($password !== null && $password !== '') {
            $updates[] = 'password_hash = :password_hash';
            $params[':password_hash'] = password_hash($password, PASSWORD_BCRYPT, ['cost' => 12]);
        }

        if ($role !== null) {
            $updates[] = 'role = :role';
            $params[':role'] = $role;
        }

        if (array_key_exists('tg_id', $data)) {
            $updates[] = 'tg_id = :tg_id';
            $params[':tg_id'] = $tgId !== '' ? $tgId : null;
        }

        if ($updates !== []) {
            $sql = 'UPDATE users SET ' . implode(', ', $updates) . ' WHERE id = :id';
            $stmt = $this->pdo->prepare($sql);
            $stmt->execute($params);
        }

        $res = $this->pdo->prepare('SELECT id, username, role, tg_id, created_at FROM users WHERE id = :id');
        $res->execute([':id' => $id]);
        Response::json($res->fetch() ?: []);
    }

    private function usersDelete(int $id): void
    {
        $authUser = Auth::requireUser($this->pdo);
        Auth::requireRole($authUser, ['admin']);

        $stmt = $this->pdo->prepare('DELETE FROM users WHERE id = :id');
        $stmt->execute([':id' => $id]);

        if ($stmt->rowCount() === 0) {
            Response::error('User not found', 404);
            return;
        }

        Response::json(['ok' => true]);
    }

    private function regionsIndex(): void
    {
        Auth::requireUser($this->pdo);
        $search = trim((string) (Request::query('search') ?? ''));

        if ($search !== '') {
            $stmt = $this->pdo->prepare('SELECT id, name, code, created_at FROM regions WHERE name LIKE :search ORDER BY name ASC');
            $stmt->execute([':search' => '%' . $search . '%']);
            Response::json($stmt->fetchAll() ?: []);
            return;
        }

        $rows = $this->pdo->query('SELECT id, name, code, created_at FROM regions ORDER BY name ASC')->fetchAll();
        Response::json($rows ?: []);
    }

    private function regionsCreate(): void
    {
        $user = Auth::requireUser($this->pdo);
        Auth::requireRole($user, ['admin']);

        $data = Request::json();
        $name = trim((string) ($data['name'] ?? ''));
        $code = isset($data['code']) ? (int) $data['code'] : null;

        if ($name === '' || $code === null || $code < 0 || $code > 9999) {
            Response::error('Validation failed', 400);
            return;
        }

        $nameExists = $this->pdo->prepare('SELECT TOP 1 id FROM regions WHERE name = :name');
        $nameExists->execute([':name' => $name]);
        if ($nameExists->fetchColumn() !== false) {
            Response::error('Region already exists', 400);
            return;
        }

        $codeExists = $this->pdo->prepare('SELECT TOP 1 id FROM regions WHERE code = :code');
        $codeExists->execute([':code' => $code]);
        if ($codeExists->fetchColumn() !== false) {
            Response::error('Region code already exists', 400);
            return;
        }

        $stmt = $this->pdo->prepare('INSERT INTO regions (name, code) VALUES (:name, :code)');
        $stmt->execute([':name' => $name, ':code' => $code]);

        $id = $this->lastInsertId();
        $row = $this->pdo->prepare('SELECT id, name, code, created_at FROM regions WHERE id = :id');
        $row->execute([':id' => $id]);
        Response::json($row->fetch() ?: [], 201);
    }

    private function regionsDelete(int $id): void
    {
        $user = Auth::requireUser($this->pdo);
        Auth::requireRole($user, ['admin']);

        $stmt = $this->pdo->prepare('DELETE FROM regions WHERE id = :id');
        $stmt->execute([':id' => $id]);
        if ($stmt->rowCount() === 0) {
            Response::error('Region not found', 404);
            return;
        }

        Response::json(['ok' => true]);
    }

    private function cartridgesIndex(): void
    {
        Auth::requireUser($this->pdo);
        $search = trim((string) (Request::query('search') ?? ''));

        $sql = 'SELECT c.*, r.id AS region_id_v, r.name AS region_name, r.code AS region_code
                FROM cartridges c
                LEFT JOIN regions r ON r.id = c.region_id';

        $params = [];
        if ($search !== '') {
            $sql .= ' WHERE c.name LIKE :search OR c.model LIKE :search OR c.serial_number LIKE :search OR c.formatted_number LIKE :search OR c.status LIKE :search OR r.name LIKE :search';
            $params[':search'] = '%' . $search . '%';
        }

        $sql .= ' ORDER BY c.created_at DESC';
        $stmt = $this->pdo->prepare($sql);
        $stmt->execute($params);
        $rows = $stmt->fetchAll() ?: [];

        $result = array_map(fn (array $row) => $this->hydrateCartridgeRow($row), $rows);
        Response::json($result);
    }

    private function cartridgesShow(int $id): void
    {
        Auth::requireUser($this->pdo);

        $stmt = $this->pdo->prepare('SELECT c.*, r.id AS region_id_v, r.name AS region_name, r.code AS region_code
            FROM cartridges c
            LEFT JOIN regions r ON r.id = c.region_id
            WHERE c.id = :id');
        $stmt->execute([':id' => $id]);
        $cartridgeRow = $stmt->fetch();

        if (!is_array($cartridgeRow)) {
            Response::error('Cartridge not found', 404);
            return;
        }

        $cartridge = $this->hydrateCartridgeRow($cartridgeRow);

        $worksStmt = $this->pdo->prepare('SELECT w.*, u.id AS user_id, u.username AS user_username
            FROM works w
            LEFT JOIN users u ON u.id = w.performed_by
            WHERE w.cartridge_id = :id
            ORDER BY w.performed_at DESC');
        $worksStmt->execute([':id' => $id]);
        $worksRows = $worksStmt->fetchAll() ?: [];
        $cartridge['works'] = array_map(fn (array $row) => [
            'id' => (int) $row['id'],
            'description' => $row['description'],
            'note' => $row['note'],
            'performed_at' => $row['performed_at'],
            'created_at' => $row['created_at'],
            'performed_by' => $row['user_id'] !== null ? [
                'id' => (int) $row['user_id'],
                'username' => $row['user_username'],
            ] : null,
        ], $worksRows);

        $notesStmt = $this->pdo->prepare('SELECT n.*, u.id AS user_id, u.username AS user_username
            FROM notes n
            LEFT JOIN users u ON u.id = n.created_by
            WHERE n.cartridge_id = :id
            ORDER BY n.created_at DESC');
        $notesStmt->execute([':id' => $id]);
        $notesRows = $notesStmt->fetchAll() ?: [];
        $cartridge['notes'] = array_map(fn (array $row) => [
            'id' => (int) $row['id'],
            'content' => $row['content'],
            'created_at' => $row['created_at'],
            'created_by' => $row['user_id'] !== null ? [
                'id' => (int) $row['user_id'],
                'username' => $row['user_username'],
            ] : null,
        ], $notesRows);

        $logsStmt = $this->pdo->prepare('SELECT l.*, u.id AS user_id, u.username AS user_username
            FROM cartridge_status_logs l
            LEFT JOIN users u ON u.id = l.changed_by
            WHERE l.cartridge_id = :id
            ORDER BY l.changed_at DESC');
        $logsStmt->execute([':id' => $id]);
        $logsRows = $logsStmt->fetchAll() ?: [];
        $cartridge['status_logs'] = array_map(fn (array $row) => [
            'id' => (int) $row['id'],
            'from_status' => $row['from_status'],
            'to_status' => $row['to_status'],
            'reason' => $row['reason'],
            'changed_at' => $row['changed_at'],
            'changed_by' => $row['user_id'] !== null ? [
                'id' => (int) $row['user_id'],
                'username' => $row['user_username'],
            ] : null,
        ], $logsRows);

        Response::json($cartridge);
    }

    private function cartridgesCreate(): void
    {
        $user = Auth::requireUser($this->pdo);
        Auth::requireRole($user, ['admin', 'editor']);

        $data = Request::json();
        $name = trim((string) ($data['name'] ?? ''));
        $model = trim((string) ($data['model'] ?? ''));
        $serialNumber = isset($data['serial_number']) ? trim((string) $data['serial_number']) : null;
        $regionId = isset($data['region_id']) ? (int) $data['region_id'] : null;
        $status = (string) ($data['status'] ?? 'refill');
        $comment = isset($data['comment']) ? trim((string) $data['comment']) : null;
        $number = isset($data['number']) ? (int) $data['number'] : null;

        if ($name === '' || strlen($name) > 200) {
            Response::error('Validation failed', 400);
            return;
        }

        if ($model === '') {
            $model = $name;
        }

        if (!in_array($status, self::ALLOWED_STATUSES, true)) {
            Response::error('Validation failed', 400);
            return;
        }

        $region = null;
        if ($regionId !== null && $regionId > 0) {
            $region = $this->findRegion($regionId);
            if ($region === null) {
                Response::error('Region not found', 400);
                return;
            }
        } else {
            $regionId = null;
        }

        if ($number === null || $number < 1) {
            $next = $this->computeNextNumber($regionId);
            $number = $next['number'];
        }

        if ($this->numberExists($number, $regionId, null)) {
            Response::error('Cartridge number already exists in this region', 400);
            return;
        }

        $formatted = null;
        if ($region !== null) {
            if ($region['code'] === null) {
                Response::error('Region code is not configured', 400);
                return;
            }
            $formatted = $this->formatCartridgeNumber((int) $region['code'], $number);
        }

        $stmt = $this->pdo->prepare('INSERT INTO cartridges
            (name, model, serial_number, region_id, number, formatted_number, status, comment)
            VALUES (:name, :model, :serial_number, :region_id, :number, :formatted_number, :status, :comment)');

        $stmt->execute([
            ':name' => $name,
            ':model' => $model,
            ':serial_number' => $serialNumber !== '' ? $serialNumber : null,
            ':region_id' => $regionId,
            ':number' => $number,
            ':formatted_number' => $formatted,
            ':status' => $status,
            ':comment' => $comment !== '' ? $comment : null,
        ]);

        $id = $this->lastInsertId();
        $this->cartridgesShow($id);
    }

    private function cartridgesUpdate(int $id): void
    {
        $user = Auth::requireUser($this->pdo);
        Auth::requireRole($user, ['admin', 'editor']);

        $currentStmt = $this->pdo->prepare('SELECT TOP 1 * FROM cartridges WHERE id = :id');
        $currentStmt->execute([':id' => $id]);
        $current = $currentStmt->fetch();

        if (!is_array($current)) {
            Response::error('Cartridge not found', 404);
            return;
        }

        $data = Request::json();
        $next = $current;

        if (array_key_exists('name', $data)) {
            $next['name'] = trim((string) $data['name']);
        }

        if (array_key_exists('model', $data)) {
            $next['model'] = trim((string) $data['model']);
        }

        if (array_key_exists('serial_number', $data)) {
            $next['serial_number'] = trim((string) $data['serial_number']);
        }

        if (array_key_exists('comment', $data)) {
            $next['comment'] = trim((string) $data['comment']);
        }

        if (array_key_exists('region_id', $data)) {
            $rid = $data['region_id'];
            if ($rid === null || $rid === '') {
                $next['region_id'] = null;
            } else {
                $next['region_id'] = (int) $rid;
            }
        }

        if (array_key_exists('number', $data)) {
            $next['number'] = (int) $data['number'];
        }

        if (array_key_exists('status', $data)) {
            $next['status'] = (string) $data['status'];
        }

        if (trim((string) $next['name']) === '' || strlen((string) $next['name']) > 200) {
            Response::error('Validation failed', 400);
            return;
        }

        $next['model'] = trim((string) $next['model']) !== '' ? trim((string) $next['model']) : trim((string) $next['name']);

        if (!in_array((string) $next['status'], self::ALLOWED_STATUSES, true)) {
            Response::error('Validation failed', 400);
            return;
        }

        $regionId = $next['region_id'] !== null ? (int) $next['region_id'] : null;
        $region = null;
        if ($regionId !== null) {
            $region = $this->findRegion($regionId);
            if ($region === null) {
                Response::error('Region not found', 400);
                return;
            }
        }

        $number = $next['number'] !== null ? (int) $next['number'] : null;
        if ($number !== null && $number < 1) {
            Response::error('Validation failed', 400);
            return;
        }

        if ($number !== null && $this->numberExists($number, $regionId, $id)) {
            Response::error('Cartridge number already exists in this region', 400);
            return;
        }

        $formatted = null;
        if ($region !== null && $number !== null) {
            if ($region['code'] === null) {
                Response::error('Region code is not configured', 400);
                return;
            }
            $formatted = $this->formatCartridgeNumber((int) $region['code'], $number);
        }

        $stmt = $this->pdo->prepare('UPDATE cartridges
            SET name = :name,
                model = :model,
                serial_number = :serial_number,
                region_id = :region_id,
                number = :number,
                formatted_number = :formatted_number,
                status = :status,
                comment = :comment,
                updated_at = SYSUTCDATETIME()
            WHERE id = :id');

        $stmt->execute([
            ':id' => $id,
            ':name' => trim((string) $next['name']),
            ':model' => trim((string) $next['model']),
            ':serial_number' => trim((string) $next['serial_number']) !== '' ? trim((string) $next['serial_number']) : null,
            ':region_id' => $regionId,
            ':number' => $number,
            ':formatted_number' => $formatted,
            ':status' => (string) $next['status'],
            ':comment' => trim((string) $next['comment']) !== '' ? trim((string) $next['comment']) : null,
        ]);

        if ((string) $current['status'] !== (string) $next['status']) {
            $reason = isset($data['status_reason']) ? trim((string) $data['status_reason']) : null;
            $log = $this->pdo->prepare('INSERT INTO cartridge_status_logs (cartridge_id, from_status, to_status, reason, changed_by)
                VALUES (:cartridge_id, :from_status, :to_status, :reason, :changed_by)');
            $log->execute([
                ':cartridge_id' => $id,
                ':from_status' => (string) $current['status'],
                ':to_status' => (string) $next['status'],
                ':reason' => $reason !== '' ? $reason : null,
                ':changed_by' => (int) $user['id'],
            ]);
        }

        $this->cartridgesShow($id);
    }

    private function cartridgesDelete(int $id): void
    {
        $user = Auth::requireUser($this->pdo);
        Auth::requireRole($user, ['admin']);

        $stmt = $this->pdo->prepare('DELETE FROM cartridges WHERE id = :id');
        $stmt->execute([':id' => $id]);

        if ($stmt->rowCount() === 0) {
            Response::error('Cartridge not found', 404);
            return;
        }

        Response::json(['ok' => true]);
    }

    private function cartridgesNextNumber(): void
    {
        $user = Auth::requireUser($this->pdo);
        Auth::requireRole($user, ['admin', 'editor']);

        $regionId = Request::query('region_id');
        $regionInt = ($regionId !== null && $regionId !== '') ? (int) $regionId : null;

        if ($regionInt !== null && $regionInt > 0) {
            $region = $this->findRegion($regionInt);
            if ($region === null) {
                Response::error('Region not found', 400);
                return;
            }
        }

        $next = $this->computeNextNumber($regionInt);
        Response::json($next);
    }

    private function cartridgesNameSuggestions(): void
    {
        Auth::requireUser($this->pdo);
        $query = trim((string) (Request::query('query') ?? ''));

        $sql = 'SELECT DISTINCT name FROM cartridges WHERE name IS NOT NULL AND name <> ""';
        $params = [];
        if ($query !== '') {
            $sql .= ' AND name LIKE :query';
            $params[':query'] = '%' . $query . '%';
        }

        $sql .= ' ORDER BY name ASC OFFSET 0 ROWS FETCH NEXT 10 ROWS ONLY';
        $stmt = $this->pdo->prepare($sql);
        $stmt->execute($params);
        $rows = $stmt->fetchAll() ?: [];

        Response::json(array_map(static fn (array $r) => (string) $r['name'], $rows));
    }

    private function worksByCartridge(int $cartridgeId): void
    {
        Auth::requireUser($this->pdo);

        $stmt = $this->pdo->prepare('SELECT w.*, u.id AS user_id, u.username AS user_username
            FROM works w
            LEFT JOIN users u ON u.id = w.performed_by
            WHERE w.cartridge_id = :id
            ORDER BY w.performed_at DESC');
        $stmt->execute([':id' => $cartridgeId]);
        $rows = $stmt->fetchAll() ?: [];

        $result = array_map(fn (array $row) => [
            'id' => (int) $row['id'],
            'description' => $row['description'],
            'note' => $row['note'],
            'performed_at' => $row['performed_at'],
            'created_at' => $row['created_at'],
            'performed_by' => $row['user_id'] !== null ? [
                'id' => (int) $row['user_id'],
                'username' => $row['user_username'],
            ] : null,
        ], $rows);

        Response::json($result);
    }

    private function worksCreate(): void
    {
        $user = Auth::requireUser($this->pdo);
        Auth::requireRole($user, ['admin', 'editor']);

        $data = Request::json();
        $cartridgeId = isset($data['cartridge_id']) ? (int) $data['cartridge_id'] : 0;
        $description = trim((string) ($data['description'] ?? ''));
        $note = isset($data['note']) ? trim((string) $data['note']) : null;
        $performedAt = trim((string) ($data['performed_at'] ?? ''));
        $performedBy = isset($data['performed_by_id']) ? (int) $data['performed_by_id'] : (int) $user['id'];

        if ($cartridgeId < 1 || $description === '' || $performedAt === '') {
            Response::error('Validation failed', 400);
            return;
        }

        if (strtotime($performedAt) === false) {
            Response::error('Validation failed', 400);
            return;
        }

        $stmt = $this->pdo->prepare('INSERT INTO works (cartridge_id, description, note, performed_at, performed_by)
            VALUES (:cartridge_id, :description, :note, :performed_at, :performed_by)');

        $stmt->execute([
            ':cartridge_id' => $cartridgeId,
            ':description' => $description,
            ':note' => $note !== '' ? $note : null,
            ':performed_at' => date('Y-m-d H:i:s', strtotime($performedAt) ?: time()),
            ':performed_by' => $performedBy,
        ]);

        $id = $this->lastInsertId();
        $row = $this->pdo->prepare('SELECT w.*, u.id AS user_id, u.username AS user_username
            FROM works w
            LEFT JOIN users u ON u.id = w.performed_by
            WHERE w.id = :id');
        $row->execute([':id' => $id]);
        $record = $row->fetch();

        Response::json([
            'id' => (int) $record['id'],
            'description' => $record['description'],
            'note' => $record['note'],
            'performed_at' => $record['performed_at'],
            'created_at' => $record['created_at'],
            'performed_by' => $record['user_id'] !== null ? [
                'id' => (int) $record['user_id'],
                'username' => $record['user_username'],
            ] : null,
        ], 201);
    }

    private function worksDelete(int $id): void
    {
        $user = Auth::requireUser($this->pdo);
        Auth::requireRole($user, ['admin', 'editor']);

        $stmt = $this->pdo->prepare('DELETE FROM works WHERE id = :id');
        $stmt->execute([':id' => $id]);

        if ($stmt->rowCount() === 0) {
            Response::error('Work not found', 404);
            return;
        }

        Response::json(['ok' => true]);
    }

    private function notesByCartridge(int $cartridgeId): void
    {
        Auth::requireUser($this->pdo);

        $stmt = $this->pdo->prepare('SELECT n.*, u.id AS user_id, u.username AS user_username
            FROM notes n
            LEFT JOIN users u ON u.id = n.created_by
            WHERE n.cartridge_id = :id
            ORDER BY n.created_at DESC');
        $stmt->execute([':id' => $cartridgeId]);
        $rows = $stmt->fetchAll() ?: [];

        $result = array_map(fn (array $row) => [
            'id' => (int) $row['id'],
            'content' => $row['content'],
            'created_at' => $row['created_at'],
            'created_by' => $row['user_id'] !== null ? [
                'id' => (int) $row['user_id'],
                'username' => $row['user_username'],
            ] : null,
        ], $rows);

        Response::json($result);
    }

    private function notesCreate(): void
    {
        $user = Auth::requireUser($this->pdo);
        Auth::requireRole($user, ['admin', 'editor']);

        $data = Request::json();
        $cartridgeId = isset($data['cartridge_id']) ? (int) $data['cartridge_id'] : 0;
        $content = trim((string) ($data['content'] ?? ''));
        $createdBy = isset($data['created_by_id']) ? (int) $data['created_by_id'] : (int) $user['id'];

        if ($cartridgeId < 1 || $content === '') {
            Response::error('Validation failed', 400);
            return;
        }

        $stmt = $this->pdo->prepare('INSERT INTO notes (cartridge_id, content, created_by)
            VALUES (:cartridge_id, :content, :created_by)');
        $stmt->execute([
            ':cartridge_id' => $cartridgeId,
            ':content' => $content,
            ':created_by' => $createdBy,
        ]);

        $id = $this->lastInsertId();
        $row = $this->pdo->prepare('SELECT n.*, u.id AS user_id, u.username AS user_username
            FROM notes n
            LEFT JOIN users u ON u.id = n.created_by
            WHERE n.id = :id');
        $row->execute([':id' => $id]);
        $record = $row->fetch();

        Response::json([
            'id' => (int) $record['id'],
            'content' => $record['content'],
            'created_at' => $record['created_at'],
            'created_by' => $record['user_id'] !== null ? [
                'id' => (int) $record['user_id'],
                'username' => $record['user_username'],
            ] : null,
        ], 201);
    }

    private function notesDelete(int $id): void
    {
        $user = Auth::requireUser($this->pdo);
        Auth::requireRole($user, ['admin', 'editor']);

        $stmt = $this->pdo->prepare('DELETE FROM notes WHERE id = :id');
        $stmt->execute([':id' => $id]);

        if ($stmt->rowCount() === 0) {
            Response::error('Note not found', 404);
            return;
        }

        Response::json(['ok' => true]);
    }

    private function findRegion(int $id): ?array
    {
        $stmt = $this->pdo->prepare('SELECT TOP 1 id, name, code FROM regions WHERE id = :id');
        $stmt->execute([':id' => $id]);
        $row = $stmt->fetch();

        return is_array($row) ? $row : null;
    }

    private function computeNextNumber(?int $regionId): array
    {
        if ($regionId !== null) {
            $stmt = $this->pdo->prepare('SELECT MAX(number) AS max_number FROM cartridges WHERE region_id = :region_id');
            $stmt->execute([':region_id' => $regionId]);
        } else {
            $stmt = $this->pdo->query('SELECT MAX(number) AS max_number FROM cartridges WHERE region_id IS NULL');
        }

        $row = $stmt->fetch();
        $max = isset($row['max_number']) && $row['max_number'] !== null ? (int) $row['max_number'] : 0;
        $next = $max + 1;

        if ($regionId === null) {
            return ['number' => $next];
        }

        $region = $this->findRegion($regionId);
        if ($region === null) {
            return ['number' => $next];
        }

        if ($region['code'] === null) {
            return ['number' => $next];
        }

        return [
            'number' => $next,
            'formatted_number' => $this->formatCartridgeNumber((int) $region['code'], $next),
        ];
    }

    private function numberExists(int $number, ?int $regionId, ?int $excludeId): bool
    {
        if ($regionId !== null) {
            $sql = 'SELECT id FROM cartridges WHERE number = :number AND region_id = :region_id';
            $params = [':number' => $number, ':region_id' => $regionId];
        } else {
            $sql = 'SELECT id FROM cartridges WHERE number = :number AND region_id IS NULL';
            $params = [':number' => $number];
        }

        if ($excludeId !== null) {
            $sql .= ' AND id <> :exclude_id';
            $params[':exclude_id'] = $excludeId;
        }

        $sql = 'SELECT TOP 1 id FROM (' . $sql . ') t';

        $stmt = $this->pdo->prepare($sql);
        $stmt->execute($params);

        return $stmt->fetchColumn() !== false;
    }

    private function formatCartridgeNumber(int $regionCode, int $cartridgeNumber): string
    {
        return (string) $regionCode . '_' . str_pad((string) $cartridgeNumber, 4, '0', STR_PAD_LEFT);
    }

    private function hydrateCartridgeRow(array $row): array
    {
        return [
            'id' => (int) $row['id'],
            'name' => $row['name'],
            'model' => $row['model'],
            'serial_number' => $row['serial_number'],
            'region' => $row['region_id_v'] !== null ? [
                'id' => (int) $row['region_id_v'],
                'name' => $row['region_name'],
                'code' => $row['region_code'] !== null ? (int) $row['region_code'] : null,
            ] : null,
            'number' => $row['number'] !== null ? (int) $row['number'] : null,
            'formatted_number' => $row['formatted_number'],
            'status' => $row['status'],
            'comment' => $row['comment'],
            'created_at' => $row['created_at'],
            'updated_at' => $row['updated_at'],
        ];
    }

    private function lastInsertId(): int
    {
        $stmt = $this->pdo->query('SELECT CAST(SCOPE_IDENTITY() AS INT) AS id');
        $row = $stmt ? $stmt->fetch() : null;
        if (is_array($row) && isset($row['id'])) {
            return (int) $row['id'];
        }

        throw new \RuntimeException('Cannot resolve last inserted id');
    }
}
