<?php
declare(strict_types=1);

const DATA_DIR = __DIR__ . '/data';
const LEGACY_SESSION_FILE = DATA_DIR . '/session.json';
const SESSIONS_DIR = DATA_DIR . '/sessions';
const SESSION_MAX_AGE_SECONDS = 86400;

function send_json(int $status, array $payload): void
{
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    header('Access-Control-Allow-Origin: *');
    header('Access-Control-Allow-Headers: Content-Type');
    header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
    header('Cache-Control: no-store');
    echo json_encode($payload, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
    exit;
}

function read_body(): array
{
    $raw = file_get_contents('php://input') ?: '';
    if ($raw === '') {
        return [];
    }

    $data = json_decode($raw, true);
    if (!is_array($data)) {
        send_json(400, ['error' => 'invalid-json']);
    }

    return $data;
}

function ensure_data_dir(): void
{
    if (!is_dir(DATA_DIR) && !mkdir(DATA_DIR, 0775, true) && !is_dir(DATA_DIR)) {
        send_json(500, ['error' => 'data-dir-unavailable']);
    }

    if (!is_dir(SESSIONS_DIR) && !mkdir(SESSIONS_DIR, 0775, true) && !is_dir(SESSIONS_DIR)) {
        send_json(500, ['error' => 'sessions-dir-unavailable']);
    }
}

function with_session_lock(callable $callback): void
{
    ensure_data_dir();
    $lockPath = DATA_DIR . '/session.lock';
    $lock = fopen($lockPath, 'c');
    if (!$lock) {
        send_json(500, ['error' => 'lock-unavailable']);
    }

    try {
        if (!flock($lock, LOCK_EX)) {
            send_json(500, ['error' => 'lock-failed']);
        }

        migrate_legacy_session();
        prune_expired_sessions();
        $callback();
    } finally {
        flock($lock, LOCK_UN);
        fclose($lock);
    }
}

function sanitize_string(mixed $value, int $maxLength = 120): string
{
    $value = is_string($value) ? trim($value) : '';
    return substr($value, 0, $maxLength);
}

function session_path(string $sessionId): string
{
    $safeSessionId = preg_replace('/[^a-f0-9]/i', '', $sessionId) ?? '';
    return SESSIONS_DIR . '/' . $safeSessionId . '.json';
}

function read_session_file(string $path): ?array
{
    if (!is_file($path)) {
        return null;
    }

    $contents = file_get_contents($path);
    if ($contents === false || trim($contents) === '') {
        return null;
    }

    $session = json_decode($contents, true);
    return is_array($session) ? $session : null;
}

function save_session(array $session): void
{
    $sessionId = sanitize_string($session['sessionId'] ?? '', 80);
    if ($sessionId === '') {
        send_json(500, ['error' => 'session-id-missing']);
    }

    $encoded = json_encode($session, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
    if ($encoded === false || file_put_contents(session_path($sessionId), $encoded, LOCK_EX) === false) {
        send_json(500, ['error' => 'session-write-failed']);
    }
}

function delete_session(array $session): bool
{
    $sessionId = sanitize_string($session['sessionId'] ?? '', 80);
    if ($sessionId === '') {
        return false;
    }

    $path = session_path($sessionId);
    return !is_file($path) || unlink($path);
}

function all_sessions(): array
{
    $sessions = [];
    foreach (glob(SESSIONS_DIR . '/*.json') ?: [] as $path) {
        $session = read_session_file($path);
        if (is_array($session)) {
            $sessions[] = $session;
        }
    }

    return $sessions;
}

function migrate_legacy_session(): void
{
    $session = read_session_file(LEGACY_SESSION_FILE);
    if (!$session) {
        return;
    }

    if (!isset($session['sessionId']) || sanitize_string($session['sessionId'], 80) === '') {
        $session['sessionId'] = bin2hex(random_bytes(16));
    }

    if (!is_file(session_path((string) $session['sessionId']))) {
        save_session($session);
    }

    @unlink(LEGACY_SESSION_FILE);
}

function session_timestamp(array $session): int
{
    if (is_numeric($session['updatedAt'] ?? null)) {
        return (int) $session['updatedAt'];
    }

    return is_numeric($session['createdAt'] ?? null) ? (int) $session['createdAt'] : 0;
}

function is_session_expired(array $session): bool
{
    $timestamp = session_timestamp($session);
    return $timestamp <= 0 || (time() - $timestamp) > SESSION_MAX_AGE_SECONDS;
}

function prune_expired_sessions(): void
{
    foreach (all_sessions() as $session) {
        if (is_session_expired($session)) {
            delete_session($session);
        }
    }
}

function find_session_by_password(string $password): ?array
{
    if ($password === '') {
        return null;
    }

    foreach (all_sessions() as $session) {
        if (password_verify($password, $session['passwordHash'] ?? '')) {
            return $session;
        }
    }

    return null;
}

function find_session_by_host_token(string $hostToken): ?array
{
    if ($hostToken === '') {
        return null;
    }

    foreach (all_sessions() as $session) {
        if (password_verify($hostToken, $session['hostTokenHash'] ?? '')) {
            return $session;
        }
    }

    return null;
}

function sanitize_player(mixed $player): ?array
{
    if (!is_array($player)) {
        return null;
    }

    $id = sanitize_string($player['id'] ?? '', 80);
    $name = sanitize_string($player['name'] ?? '', 80);
    if ($id === '' || $name === '') {
        return null;
    }

    $balance = $player['balance'] ?? 0;
    $properties = is_array($player['properties'] ?? null) ? array_values($player['properties']) : [];

    return [
        'id' => $id,
        'name' => $name,
        'balance' => is_numeric($balance) ? (int) $balance : 0,
        'properties' => array_values(array_filter(array_map(static function ($property): ?array {
            if (!is_array($property)) {
                return null;
            }

            $key = sanitize_string($property['key'] ?? '', 80);
            $name = sanitize_string($property['name'] ?? '', 120);
            if ($key === '' || $name === '') {
                return null;
            }

            return [
                'key' => $key,
                'name' => $name,
                'boughtImprovements' => array_values(array_map('boolval', is_array($property['boughtImprovements'] ?? null) ? $property['boughtImprovements'] : [])),
                'entranceCount' => is_numeric($property['entranceCount'] ?? null) ? (int) $property['entranceCount'] : 0,
            ];
        }, $properties))),
    ];
}

function public_players(array $session): array
{
    return array_map(static fn (array $player): array => [
        'id' => $player['id'],
        'name' => $player['name'],
    ], $session['players'] ?? []);
}

function player_token(array $session, string $playerId): string
{
    return hash_hmac('sha256', ($session['sessionId'] ?? '') . '|' . $playerId, $session['passwordHash'] ?? '');
}

function selected_player_response(array $session, string $playerId, bool $includePlayerToken = false): ?array
{
    foreach ($session['players'] ?? [] as $player) {
        if (($player['id'] ?? '') === $playerId) {
            $response = [
                'sessionId' => $session['sessionId'],
                'version' => $session['version'],
                'player' => $player,
            ];

            if ($includePlayerToken) {
                $response['playerToken'] = player_token($session, $playerId);
            }

            return $response;
        }
    }

    return null;
}

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    send_json(200, ['ok' => true]);
}

$action = $_GET['action'] ?? '';
$body = read_body();

with_session_lock(function () use ($action, $body): void {
    if ($action === 'create') {
        $password = sanitize_string($body['password'] ?? '', 120);
        if ($password === '') {
            send_json(400, ['error' => 'password-required']);
        }

        if (find_session_by_password($password)) {
            send_json(409, ['error' => 'active-session-exists']);
        }

        $hostToken = bin2hex(random_bytes(32));
        $session = [
            'sessionId' => bin2hex(random_bytes(16)),
            'passwordHash' => password_hash($password, PASSWORD_DEFAULT),
            'hostTokenHash' => password_hash($hostToken, PASSWORD_DEFAULT),
            'version' => 1,
            'players' => [],
            'createdAt' => time(),
            'updatedAt' => time(),
        ];

        save_session($session);
        send_json(200, [
            'sessionId' => $session['sessionId'],
            'hostToken' => $hostToken,
            'version' => $session['version'],
        ]);
    }

    if ($action === 'join') {
        $password = sanitize_string($body['password'] ?? '', 120);
        $session = find_session_by_password($password);
        if (!$session) {
            send_json(403, ['error' => 'invalid-password']);
        }

        send_json(200, [
            'sessionId' => $session['sessionId'],
            'version' => $session['version'],
            'players' => public_players($session),
        ]);
    }

    if ($action === 'resume-host') {
        $password = sanitize_string($body['password'] ?? '', 120);
        $session = find_session_by_password($password);
        if (!$session) {
            send_json(403, ['error' => 'invalid-password']);
        }

        $hostToken = bin2hex(random_bytes(32));
        $session['hostTokenHash'] = password_hash($hostToken, PASSWORD_DEFAULT);
        $session['updatedAt'] = time();
        save_session($session);

        send_json(200, [
            'sessionId' => $session['sessionId'],
            'hostToken' => $hostToken,
            'version' => $session['version'],
        ]);
    }

    if ($action === 'select-player' || $action === 'player') {
        $password = sanitize_string($body['password'] ?? '', 120);
        $playerId = sanitize_string($body['playerId'] ?? '', 80);
        $session = find_session_by_password($password);
        if (!$session) {
            send_json(403, ['error' => 'invalid-password']);
        }

        $selected = selected_player_response($session, $playerId, true);
        if (!$selected) {
            send_json(404, ['error' => 'player-not-found']);
        }

        send_json(200, $selected);
    }

    if ($action === 'update') {
        $hostToken = sanitize_string($body['hostToken'] ?? '', 160);
        $session = find_session_by_host_token($hostToken);
        if (!$session) {
            send_json(403, ['error' => 'invalid-host-token']);
        }

        $players = is_array($body['players'] ?? null) ? $body['players'] : [];
        $session['players'] = array_values(array_filter(array_map('sanitize_player', $players)));
        $session['version'] = (int) ($session['version'] ?? 0) + 1;
        $session['updatedAt'] = time();
        save_session($session);

        send_json(200, [
            'sessionId' => $session['sessionId'],
            'version' => $session['version'],
            'players' => public_players($session),
        ]);
    }

    if ($action === 'close') {
        $hostToken = sanitize_string($body['hostToken'] ?? '', 160);
        $session = find_session_by_host_token($hostToken);
        if (!$session) {
            send_json(403, ['error' => 'invalid-host-token']);
        }

        if (!delete_session($session)) {
            send_json(500, ['error' => 'session-close-failed']);
        }

        send_json(200, ['ok' => true]);
    }

    send_json(404, ['error' => 'unknown-action']);
});
