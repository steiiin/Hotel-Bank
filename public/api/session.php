<?php
declare(strict_types=1);

const DATA_DIR = __DIR__ . '/data';
const SESSION_FILE = DATA_DIR . '/session.json';
const SESSION_MAX_AGE_SECONDS = 10800;

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

        $callback();
    } finally {
        flock($lock, LOCK_UN);
        fclose($lock);
    }
}

function load_session(): ?array
{
    if (!is_file(SESSION_FILE)) {
        return null;
    }

    $contents = file_get_contents(SESSION_FILE);
    if ($contents === false || trim($contents) === '') {
        return null;
    }

    $session = json_decode($contents, true);
    return is_array($session) ? $session : null;
}

function save_session(array $session): void
{
    $encoded = json_encode($session, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
    if ($encoded === false || file_put_contents(SESSION_FILE, $encoded, LOCK_EX) === false) {
        send_json(500, ['error' => 'session-write-failed']);
    }
}

function sanitize_string(mixed $value, int $maxLength = 120): string
{
    $value = is_string($value) ? trim($value) : '';
    return substr($value, 0, $maxLength);
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

function is_session_expired(array $session): bool
{
    $createdAt = is_numeric($session['createdAt'] ?? null) ? (int) $session['createdAt'] : 0;
    return $createdAt <= 0 || (time() - $createdAt) > SESSION_MAX_AGE_SECONDS;
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

        $existingSession = load_session();
        if ($existingSession && !is_session_expired($existingSession)) {
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

    $session = load_session();
    if (!$session) {
        send_json(404, ['error' => 'no-active-session']);
    }

    if ($action === 'join') {
        $password = sanitize_string($body['password'] ?? '', 120);
        if ($password === '' || !password_verify($password, $session['passwordHash'] ?? '')) {
            send_json(403, ['error' => 'invalid-password']);
        }

        send_json(200, [
            'sessionId' => $session['sessionId'],
            'version' => $session['version'],
            'players' => public_players($session),
        ]);
    }

    if ($action === 'select-player' || $action === 'player') {
        $password = sanitize_string($body['password'] ?? '', 120);
        $playerId = sanitize_string($body['playerId'] ?? '', 80);
        if ($password === '' || !password_verify($password, $session['passwordHash'] ?? '')) {
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
        if ($hostToken === '' || !password_verify($hostToken, $session['hostTokenHash'] ?? '')) {
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
        if ($hostToken === '' || !password_verify($hostToken, $session['hostTokenHash'] ?? '')) {
            send_json(403, ['error' => 'invalid-host-token']);
        }

        if (is_file(SESSION_FILE) && !unlink(SESSION_FILE)) {
            send_json(500, ['error' => 'session-close-failed']);
        }

        send_json(200, ['ok' => true]);
    }

    send_json(404, ['error' => 'unknown-action']);
});
