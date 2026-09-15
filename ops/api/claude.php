<?php
/**
 * Claude API proxy for GoDaddy shared hosting (Apache + PHP).
 * Route:  /ops/api/claude.php
 *
 * Keeps the Anthropic key server-side. The key is resolved in this order:
 *   1. Environment variable ANTHROPIC_API_KEY  (cPanel → set via .htaccess `SetEnv`
 *      or "Environment variables"), OR
 *   2. ops/api/config.php  — an untracked file returning ['ANTHROPIC_API_KEY' => 'sk-ant-...'],
 *      created once on the server (copy config.sample.php). Never committed.
 *   3. ../ops_config.php one level above the web root (most private option).
 *
 * The browser never sees the key. Light guardrails keep this from being an open relay.
 */

header('Content-Type: application/json');

function fail($msg, $code) {
    http_response_code($code);
    echo json_encode(['error' => ['message' => $msg]]);
    exit;
}

// ---- resolve the key ----
$key = getenv('ANTHROPIC_API_KEY');
if (!$key) {
    $candidates = [
        __DIR__ . '/config.php',
        dirname($_SERVER['DOCUMENT_ROOT'] ?? __DIR__) . '/ops_config.php',
    ];
    foreach ($candidates as $f) {
        if (is_file($f)) {
            $c = require $f;
            if (is_array($c) && !empty($c['ANTHROPIC_API_KEY'])) { $key = $c['ANTHROPIC_API_KEY']; break; }
            if (is_string($c) && $c !== '') { $key = $c; break; }
        }
    }
}

// ---- health check ----
if (($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'GET') {
    echo json_encode(['ok' => true, 'service' => 'ops-claude-proxy', 'configured' => (bool)$key]);
    exit;
}
if ($_SERVER['REQUEST_METHOD'] !== 'POST') fail('Method not allowed.', 405);
if (!$key) fail('Server is missing the ANTHROPIC_API_KEY secret.', 501);

// ---- same-origin guard ----
$origin = $_SERVER['HTTP_ORIGIN'] ?? '';
if ($origin) {
    $oh = parse_url($origin, PHP_URL_HOST);
    $sh = $_SERVER['HTTP_HOST'] ?? '';
    if ($oh && $sh && $oh !== $sh) fail('Cross-origin requests are not allowed.', 403);
}

// ---- validate + clamp ----
$raw = file_get_contents('php://input');
$payload = json_decode($raw, true);
if (!is_array($payload)) fail('Invalid JSON body.', 400);
if (empty($payload['model']) || strpos($payload['model'], 'claude-') !== 0) fail('Only Claude models are permitted.', 400);
if (empty($payload['messages']) || !is_array($payload['messages'])) fail('messages[] is required.', 400);
$payload['max_tokens'] = min((int)($payload['max_tokens'] ?? 4096), 8000);

// ---- relay to Anthropic ----
$ch = curl_init('https://api.anthropic.com/v1/messages');
curl_setopt_array($ch, [
    CURLOPT_POST           => true,
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_HTTPHEADER     => [
        'content-type: application/json',
        'x-api-key: ' . $key,
        'anthropic-version: 2023-06-01',
    ],
    CURLOPT_POSTFIELDS     => json_encode($payload),
    CURLOPT_TIMEOUT        => 120,
]);
$resp = curl_exec($ch);
if ($resp === false) fail('Upstream request failed: ' . curl_error($ch), 502);
$status = curl_getinfo($ch, CURLINFO_HTTP_CODE) ?: 502;
curl_close($ch);

http_response_code($status);
echo $resp;
