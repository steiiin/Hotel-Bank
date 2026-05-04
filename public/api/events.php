<?php
declare(strict_types=1);

const DATA_DIR = __DIR__ . '/data';
const SESSION_FILE = DATA_DIR . '/session.json';

function send_event(string $event, array $payload): void
{
    echo "event: {$event}\n";
    echo 'data: ' . json_encode($payload, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE) . "\n\n";
    @ob_flush();
    flush();
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
            ];
        }
    }

    return null;
}

header('Content-Type: text/event-stream; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Cache-Control: no-cache, no-transform');
header('X-Accel-Buffering: no');

$playerId = is_string($_GET['playerId'] ?? null) ? trim($_GET['playerId']) : '';
$providedToken = is_string($_GET['playerToken'] ?? null) ? trim($_GET['playerToken']) : '';
$since = is_numeric($_GET['since'] ?? null) ? (int) $_GET['since'] : 0;

if ($playerId === '' || $providedToken === '') {
    send_event('error', ['error' => 'player-required']);
    exit;
}

$startedAt = time();
$lastSent = $since;

while (time() - $startedAt < 25) {
    if (connection_aborted()) {
        exit;
    }

    $session = load_session();
    if (!$session) {
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
