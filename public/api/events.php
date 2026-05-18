<?php
declare(strict_types=1);

const DATA_DIR = __DIR__ . '/data';
const LEGACY_SESSION_FILE = DATA_DIR . '/session.json';
const SESSIONS_DIR = DATA_DIR . '/sessions';
const SESSION_MAX_AGE_SECONDS = 86400;

function send_event(string $event, array $payload): void
{
    echo "event: {$event}\n";
    echo 'data: ' . json_encode($payload, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE) . "\n\n";
    @ob_flush();
    flush();
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

function load_session_by_id(string $sessionId): ?array
{
    $sessionId = sanitize_string($sessionId, 80);
    if ($sessionId === '') {
        return null;
    }

    $session = read_session_file(session_path($sessionId));
    if ($session) {
        return $session;
    }

    $legacySession = read_session_file(LEGACY_SESSION_FILE);
    if (($legacySession['sessionId'] ?? '') === $sessionId) {
        return $legacySession;
    }

    return null;
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

function player_token(array $session, string $playerId): string
{
    return hash_hmac('sha256', ($session['sessionId'] ?? '') . '|' . $playerId, $session['passwordHash'] ?? '');
}

function selected_player_response(array $session, string $playerId): ?array
{
    foreach ($session['players'] ?? [] as $player) {
        if (($player['id'] ?? '') === $playerId) {
            return [
                'sessionId' => $session['sessionId'],
                'version' => $session['version'],
                'player' => $player,
                'players' => array_values($session['players'] ?? []),
            ];
        }
    }

    return null;
}

header('Content-Type: text/event-stream; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Cache-Control: no-cache, no-transform');
header('X-Accel-Buffering: no');

$sessionId = is_string($_GET['sessionId'] ?? null) ? trim($_GET['sessionId']) : '';
$playerId = is_string($_GET['playerId'] ?? null) ? trim($_GET['playerId']) : '';
$providedToken = is_string($_GET['playerToken'] ?? null) ? trim($_GET['playerToken']) : '';
$since = is_numeric($_GET['since'] ?? null) ? (int) $_GET['since'] : 0;

if ($sessionId === '' || $playerId === '' || $providedToken === '') {
    send_event('error', ['error' => 'player-required']);
    exit;
}

$startedAt = time();
$lastSent = $since;

while (time() - $startedAt < 25) {
    if (connection_aborted()) {
        exit;
    }

    $session = load_session_by_id($sessionId);
    if (!$session || is_session_expired($session)) {
        send_event('error', ['error' => 'no-active-session']);
        exit;
    }

    if (!hash_equals(player_token($session, $playerId), $providedToken)) {
        send_event('error', ['error' => 'invalid-player-token']);
        exit;
    }

    $version = (int) ($session['version'] ?? 0);
    if ($version > $lastSent) {
        $selected = selected_player_response($session, $playerId);
        if (!$selected) {
            send_event('error', ['error' => 'player-not-found', 'version' => $version]);
            exit;
        }

        $lastSent = $version;
        send_event('player', $selected);
    }

    sleep(1);
}

send_event('keepalive', ['version' => $lastSent]);
