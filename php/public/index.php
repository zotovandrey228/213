<?php

declare(strict_types=1);

use App\Api;
use App\Database;
use App\Env;
use App\Response;
use App\Router;

require_once __DIR__ . '/../src/Env.php';
require_once __DIR__ . '/../src/Database.php';
require_once __DIR__ . '/../src/Response.php';
require_once __DIR__ . '/../src/Request.php';
require_once __DIR__ . '/../src/Jwt.php';
require_once __DIR__ . '/../src/Auth.php';
require_once __DIR__ . '/../src/Router.php';
require_once __DIR__ . '/../src/Api.php';

Env::load(__DIR__ . '/../.env');

header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, PUT, PATCH, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

if (($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'OPTIONS') {
    http_response_code(204);
    exit;
}

$path = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH);
$path = is_string($path) ? $path : '/';
$isApiRequest = str_starts_with($path, '/api');

if ($isApiRequest) {
    $path = substr($path, 4);
    if ($path === '') {
        $path = '/';
    }
}

if (!$isApiRequest && ($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'GET') {
    $indexFile = __DIR__ . '/index.html';
    if (is_file($indexFile)) {
        header('Content-Type: text/html; charset=utf-8');
        readfile($indexFile);
        exit;
    }

    Response::json([
        'name' => 'cartridge-php-api',
        'status' => 'ok',
    ]);
    exit;
}

if ($isApiRequest && $path === '/' && ($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'GET') {
    Response::json([
        'name' => 'cartridge-php-api',
        'status' => 'ok',
    ]);
    exit;
}

$router = new Router();
$api = new Api(Database::connection());
$api->register($router);

$router->dispatch($_SERVER['REQUEST_METHOD'] ?? 'GET', $path);
